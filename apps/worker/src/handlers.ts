import { QUEUE_NAMES, TaskState } from "@bloks/shared";
import { processOrchestrate } from "./orchestrator.js";
import { getDb } from "@bloks/db";
import { routeAI, TASK_TEMPLATES, generateImage, searchWeb, buildSearchContext, deriveSearchQuery } from "@bloks/ai-router";
import { globalRuntimeEngine } from "@bloks/agent-runtime";
import { buildMemoryContext, createMemory, deriveMemorySummary } from "@bloks/memory";
import { calcTaskExperience, expRequiredForLevel } from "@bloks/simulation";
import { sendAgentMessage, findAvailableReviewer } from "./helpers.js";
function publishWorldEvent(_type: string, _payload: Record<string, unknown>): void {
  // In-process only — no Redis. Events are logged by the tick engine directly.
}

const activeTaskIds = new Set<string>();

type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export type WorkerJobPayload = {
  queueName?: string;
  payload?: {
    input?: Record<string, unknown>;
    companyId?: string | null;
    actorId?: string | null;
    taskId?: string | null;
    characterId?: string | null;
    approvalId?: string | null;
    artifactId?: string | null;
    message?: string | null;
    recipientCharacterId?: string | null;
    notificationType?: string | null;
  };
  requestedByCharacterId?: string | null;
  queuedAt?: string;
  traceId?: string | null;
  idempotencyKey?: string | null;
};

export type WorkerHandlerResult = {
  ok: true;
  handler: QueueName;
  processedAt: string;
  summary: string;
};

// ── Shared event log helper ───────────────────────────────────────────────────

async function logEvent(opts: {
  entityType: string;
  entityId: string;
  eventType: string;
  previousState?: string | null;
  nextState?: string | null;
  changedBy: string;
  comment?: string | null;
  relatedTaskId?: string | null;
  relatedProjectId?: string | null;
  now: string;
}) {
  const sb = getDb();
  await sb.from("event_logs").insert({
    entity_type: opts.entityType,
    entity_id: opts.entityId,
    event_type: opts.eventType,
    previous_state: opts.previousState ?? null,
    next_state: opts.nextState ?? null,
    changed_by: opts.changedBy,
    changed_at: opts.now,
    comment: opts.comment ?? null,
    related_task_id: opts.relatedTaskId ?? null,
    related_project_id: opts.relatedProjectId ?? null,
  });
}

// ── grantExperience ───────────────────────────────────────────────────────────

async function grantExperience(
  characterId: string,
  priority: string,
  hasAiOutput: boolean,
  taskId: string,
  now: string,
): Promise<void> {
  const sb = getDb();
  try {
    const { data: char } = await sb
      .from("characters")
      .select("total_experience, current_level, level_experience, total_tasks_done")
      .eq("id", characterId)
      .single();

    if (!char) return;

    const gained = calcTaskExperience(priority, hasAiOutput);
    const totalExp = ((char.total_experience as number) ?? 0) + gained;
    let level = (char.current_level as number) ?? 1;
    let levelExp = ((char.level_experience as number) ?? 0) + gained;
    let leveledUp = false;

    while (levelExp >= expRequiredForLevel(level)) {
      levelExp -= expRequiredForLevel(level);
      level++;
      leveledUp = true;
    }

    await sb.from("characters").update({
      total_experience: totalExp,
      current_level: level,
      level_experience: levelExp,
      total_tasks_done: ((char.total_tasks_done as number) ?? 0) + 1,
      updated_at: now,
    }).eq("id", characterId);

    if (leveledUp) {
      void publishWorldEvent("character_levelup", {
        characterId,
        newLevel: level,
        gainedExp: gained,
        taskId,
      });
    }
  } catch {
    // Non-fatal: columns may not exist yet if migration hasn't been applied
  }
}

// ── workflow-transitions ──────────────────────────────────────────────────────
// Auto-advance stale Assigned → Accepted → InProgress

async function processWorkflowTransitions(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const sb = getDb();
  const taskId = (jobData.payload?.input?.["taskId"] as string | undefined)
    ?? jobData.payload?.taskId
    ?? null;

  const now = new Date().toISOString();
  let advanced = 0;

  const advance = async (id: string, from: TaskState, to: TaskState, meta?: { characterId?: string | null; taskTitle?: string | null }) => {
    await sb.from("tasks").update({ state: to, updated_at: now }).eq("id", id);
    await logEvent({
      entityType: "task", entityId: id,
      eventType: "task.state.changed",
      previousState: from, nextState: to,
      changedBy: "worker:workflow-transitions",
      relatedTaskId: id, now,
    });
    void publishWorldEvent("task_state_changed", { taskId: id, from, to, ...(meta ?? {}) });
    advanced++;
  };

  if (taskId) {
    const { data: task } = await sb
      .from("tasks")
      .select("id, title, state, assignee_character_id")
      .eq("id", taskId)
      .single();

    if (task?.state === TaskState.Todo) {
      await advance(task.id, TaskState.Todo, TaskState.InProgress, { characterId: task.assignee_character_id as string | null, taskTitle: task.title as string | null });
    } else if (task?.state === TaskState.InProgress) {
      await advance(task.id, TaskState.InProgress, TaskState.InReview, { characterId: task.assignee_character_id as string | null, taskTitle: task.title as string | null });
    }
  } else {
    // Batch: advance tasks stale >5 min
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: assignedTasks } = await sb
      .from("tasks")
      .select("id, state")
      .eq("state", "Todo")
      .lt("updated_at", staleThreshold)
      .not("assignee_character_id", "is", null)
      .limit(20);

    for (const task of assignedTasks ?? []) {
      await advance(task.id, TaskState.Todo, TaskState.InProgress);
    }
  }

  return {
    ok: true,
    handler: QUEUE_NAMES.workflowTransitions,
    processedAt: now,
    summary: `advanced ${advanced} task(s)`,
  };
}

// ── ai-actions ────────────────────────────────────────────────────────────────
// Execute AI task via routeAI, save artifact, advance state to PendingReview

async function processAiActions(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const sb = getDb();
  const taskId = (jobData.payload?.input?.["taskId"] as string | undefined)
    ?? jobData.payload?.taskId;

  if (!taskId) throw new Error("ai-actions: taskId is required");

  const now = new Date().toISOString();

  const { data: task, error: taskErr } = await sb
    .from("tasks")
    .select("id, title, description, task_type, state, assignee_character_id, project_id, reviewer_character_id, feedback_history, revision_count")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) throw new Error(`ai-actions: task ${taskId} not found`);

  // In-process dedup — prevents the tick engine from dispatching the same task twice
  if (activeTaskIds.has(taskId)) {
    return { ok: true, handler: QUEUE_NAMES.aiActions, processedAt: now, summary: "skipped: task already in-flight" };
  }
  activeTaskIds.add(taskId);

  try {
    return await runAiTask({ jobData, taskId, task, now });
  } finally {
    activeTaskIds.delete(taskId);
  }
}

async function runAiTask({ jobData, taskId, task, now }: {
  jobData: WorkerJobPayload;
  taskId: string;
  task: Record<string, unknown>;
  now: string;
}): Promise<WorkerHandlerResult> {
  const sb = getDb();

  const characterId: string = (jobData.payload?.input?.["characterId"] as string | undefined)
    ?? jobData.payload?.characterId
    ?? (task.assignee_character_id as string | null)
    ?? "";

  if (!characterId) throw new Error("ai-actions: characterId is required");

  const { data: character } = await sb
    .from("characters")
    .select("name, code_name, persona_summary")
    .eq("id", characterId)
    .single();

  // Retrieve relevant memories for RAG context
  const memoryCtx = await buildMemoryContext({
    characterId,
    query: `${task.title} ${task.description ?? ""}`.trim(),
    topK: 5,
    threshold: 0.6,
  }).catch(() => ({ contextBlock: "", memoryCount: 0, tokenEstimate: 0 }));

  // ① Persona layer
  const basePersona = character?.persona_summary
    ? `You are ${character.name} (${character.code_name}). ${character.persona_summary}`
    : `You are a professional working on a task.`;

  // ② Runtime state layer
  const { data: runtime } = await sb
    .from("character_runtime_states")
    .select("workload_score, fatigue_score, burnout_triggered, activity_status")
    .eq("character_id", characterId)
    .single();

  let stateLayer = "";
  if (runtime) {
    stateLayer = `\n현재 상태: 업무량 ${runtime.workload_score}/100, 피로도 ${runtime.fatigue_score}/100.`;
    if (runtime.burnout_triggered) {
      stateLayer += " ⚠️ 번아웃 상태입니다 — 핵심만 간결하게 작성하세요.";
    } else if ((runtime.fatigue_score as number) > 70) {
      stateLayer += " 피로가 높습니다 — 효율적으로 작업하세요.";
    }
  }

  // ③ RAG memory layer (already built above)
  // ④ 이전 피드백 이력 주입
  const feedbacks = Array.isArray(task.feedback_history)
    ? (task.feedback_history as Array<{ comment: string; revision: number }>)
    : [];
  let feedbackContext = "";
  if (feedbacks.length > 0) {
    const latest = feedbacks[feedbacks.length - 1]!;
    feedbackContext = `\n\n[이전 피드백 — 수정 ${latest.revision}회차]\n${latest.comment}\n위 피드백을 반드시 반영하여 개선된 결과물을 작성하세요.`;
  }

  const taskTemplate = TASK_TEMPLATES[task.task_type as string ?? ""] ?? "";

  // Web search grounding — research/strategy/marketing 태스크에만 적용
  const SEARCH_TASK_TYPES = new Set([
    "market_research", "research_summary", "data_analysis",
    "strategy_memo", "marketing_copy", "online_content", "proposal_draft",
  ]);
  let searchContext = "";
  if (SEARCH_TASK_TYPES.has((task.task_type as string ?? "").toLowerCase())) {
    try {
      const searchQuery = deriveSearchQuery(task.title as string, task.task_type as string);
      const searchRes = await searchWeb(searchQuery, 5);
      if (searchRes.results.length > 0) {
        searchContext = buildSearchContext(searchRes.results);
        console.log(`[worker:ai-actions] web search: "${searchQuery}" → ${searchRes.results.length} results`);
      }
    } catch {
      // Non-fatal: proceed without search context
    }
  }

  const systemPrompt = [basePersona, stateLayer, taskTemplate, memoryCtx.contextBlock, searchContext, feedbackContext]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt = [
    `Task: ${task.title}`,
    task.description ? `Description: ${task.description}` : "",
    `Complete this task professionally and thoroughly.`,
  ].filter(Boolean).join("\n");

  // Image generation tasks bypass text AI and call generateImage directly
  const IMAGE_TASK_TYPES = new Set(["image_production", "media_pipeline"]);
  if (IMAGE_TASK_TYPES.has((task.task_type as string ?? "").toLowerCase())) {
    const imgResult = await generateImage({ prompt: userPrompt }).catch(() => null);
    const imgContent = imgResult?.ok
      ? (imgResult.imageUrl
          ? `![Generated Image](${imgResult.imageUrl})\n\n*Provider: ${imgResult.provider} | Model: ${imgResult.modelUsed}*`
          : `![Generated Image](data:${imgResult.mimeType};base64,${imgResult.imageBase64 ?? ""})\n\n*Provider: ${imgResult.provider} | Model: ${imgResult.modelUsed}*`)
      : `## Image Generation Failed\n\nProvider: ${imgResult?.provider ?? "none"} — Error: ${imgResult?.errorCode ?? "unknown"}\n\nPlease set one of: OPENAI_API_KEY, GOOGLE_AI_API_KEY, STABILITY_API_KEY, FAL_KEY, IDEOGRAM_API_KEY`;

    await sb.from("artifacts").insert({
      task_id: taskId,
      project_id: task.project_id,
      author_character_id: characterId,
      artifact_type: "image",
      title: `Image: ${task.title}`,
      content_markdown: imgContent,
      status: "Draft",
      created_at: now,
      updated_at: now,
    });
    await sb.from("tasks").update({ state: TaskState.InReview, updated_at: now }).eq("id", taskId);
    await logEvent({
      entityType: "task", entityId: taskId,
      eventType: "task.state.changed",
      previousState: task.state as string, nextState: TaskState.InReview,
      changedBy: `worker:ai-actions:${characterId}`,
      relatedTaskId: taskId, relatedProjectId: task.project_id as string | null, now,
    });
    return { ok: true, handler: QUEUE_NAMES.aiActions, processedAt: now, summary: `image generated via ${imgResult?.provider ?? "none"}` };
  }

  const traceId = jobData.traceId ?? `ai_${taskId}_${Date.now()}`;
  const runtimeResult = await globalRuntimeEngine.execute({
    toolName: "ai.task.execute",
    input: {
      characterId,
      taskType: task.task_type ?? "character_action",
      prompt: userPrompt,
      systemPrompt,
    },
    requestedByCharacterId: characterId,
    taskId,
    traceId,
  });

  if (runtimeResult.status !== "executed" || !runtimeResult.output) {
    throw new Error(`ai-actions: runtime denied or failed — ${runtimeResult.errorMessage ?? runtimeResult.status}`);
  }

  const aiResult = runtimeResult.output as { output: string; modelUsed: string; tokensUsed: number; costUsd: number };

  // Save artifact (schema: content_markdown, not content)
  const { data: artifact } = await sb
    .from("artifacts")
    .insert({
      task_id: taskId,
      project_id: task.project_id,
      author_character_id: characterId,
      artifact_type: task.task_type ?? "document",
      title: `AI Output: ${task.title}`,
      content_markdown: aiResult.output,
      status: "Draft",
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  // Save ai_output on task
  await sb.from("tasks").update({
    ai_output: {
      text: aiResult.output,
      modelUsed: aiResult.modelUsed,
      tokensUsed: aiResult.tokensUsed,
      costUsd: aiResult.costUsd,
      savedAt: now,
    },
    updated_at: now,
  }).eq("id", taskId);

  // Store post-task memory for future RAG retrieval
  const memorySummary = deriveMemorySummary({
    taskTitle: task.title as string,
    taskType: (task.task_type as string | null) ?? "general",
    aiOutputSnippet: aiResult.output as string,
    characterName: (character?.name as string | undefined) ?? characterId,
  });

  await createMemory({
    memoryScope: "character",
    scopeEntityId: characterId,
    memoryType: "lesson",
    summary: memorySummary,
    importanceScore: 0.6,
    decayPolicy: "medium",
    sourceEventId: taskId,
    characterIds: [characterId],
    visibilityLevel: "private",
  }).catch((err: Error) => {
    // Non-fatal: memory storage failure should not block task completion
    console.warn("[worker:ai-actions] memory store failed:", err.message);
  });

  // AI 스팬 기록 — model/token/cost OTel 호환 속성
  await logEvent({
    entityType: "ai_span", entityId: taskId,
    eventType: "ai.span.completed",
    changedBy: `worker:ai-actions:${characterId}`,
    comment: JSON.stringify({
      traceId,
      model: aiResult.modelUsed,
      tokensUsed: aiResult.tokensUsed,
      costUsd: aiResult.costUsd,
      durationMs: Date.now() - new Date(now).getTime(),
    }),
    relatedTaskId: taskId, relatedProjectId: task.project_id as string | null, now,
  });

  // AI 완료 → 항상 InReview로 전환 (Assigned/Todo/InProgress 모두 처리)
  const prevState = task.state as string;
  await sb.from("tasks").update({ state: TaskState.InReview, updated_at: now }).eq("id", taskId);
  await logEvent({
    entityType: "task", entityId: taskId,
    eventType: "task.state.changed",
    previousState: prevState, nextState: TaskState.InReview,
    changedBy: `worker:ai-actions:${characterId}`,
    relatedTaskId: taskId, relatedProjectId: task.project_id as string | null, now,
  });
  void publishWorldEvent("task_state_changed", {
    taskId,
    characterId,
    taskTitle: task.title,
    from: prevState,
    to: TaskState.InReview,
  });

  // 리뷰어에게 REVIEW_REQUEST 메시지 발송
  const reviewerCharId = (task.reviewer_character_id as string | null) ?? null;
  const targetReviewer = reviewerCharId ?? await findAvailableReviewer(characterId, task.project_id as string);
  if (targetReviewer && targetReviewer !== characterId) {
    await sendAgentMessage({
      fromCharId: characterId,
      toCharId: targetReviewer,
      messageType: "REVIEW_REQUEST",
      content: `"${(task.title as string).slice(0, 28)}" 작업 완료! 리뷰 부탁드려요 🙏`,
      relatedTaskId: taskId,
      now,
    });
  }

  return {
    ok: true,
    handler: QUEUE_NAMES.aiActions,
    processedAt: now,
    summary: `AI task done: ${aiResult.modelUsed}, ${aiResult.tokensUsed} tokens, artifact ${artifact?.id ?? "n/a"}`,
  };
} // end runAiTask

// ── approvals ─────────────────────────────────────────────────────────────────
// L0 auto-approve; L1–Founder: ranked approver assignment + 5-min timeout chain.
// Each approval record represents ONE level. On approval, if the task's priority
// requires a higher level, a new approval record is created (multi-record chain).

const APPROVAL_LEVEL_ORDER = ["L0", "L1", "L2", "L3", "Founder"] as const;
type ALevel = (typeof APPROVAL_LEVEL_ORDER)[number];

function levelIndex(l: string): number {
  return APPROVAL_LEVEL_ORDER.indexOf(l as ALevel);
}

function nextApprovalLevel(current: string): ALevel | null {
  const idx = levelIndex(current);
  if (idx < 0 || idx >= APPROVAL_LEVEL_ORDER.length - 1) return null;
  return APPROVAL_LEVEL_ORDER[idx + 1]!;
}

function maxLevelForPriority(priority: string | null | undefined): ALevel {
  switch (priority) {
    case "P0": return "Founder";
    case "P1": return "L3";
    case "P2": return "L2";
    case "P3": return "L1";
    case "P4": return "L0";
    default: return "L1";
  }
}

// Rank name → approval level (doc 11 P0 fix #2: L1=Manager, L2=GM, L3=Director/C-Level)
const RANK_TO_LEVEL: Record<string, ALevel> = {
  "Lead": "L1", "Senior": "L1", "Mid-level": "L1",
  "General Manager": "L2", "Director": "L2",
  "VP": "L3", "CEO": "L3",
};

async function findApproverForLevel(
  sb: ReturnType<typeof getDb>,
  level: ALevel,
  excludeCharId?: string | null,
): Promise<string | null> {
  if (level === "L0") return null;
  if (level === "Founder") return "char_founder";

  const targetRanks = Object.entries(RANK_TO_LEVEL)
    .filter(([, v]) => v === level)
    .map(([k]) => k);

  const { data: chars } = await sb
    .from("characters")
    .select("id, ranks(name), character_runtime_states(workload_score, burnout_triggered)")
    .eq("active_flag", true);

  const candidate = (chars ?? [])
    .filter(c => {
      if (excludeCharId && c.id === excludeCharId) return false;
      const rankName = Array.isArray(c.ranks)
        ? (c.ranks[0] as { name: string } | undefined)?.name
        : (c.ranks as { name: string } | null)?.name;
      return targetRanks.includes(rankName ?? "");
    })
    .map(c => {
      const rt = Array.isArray(c.character_runtime_states)
        ? (c.character_runtime_states[0] as { workload_score?: number; burnout_triggered?: boolean } | undefined)
        : (c.character_runtime_states as { workload_score?: number; burnout_triggered?: boolean } | null);
      return { id: c.id as string, workload: rt?.workload_score ?? 0, burnout: rt?.burnout_triggered ?? false };
    })
    .filter(c => !c.burnout && c.workload < 80)
    .sort((a, b) => a.workload - b.workload)[0];

  return candidate?.id ?? null;
}

async function advanceApprovalChain(opts: {
  sb: ReturnType<typeof getDb>;
  approval: { id: string; target_id: string; required_level: string };
  task: { priority: string | null; ai_output: unknown; assignee_character_id: string | null; title?: string | null };
  actor: string;
  now: string;
}): Promise<"chained" | "done"> {
  const { sb, approval, task, actor, now } = opts;
  const currentLevel = approval.required_level as ALevel;
  const maxLevel = maxLevelForPriority(task.priority);

  // Mark this level as approved
  await sb.from("approvals").update({ state: "Approved", decided_at: now }).eq("id", approval.id);
  await logEvent({
    entityType: "approval", entityId: approval.id,
    eventType: "approval.approved",
    previousState: "Pending", nextState: "Approved",
    changedBy: actor,
    comment: `${currentLevel} approved`,
    relatedTaskId: approval.target_id, now,
  });

  // Determine if next level is required
  if (levelIndex(currentLevel) < levelIndex(maxLevel)) {
    const next = nextApprovalLevel(currentLevel);
    if (next) {
      const nextApproverId = await findApproverForLevel(sb, next);
      const nextId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await sb.from("approvals").insert({
        id: nextId,
        target_type: "task",
        target_id: approval.target_id,
        required_level: next,
        state: "Pending",
        approver_id: nextApproverId,
        created_at: now,
      });
      await logEvent({
        entityType: "approval", entityId: nextId,
        eventType: "approval.chain_advanced",
        previousState: null, nextState: "Pending",
        changedBy: actor,
        comment: `Advanced from ${currentLevel} → ${next} (max: ${maxLevel})`,
        relatedTaskId: approval.target_id, now,
      });
      return "chained";
    }
  }

  // All levels approved → complete task
  await sb.from("tasks").update({ state: "Done", updated_at: now }).eq("id", approval.target_id);
  void publishWorldEvent("task_state_changed", { taskId: approval.target_id, characterId: task.assignee_character_id, taskTitle: task.title, from: "InReview", to: "Done" });
  if (task.assignee_character_id) {
    void grantExperience(task.assignee_character_id, task.priority ?? "P3", !!task.ai_output, approval.target_id, now);
  }
  return "done";
}

async function processApprovals(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const sb = getDb();
  const approvalId = (jobData.payload?.input?.["approvalId"] as string | undefined)
    ?? jobData.payload?.approvalId;
  const taskId = (jobData.payload?.input?.["taskId"] as string | undefined)
    ?? jobData.payload?.taskId;

  if (!approvalId && !taskId) throw new Error("approvals: approvalId or taskId is required");

  const now = new Date().toISOString();

  const baseQuery = sb.from("approvals").select("id, target_id, required_level, state, approver_id, created_at");
  const { data: approval } = approvalId
    ? await baseQuery.eq("id", approvalId).single()
    : await baseQuery.eq("target_id", taskId!).eq("state", "Pending").order("created_at").limit(1).single();

  if (!approval) {
    return { ok: true, handler: QUEUE_NAMES.approvals, processedAt: now, summary: "no pending approval found" };
  }

  const level = (approval.required_level as string) ?? "L1";
  const { data: task } = await sb
    .from("tasks")
    .select("priority, ai_output, assignee_character_id, title")
    .eq("id", approval.target_id as string)
    .single();

  // L0: auto-approve immediately
  if (level === "L0") {
    const result = await advanceApprovalChain({
      sb, approval: approval as { id: string; target_id: string; required_level: string },
      task: { priority: task?.priority as string ?? null, ai_output: task?.ai_output, assignee_character_id: task?.assignee_character_id as string ?? null, title: task?.title as string ?? null },
      actor: "worker:approvals:auto", now,
    });
    return { ok: true, handler: QUEUE_NAMES.approvals, processedAt: now, summary: `L0 auto-approved ${approval.id} → ${result}` };
  }

  // L1+: assign approver if missing
  if (!approval.approver_id) {
    const assignee = await findApproverForLevel(sb, level as ALevel);
    if (assignee) {
      await sb.from("approvals").update({ approver_id: assignee }).eq("id", approval.id);
      await logEvent({
        entityType: "approval", entityId: approval.id as string,
        eventType: "approval.approver_assigned",
        changedBy: "worker:approvals",
        comment: `${level} approver assigned: ${assignee}`,
        relatedTaskId: approval.target_id as string, now,
      });
      return { ok: true, handler: QUEUE_NAMES.approvals, processedAt: now, summary: `${level} approver assigned: ${assignee}` };
    }
  }

  // L1+: escalate if current approver is overloaded/burnt out
  if (approval.approver_id) {
    const { data: runtime } = await sb
      .from("character_runtime_states")
      .select("burnout_triggered, workload_score")
      .eq("character_id", approval.approver_id)
      .single();

    const isOverloaded = ((runtime?.workload_score as number) ?? 0) > 80;
    const isBurnout = (runtime?.burnout_triggered as boolean) ?? false;

    if (isBurnout || isOverloaded) {
      const substitute = await findApproverForLevel(sb, level as ALevel, approval.approver_id as string);
      if (substitute) {
        await sb.from("approvals").update({ approver_id: substitute }).eq("id", approval.id);
        await logEvent({
          entityType: "approval", entityId: approval.id as string,
          eventType: "approval.approver_escalated",
          changedBy: "worker:approvals",
          comment: `Escalated from ${approval.approver_id} (overloaded) → ${substitute}`,
          relatedTaskId: approval.target_id as string, now,
        });
        return { ok: true, handler: QUEUE_NAMES.approvals, processedAt: now, summary: `Escalated to ${substitute}` };
      }
    }
  }

  // L1+ 5분 초과 → 자동 승인 후 체인 진행
  const pendingTooLong = new Date(approval.created_at as string) < new Date(Date.now() - 5 * 60 * 1000);
  if (pendingTooLong) {
    const result = await advanceApprovalChain({
      sb, approval: approval as { id: string; target_id: string; required_level: string },
      task: { priority: task?.priority as string ?? null, ai_output: task?.ai_output, assignee_character_id: task?.assignee_character_id as string ?? null },
      actor: "worker:approvals:timeout", now,
    });
    return { ok: true, handler: QUEUE_NAMES.approvals, processedAt: now, summary: `${level} timeout → ${result}` };
  }

  return {
    ok: true, handler: QUEUE_NAMES.approvals, processedAt: now,
    summary: `approval ${approval.id} checked, awaiting ${level} review`,
  };
}

// ── artifact-postprocess ──────────────────────────────────────────────────────
// Quality check: word count, update artifact status

async function processArtifactPostprocess(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const sb = getDb();
  const artifactId = (jobData.payload?.input?.["artifactId"] as string | undefined)
    ?? jobData.payload?.artifactId;

  if (!artifactId) throw new Error("artifact-postprocess: artifactId is required");

  const now = new Date().toISOString();

  const { data: artifact, error } = await sb
    .from("artifacts")
    .select("id, content_markdown, artifact_type, status")
    .eq("id", artifactId)
    .single();

  if (error || !artifact) throw new Error(`artifact-postprocess: artifact ${artifactId} not found`);

  const text = typeof artifact.content_markdown === "string" ? artifact.content_markdown : "";
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  const MIN_WORDS: Record<string, number> = {
    prd_draft: 200, research_summary: 150,
    planningDocument: 100, marketing_copy: 50, default: 30,
  };

  const minWords = MIN_WORDS[artifact.artifact_type as string] ?? MIN_WORDS["default"]!;
  const qualityStatus = wordCount >= minWords ? "Submitted" : "Draft";

  await sb.from("artifacts").update({ status: qualityStatus, updated_at: now }).eq("id", artifactId);

  await logEvent({
    entityType: "artifact", entityId: artifactId,
    eventType: "artifact.quality_checked",
    changedBy: "worker:artifact-postprocess",
    comment: `wordCount=${wordCount}, status=${qualityStatus}`,
    now,
  });

  return {
    ok: true,
    handler: QUEUE_NAMES.artifactPostprocess,
    processedAt: now,
    summary: `artifact ${artifactId}: ${wordCount} words → ${qualityStatus}`,
  };
}

// ── analytics-rollups ─────────────────────────────────────────────────────────
// Compute workload/fatigue per character from active task counts

async function processAnalyticsRollups(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const sb = getDb();
  const characterId = (jobData.payload?.input?.["characterId"] as string | undefined)
    ?? jobData.payload?.characterId;

  const now = new Date().toISOString();
  let updated = 0;

  const activeStates = [TaskState.Todo, TaskState.InProgress, TaskState.InReview] as string[];

  const rollupCharacter = async (charId: string, currentFatigue: number) => {
    const { count } = await sb
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_character_id", charId)
      .in("state", activeStates);

    const activeCount = count ?? 0;
    const workloadScore = Math.min(100, activeCount * 15);
    const newFatigue = workloadScore > 70
      ? Math.min(100, currentFatigue + 5)
      : Math.max(0, currentFatigue - 2);
    const burnoutTriggered = newFatigue >= 90 && workloadScore >= 80;

    await sb.from("character_runtime_states").update({
      workload_score: workloadScore,
      fatigue_score: newFatigue,
      burnout_triggered: burnoutTriggered,
      updated_at: now,
    }).eq("character_id", charId);

    void publishWorldEvent("runtime_update", {
      characterId: charId,
      workload_score: workloadScore,
      fatigue_score: newFatigue,
      burnout_triggered: burnoutTriggered,
      current_task_count: activeCount,
    });
    updated++;
  };

  if (characterId) {
    const { data: rt } = await sb
      .from("character_runtime_states")
      .select("fatigue_score")
      .eq("character_id", characterId)
      .single();
    await rollupCharacter(characterId, (rt?.fatigue_score as number) ?? 0);
  } else {
    const { data: allRuntimes } = await sb
      .from("character_runtime_states")
      .select("character_id, fatigue_score");

    for (const rt of allRuntimes ?? []) {
      await rollupCharacter(rt.character_id, (rt.fatigue_score as number) ?? 0);
    }
  }

  return {
    ok: true,
    handler: QUEUE_NAMES.analyticsRollups,
    processedAt: now,
    summary: `updated runtime stats for ${updated} character(s)`,
  };
}

// ── notifications ─────────────────────────────────────────────────────────────
// Log to event_logs, console output

async function processNotifications(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  // agent-messages 처리 액션 분기
  if (jobData.payload?.input?.["action"] === "processAgentMessages") {
    return processAgentMessages(jobData);
  }

  const now = new Date().toISOString();

  const message = (jobData.payload?.input?.["message"] as string | undefined)
    ?? jobData.payload?.message ?? "No message";
  const recipientId = (jobData.payload?.input?.["recipientCharacterId"] as string | undefined)
    ?? jobData.payload?.recipientCharacterId ?? null;
  const notificationType = (jobData.payload?.input?.["notificationType"] as string | undefined)
    ?? jobData.payload?.notificationType ?? "info";
  const entityId = (jobData.payload?.input?.["entityId"] as string | undefined) ?? "system";
  const entityType = (jobData.payload?.input?.["entityType"] as string | undefined) ?? "system";

  console.log(`[worker:notifications] ${notificationType} → ${recipientId ?? "broadcast"}: ${message}`);

  await logEvent({
    entityType,
    entityId,
    eventType: `notification.${notificationType}`,
    changedBy: jobData.requestedByCharacterId ?? "worker:notifications",
    comment: `${message}${recipientId ? ` → ${recipientId}` : ""}`,
    now,
  });

  return {
    ok: true,
    handler: QUEUE_NAMES.notifications,
    processedAt: now,
    summary: `${notificationType} notification dispatched to ${recipientId ?? "broadcast"}`,
  };
}

// ── monthly-report ────────────────────────────────────────────────────────────

async function processMonthlyReport(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const input = jobData.payload?.input ?? {};
  const year = (input["year"] as number | undefined) ?? new Date().getUTCFullYear();
  const month = (input["month"] as number | undefined) ?? new Date().getUTCMonth() + 1;

  const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const endDate = new Date(Date.UTC(year, month, 1)).toISOString();

  const sb = getDb();

  const [tasksRes, projectsRes] = await Promise.all([
    sb.from("tasks")
      .select("state, virtual_cost_consumed")
      .gte("created_at", startDate)
      .lt("created_at", endDate),
    sb.from("projects")
      .select("api_cost_accumulated")
      .gte("created_at", startDate)
      .lt("created_at", endDate),
  ]);

  const tasks = (tasksRes.data ?? []) as Array<{ state: string; virtual_cost_consumed: number }>;
  const taskCount = tasks.length;
  const completedCount = tasks.filter((t) => t.state === "Done").length;
  const taskCostSum = tasks.reduce((s, t) => s + (t.virtual_cost_consumed ?? 0), 0);

  const projects = (projectsRes.data ?? []) as Array<{ api_cost_accumulated: number }>;
  const projectCostSum = projects.reduce((s, p) => s + (p.api_cost_accumulated ?? 0), 0);
  const totalApiCostUsd = taskCostSum + projectCostSum;

  const { error } = await sb.from("monthly_reports").upsert(
    { year, month, total_api_cost_usd: totalApiCostUsd, task_count: taskCount, completed_count: completedCount },
    { onConflict: "year,month" }
  );

  if (error) throw new Error(`monthly_reports upsert failed: ${error.message}`);

  const now = new Date().toISOString();
  return {
    ok: true,
    handler: QUEUE_NAMES.monthlyReport,
    processedAt: now,
    summary: `${year}-${month}: ${taskCount} tasks, $${totalApiCostUsd.toFixed(4)} cost`,
  };
}

// ── collab-synthesis ──────────────────────────────────────────────────────────
// 프로젝트 전체 태스크 완료 후 모든 아티팩트를 종합하여 마스터 리포트 생성.
// 웹 서치 결과도 포함하면 출처 있는 종합 분석 리포트가 만들어진다.

async function processCollabSynthesis(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const sb = getDb();
  const projectId = jobData.payload?.input?.["projectId"] as string | undefined;
  if (!projectId) throw new Error("collab-synthesis: projectId is required");

  const now = new Date().toISOString();

  // 1. 프로젝트 정보
  const { data: project } = await sb
    .from("projects")
    .select("title, brief, state")
    .eq("id", projectId)
    .single();

  if (!project) throw new Error(`collab-synthesis: project ${projectId} not found`);

  // 2. 이미 마스터 리포트가 있으면 스킵
  const { data: existing } = await sb
    .from("artifacts")
    .select("id")
    .eq("project_id", projectId)
    .eq("artifact_type", "synthesis_report")
    .limit(1)
    .single();

  if (existing) {
    return { ok: true, handler: QUEUE_NAMES.collabSynthesis, processedAt: now, summary: "already synthesized" };
  }

  // 3. 완료된 모든 아티팩트 수집
  const { data: artifacts } = await sb
    .from("artifacts")
    .select("title, content_markdown, artifact_type, author_character_id")
    .eq("project_id", projectId)
    .in("status", ["Submitted", "Draft"])
    .neq("artifact_type", "synthesis_report")
    .order("created_at");

  if (!artifacts || artifacts.length === 0) {
    return { ok: true, handler: QUEUE_NAMES.collabSynthesis, processedAt: now, summary: "no artifacts to synthesize" };
  }

  // 4. 아티팩트 컨텐츠 조합 (각 팀원 결과물)
  const artifactBlocks = (artifacts as Array<{ title: string; content_markdown: string; artifact_type: string; author_character_id: string }>)
    .map((a, i) => `## [${i + 1}] ${a.title} (${a.artifact_type})\n${(a.content_markdown ?? "").slice(0, 3000)}`)
    .join("\n\n---\n\n");

  // 5. 프로젝트 주제로 보완 웹 서치
  let searchContext = "";
  try {
    const searchRes = await searchWeb(project.title as string, 4);
    if (searchRes.results.length > 0) {
      searchContext = buildSearchContext(searchRes.results);
    }
  } catch { /* non-fatal */ }

  // 6. 대표 캐릭터 선정 (PM 역할)
  const { data: chars } = await sb
    .from("characters")
    .select("id, divisions(division_type)")
    .eq("active_flag", true)
    .limit(20);

  type CharRow2 = { id: string; divisions: { division_type?: string } | null };
  const typedChars = (chars ?? []) as CharRow2[];
  const pmChar = typedChars.find(c => {
    const dt = (c.divisions?.division_type ?? "").toLowerCase();
    return dt.includes("exec") || dt.includes("strategy") || dt.includes("management");
  }) ?? typedChars[0];

  if (!pmChar) throw new Error("collab-synthesis: no character available");

  // 7. 종합 AI 호출
  const systemPrompt = [
    "당신은 프로젝트의 최종 종합 보고서를 작성하는 시니어 애널리스트입니다.",
    "팀 전체의 작업 결과물과 최신 웹 정보를 통합하여 출처가 명확한 종합 리포트를 작성합니다.",
    "리포트는 한국어로 작성하되, 핵심 인사이트를 먼저 제시하고 세부 분석을 뒷받침하세요.",
    searchContext,
  ].filter(Boolean).join("\n\n");

  const userPrompt = [
    `프로젝트명: ${project.title}`,
    project.brief ? `의뢰 내용: ${project.brief}` : "",
    "",
    "아래는 팀 각 멤버가 작업한 결과물입니다. 이것들을 통합하여 체계적인 종합 리포트를 작성해주세요:",
    "",
    artifactBlocks,
    "",
    "종합 리포트 구성:",
    "1. 핵심 요약 (Executive Summary)",
    "2. 주요 발견사항 및 인사이트",
    "3. 각 분야별 세부 내용 통합",
    "4. 실행 제안 및 다음 단계",
    "5. 출처 및 참고자료 (웹 서치 결과 활용)",
  ].filter(Boolean).join("\n");

  const aiResult = await routeAI({
    characterId: pmChar.id,
    taskType: "research_summary",
    prompt: userPrompt,
    systemPrompt,
    maxTokens: 4000,
  });

  // 8. 마스터 아티팩트 저장
  const { data: masterArtifact } = await sb
    .from("artifacts")
    .insert({
      project_id: projectId,
      author_character_id: pmChar.id,
      artifact_type: "synthesis_report",
      title: `[종합 리포트] ${project.title}`,
      content_markdown: aiResult.output as string,
      status: "Submitted",
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  await logEvent({
    entityType: "project", entityId: projectId,
    eventType: "project.synthesis_complete",
    changedBy: `worker:collab-synthesis`,
    comment: `${artifacts.length}개 아티팩트 통합 → 종합 리포트 생성 (${masterArtifact?.id ?? ""})`,
    relatedProjectId: projectId, now,
  });

  // 9. 프로젝트 상태를 Done으로 업데이트
  await sb.from("projects").update({ state: "Done", updated_at: now }).eq("id", projectId);

  return {
    ok: true,
    handler: QUEUE_NAMES.collabSynthesis,
    processedAt: now,
    summary: `synthesized ${artifacts.length} artifacts → master report ${masterArtifact?.id ?? "n/a"}`,
  };
}

// ── Handler map ───────────────────────────────────────────────────────────────

const handlerMap: Record<QueueName, (jobData: WorkerJobPayload) => Promise<WorkerHandlerResult>> = {
  [QUEUE_NAMES.workflowTransitions]: processWorkflowTransitions,
  [QUEUE_NAMES.aiActions]: processAiActions,
  [QUEUE_NAMES.approvals]: processApprovals,
  [QUEUE_NAMES.artifactPostprocess]: processArtifactPostprocess,
  [QUEUE_NAMES.analyticsRollups]: processAnalyticsRollups,
  [QUEUE_NAMES.notifications]: processNotifications,
  [QUEUE_NAMES.founderMessage]: processFounderMessage,
  [QUEUE_NAMES.orchestrate]: processOrchestrate,
  [QUEUE_NAMES.monthlyReport]: processMonthlyReport,
  [QUEUE_NAMES.collabSynthesis]: processCollabSynthesis,
};

export async function runQueueHandler(queueName: QueueName, jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const handler = handlerMap[queueName];
  if (!handler) throw new Error(`No handler registered for queue: ${queueName}`);
  return handler(jobData);
}

// ── founder-message ───────────────────────────────────────────────────────────

async function processFounderMessage(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const characterId = jobData.payload?.characterId as string | undefined;
  const message = jobData.payload?.message as string | undefined;

  if (!characterId || !message) throw new Error("founder-message: characterId and message are required");

  const sb = getDb();
  const { data: char } = await sb
    .from("characters")
    .select("id, name, persona_summary, ai_enabled")
    .eq("id", characterId)
    .single();

  if (!char || (char.ai_enabled as boolean) === false) {
    return { ok: true, handler: QUEUE_NAMES.founderMessage, processedAt: new Date().toISOString(), summary: "ai disabled or char not found" };
  }

  const result = await routeAI({
    characterId,
    taskType: "founder_message",
    prompt: `파운더로부터 메시지를 받았습니다: "${message}"\n\n${(char.persona_summary as string) ?? ""}\n\n파운더에게 자연스럽게 답변하세요. (40자 이내, 따옴표 없이)`,
    systemPrompt: "당신은 AI 회사 직원입니다. 간결하고 자연스럽게 한 문장으로만 답하세요.",
    maxTokens: 100,
  });

  const reply = ((result.output ?? "") as string).trim().slice(0, 60);

  if (reply) {
    void publishWorldEvent("character_bubble", {
      characterId,
      bubbleType: "speech",
      text: reply,
      duration: 10000,
    });
  }

  return {
    ok: true,
    handler: QUEUE_NAMES.founderMessage,
    processedAt: new Date().toISOString(),
    summary: `${char.name as string} replied: "${reply.slice(0, 30)}"`,
  };
}

// ── 프로젝트 완료 체크 & 종합 트리거 ────────────────────────────────────────────

async function checkAndTriggerSynthesis(projectId: string, now: string): Promise<void> {
  try {
    const sb = getDb();
    // 미완료 태스크 있으면 스킵
    const { data: pending } = await sb
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .in("state", ["Todo", "InProgress", "InReview", "Blocked"]);

    if ((pending as unknown as { count: number })?.count > 0) return;

    // 완료된 아티팩트 수 확인
    const { data: arts } = await sb
      .from("artifacts")
      .select("id")
      .eq("project_id", projectId)
      .neq("artifact_type", "synthesis_report")
      .limit(1);

    if (!arts || arts.length === 0) return;

    console.log(`[worker] all tasks done for project ${projectId} → triggering collab-synthesis`);
    void runQueueHandler(QUEUE_NAMES.collabSynthesis, {
      queueName: QUEUE_NAMES.collabSynthesis,
      payload: { input: { projectId } },
      requestedByCharacterId: "system:auto-synthesis",
      queuedAt: now,
      traceId: `synthesis_${projectId}`,
    }).catch((err: unknown) => console.error("[worker:auto-synthesis] failed:", err));
  } catch {
    // Non-fatal
  }
}

// ── AI 리뷰 결과 파싱 ──────────────────────────────────────────────────────────
// AI 리뷰어의 응답에서 승인/거절 여부와 피드백을 추출한다.

interface ReviewDecision {
  approved: boolean;
  feedback: string;
}

function parseReviewDecision(raw: string): ReviewDecision {
  const text = raw.trim();
  // APPROVE / REJECT: [피드백] 형식 파싱
  const approveMatch = /^APPROVE[:\s]/i.test(text);
  const rejectMatch = /^REJECT[:\s]/i.test(text);

  if (approveMatch) {
    const feedback = text.replace(/^APPROVE[:\s]*/i, "").trim() || "승인";
    return { approved: true, feedback };
  }
  if (rejectMatch) {
    const feedback = text.replace(/^REJECT[:\s]*/i, "").trim() || "재작업 요청";
    return { approved: false, feedback };
  }
  // 명확하지 않으면 텍스트에 부정어가 있는지 확인
  const hasNegative = /다시|수정|개선|미흡|부족|부적절|reject/i.test(text);
  return { approved: !hasNegative, feedback: text.slice(0, 200) };
}

// ── agent-messages (notifications 큐) ────────────────────────────────────────
// PENDING REVIEW_REQUEST 3분 경과 → AI 리뷰어가 실제로 산출물을 평가한다.
// 승인 → Done, 거절 → feedback_history 기록 후 InProgress 재시작 (최대 3회)

const MAX_REVISION_COUNT = 3;

async function processAgentMessages(_jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const sb = getDb();
  const now = new Date().toISOString();
  const threshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();

  const { data: pendingReviews } = await sb
    .from("agent_messages")
    .select("id, from_char_id, to_char_id, related_task_id")
    .eq("message_type", "REVIEW_REQUEST")
    .eq("status", "PENDING")
    .lt("created_at", threshold)
    .limit(10);

  let processed = 0;

  for (const msg of pendingReviews ?? []) {
    if (!msg.related_task_id) {
      await sb.from("agent_messages").update({ status: "READ" }).eq("id", msg.id);
      continue;
    }

    const { data: task } = await sb
      .from("tasks")
      .select("id, state, title, description, task_type, assignee_character_id, project_id, revision_count, feedback_history, ai_output, priority")
      .eq("id", msg.related_task_id)
      .single();

    if (!task || task.state !== TaskState.InReview) {
      await sb.from("agent_messages").update({ status: "READ" }).eq("id", msg.id);
      continue;
    }

    const revCount = (task.revision_count as number) ?? 0;
    const taskId = task.id as string;
    const shortTitle = (task.title as string).slice(0, 25);
    const reviewerCharId = msg.to_char_id as string;
    const assigneeCharId = msg.from_char_id as string;

    // 리뷰어 캐릭터 정보
    const { data: reviewer } = await sb
      .from("characters")
      .select("name, persona_summary, ai_enabled")
      .eq("id", reviewerCharId)
      .single();

    // AI가 비활성화됐거나 수정 횟수 초과 시 자동 승인
    const forceApprove = !reviewer || reviewer.ai_enabled === false || revCount >= MAX_REVISION_COUNT;

    let decision: ReviewDecision;

    if (forceApprove) {
      decision = {
        approved: true,
        feedback: revCount >= MAX_REVISION_COUNT
          ? `최대 수정 횟수(${MAX_REVISION_COUNT}회) 도달 — 최종 승인 처리`
          : "자동 승인",
      };
    } else {
      // 실제 AI 리뷰어 호출
      const aiOutput = (task.ai_output as Record<string, unknown> | null)?.text as string ?? "";
      const reviewPrompt = [
        `당신은 "${reviewer.name}"이며 다음 작업 산출물을 리뷰합니다.`,
        ``,
        `[작업 제목] ${task.title}`,
        `[작업 설명] ${task.description ?? "(없음)"}`,
        `[작업 유형] ${task.task_type}`,
        ``,
        `[제출된 산출물]`,
        aiOutput.slice(0, 2000) || "(산출물 없음)",
        ``,
        `위 산출물이 작업 요구사항을 충족하는지 평가하세요.`,
        `첫 줄을 반드시 다음 중 하나로 시작하세요:`,
        `APPROVE: [간단한 승인 코멘트]`,
        `REJECT: [명확한 개선 요청 사항]`,
        ``,
        `개선 요청 시 구체적이고 실행 가능한 피드백을 주세요. (100자 이내)`,
      ].join("\n");

      try {
        const reviewResult = await routeAI({
          characterId: reviewerCharId,
          taskType: "review",
          prompt: reviewPrompt,
          systemPrompt: (reviewer.persona_summary as string) ?? "당신은 꼼꼼한 리뷰어입니다.",
          maxTokens: 200,
        });
        decision = parseReviewDecision(reviewResult.output as string ?? "APPROVE: ok");
      } catch {
        // AI 호출 실패 시 자동 승인 (non-fatal)
        decision = { approved: true, feedback: "리뷰어 AI 오류 — 자동 승인" };
      }
    }

    if (decision.approved) {
      // ── 승인 ────────────────────────────────────────────────────────────────
      await sb.from("tasks").update({ state: TaskState.Done, updated_at: now }).eq("id", taskId);
      await logEvent({
        entityType: "task", entityId: taskId,
        eventType: "task.state.changed",
        previousState: TaskState.InReview, nextState: TaskState.Done,
        changedBy: `worker:ai-review:${reviewerCharId}`,
        comment: decision.feedback,
        relatedTaskId: taskId, relatedProjectId: task.project_id as string | null, now,
      });
      await sendAgentMessage({
        fromCharId: reviewerCharId,
        toCharId: assigneeCharId,
        messageType: "RESPONSE",
        content: `"${shortTitle}" 리뷰 완료 — 승인! ${decision.feedback.slice(0, 50)} ✅`,
        relatedTaskId: taskId, now,
      });
      void publishWorldEvent("task_state_changed", { taskId, characterId: assigneeCharId, taskTitle: task.title, from: TaskState.InReview, to: TaskState.Done });

      // 경험치 부여
      const { data: doneTask } = await sb.from("tasks").select("priority, ai_output, assignee_character_id, project_id").eq("id", taskId).single();
      if (doneTask?.assignee_character_id) {
        void grantExperience(doneTask.assignee_character_id as string, doneTask.priority as string, !!doneTask.ai_output, taskId, now);
      }

      // 프로젝트 전체 완료 체크 → 종합 리포트 자동 생성
      const projId = (doneTask?.project_id as string | null) ?? (task.project_id as string | null);
      if (projId) {
        void checkAndTriggerSynthesis(projId, now);
      }
    } else {
      // ── 거절 → 재작업 사이클 ────────────────────────────────────────────────
      const prevHistory = Array.isArray(task.feedback_history) ? task.feedback_history as unknown[] : [];
      const newHistory = [...prevHistory, { revision: revCount + 1, comment: decision.feedback, reviewedAt: now, reviewerCharId }];

      await sb.from("tasks").update({
        state: TaskState.InProgress,
        revision_count: revCount + 1,
        feedback_history: newHistory,
        updated_at: now,
      }).eq("id", taskId);

      await logEvent({
        entityType: "task", entityId: taskId,
        eventType: "task.state.changed",
        previousState: TaskState.InReview, nextState: TaskState.InProgress,
        changedBy: `worker:ai-review:${reviewerCharId}`,
        comment: `재작업 요청(${revCount + 1}회): ${decision.feedback}`,
        relatedTaskId: taskId, relatedProjectId: task.project_id as string | null, now,
      });

      await sendAgentMessage({
        fromCharId: reviewerCharId,
        toCharId: assigneeCharId,
        messageType: "RESPONSE",
        content: `"${shortTitle}" 재작업 요청: ${decision.feedback.slice(0, 60)} 🔄`,
        relatedTaskId: taskId, now,
      });

      void publishWorldEvent("task_state_changed", { taskId, characterId: assigneeCharId, taskTitle: task.title, from: TaskState.InReview, to: TaskState.InProgress });

      // 재작업 잡 즉시 인라인 실행
      void runQueueHandler(QUEUE_NAMES.aiActions, {
        queueName: QUEUE_NAMES.aiActions,
        payload: { input: { taskId, characterId: assigneeCharId } },
        requestedByCharacterId: "system:ai-review",
        queuedAt: now,
        traceId: `revision_${taskId}_${revCount + 1}`,
      }).catch(() => {});
    }

    await sb.from("agent_messages").update({ status: "ACTED_ON" }).eq("id", msg.id);
    processed++;
  }

  // HANDOFF / FYI → READ
  await sb.from("agent_messages")
    .update({ status: "READ" })
    .in("message_type", ["HANDOFF", "FYI"])
    .eq("status", "PENDING")
    .lt("created_at", threshold);

  return {
    ok: true,
    handler: QUEUE_NAMES.notifications,
    processedAt: now,
    summary: `processed ${processed} review(s)`,
  };
}
