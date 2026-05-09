import { QUEUE_NAMES, TaskState } from "@bloks/shared";
import { getSupabase } from "@bloks/db";
import { routeAI } from "@bloks/ai-router";
import { buildMemoryContext, createMemory, deriveMemorySummary } from "@bloks/memory";
import Redis from "ioredis";

const WORLD_EVENTS_CHANNEL = "world:events";

const redisPub = new Redis({
  host: process.env["REDIS_HOST"] ?? "127.0.0.1",
  port: Number(process.env["REDIS_PORT"] ?? 6379),
  password: process.env["REDIS_PASSWORD"] || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: null,
});
redisPub.connect().catch(() => {});

async function publishWorldEvent(
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await redisPub.publish(
      WORLD_EVENTS_CHANNEL,
      JSON.stringify({ type, payload, timestamp: new Date().toISOString() }),
    );
  } catch {
    // Non-fatal: Redis publish failure should not block job
  }
}

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
  const sb = getSupabase();
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

// ── workflow-transitions ──────────────────────────────────────────────────────
// Auto-advance stale Assigned → Accepted → InProgress

async function processWorkflowTransitions(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const sb = getSupabase();
  const taskId = (jobData.payload?.input?.["taskId"] as string | undefined)
    ?? jobData.payload?.taskId
    ?? null;

  const now = new Date().toISOString();
  let advanced = 0;

  const advance = async (id: string, from: TaskState, to: TaskState) => {
    await sb.from("tasks").update({ state: to, updated_at: now }).eq("id", id);
    await logEvent({
      entityType: "task", entityId: id,
      eventType: "task.state.changed",
      previousState: from, nextState: to,
      changedBy: "worker:workflow-transitions",
      relatedTaskId: id, now,
    });
    void publishWorldEvent("task_state_changed", { taskId: id, from, to });
    advanced++;
  };

  if (taskId) {
    const { data: task } = await sb
      .from("tasks")
      .select("id, state, assignee_character_id")
      .eq("id", taskId)
      .single();

    if (task?.state === TaskState.Assigned) {
      await advance(task.id, TaskState.Assigned, TaskState.Accepted);
    } else if (task?.state === TaskState.Accepted) {
      await advance(task.id, TaskState.Accepted, TaskState.InProgress);
    }
  } else {
    // Batch: advance tasks stale >5 min
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: assignedTasks } = await sb
      .from("tasks")
      .select("id, state")
      .eq("state", TaskState.Assigned)
      .lt("updated_at", staleThreshold)
      .not("assignee_character_id", "is", null)
      .limit(20);

    for (const task of assignedTasks ?? []) {
      await advance(task.id, TaskState.Assigned, TaskState.Accepted);
    }

    const { data: acceptedTasks } = await sb
      .from("tasks")
      .select("id, state")
      .eq("state", TaskState.Accepted)
      .lt("updated_at", staleThreshold)
      .limit(20);

    for (const task of acceptedTasks ?? []) {
      await advance(task.id, TaskState.Accepted, TaskState.InProgress);
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
  const sb = getSupabase();
  const taskId = (jobData.payload?.input?.["taskId"] as string | undefined)
    ?? jobData.payload?.taskId;

  if (!taskId) throw new Error("ai-actions: taskId is required");

  const now = new Date().toISOString();

  const { data: task, error: taskErr } = await sb
    .from("tasks")
    .select("id, title, description, task_type, state, assignee_character_id, project_id")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) throw new Error(`ai-actions: task ${taskId} not found`);

  const characterId: string = (jobData.payload?.input?.["characterId"] as string | undefined)
    ?? jobData.payload?.characterId
    ?? task.assignee_character_id;

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
  // ④ Task instruction layer (built below)

  const systemPrompt = [basePersona, stateLayer, memoryCtx.contextBlock]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt = [
    `Task: ${task.title}`,
    task.description ? `Description: ${task.description}` : "",
    `Complete this task professionally and thoroughly.`,
  ].filter(Boolean).join("\n");

  const aiResult = await routeAI({
    characterId,
    taskType: task.task_type ?? "character_action",
    prompt: userPrompt,
    systemPrompt,
    responseFormat: "text",
  });

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
    taskTitle: task.title,
    taskType: task.task_type ?? "general",
    aiOutputSnippet: aiResult.output,
    characterName: character?.name ?? characterId,
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

  // Advance to PendingReview if currently InProgress
  if (task.state === TaskState.InProgress) {
    await sb.from("tasks").update({ state: TaskState.PendingReview, updated_at: now }).eq("id", taskId);
    await logEvent({
      entityType: "task", entityId: taskId,
      eventType: "task.state.changed",
      previousState: TaskState.InProgress, nextState: TaskState.PendingReview,
      changedBy: `worker:ai-actions:${characterId}`,
      relatedTaskId: taskId, relatedProjectId: task.project_id, now,
    });
    void publishWorldEvent("task_state_changed", {
      taskId,
      characterId,
      from: TaskState.InProgress,
      to: TaskState.PendingReview,
    });
  }

  return {
    ok: true,
    handler: QUEUE_NAMES.aiActions,
    processedAt: now,
    summary: `AI task done: ${aiResult.modelUsed}, ${aiResult.tokensUsed} tokens, artifact ${artifact?.id ?? "n/a"}`,
  };
}

// ── approvals ─────────────────────────────────────────────────────────────────
// L0 auto-approve; L1+ check reviewer availability, escalate on burnout/overload

async function processApprovals(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const sb = getSupabase();
  const approvalId = (jobData.payload?.input?.["approvalId"] as string | undefined)
    ?? jobData.payload?.approvalId;
  const taskId = (jobData.payload?.input?.["taskId"] as string | undefined)
    ?? jobData.payload?.taskId;

  if (!approvalId && !taskId) throw new Error("approvals: approvalId or taskId is required");

  const now = new Date().toISOString();

  const baseQuery = sb.from("approvals").select("id, entity_id, level, state, approver_character_id");
  const { data: approval } = approvalId
    ? await baseQuery.eq("id", approvalId).single()
    : await baseQuery.eq("entity_id", taskId!).eq("state", "WaitingL1").limit(1).single();

  if (!approval) {
    return { ok: true, handler: QUEUE_NAMES.approvals, processedAt: now, summary: "no pending approval found" };
  }

  const level = (approval.level as string) ?? "L1";

  if (level === "L0") {
    await sb.from("approvals").update({ state: "Approved", responded_at: now }).eq("id", approval.id);
    await sb.from("tasks").update({ state: TaskState.Approved, updated_at: now }).eq("id", approval.entity_id);
    await logEvent({
      entityType: "approval", entityId: approval.id,
      eventType: "approval.auto_approved",
      previousState: "WaitingL1", nextState: "Approved",
      changedBy: "worker:approvals:auto",
      relatedTaskId: approval.entity_id, now,
    });
    return { ok: true, handler: QUEUE_NAMES.approvals, processedAt: now, summary: `L0 auto-approved ${approval.id}` };
  }

  // L1+: check approver availability
  if (approval.approver_character_id) {
    const { data: runtime } = await sb
      .from("character_runtime_states")
      .select("burnout_triggered, workload_score")
      .eq("character_id", approval.approver_character_id)
      .single();

    const isOverloaded = ((runtime?.workload_score as number) ?? 0) > 80;
    const isBurnout = (runtime?.burnout_triggered as boolean) ?? false;

    if (isBurnout || isOverloaded) {
      const { data: substitute } = await sb
        .from("character_runtime_states")
        .select("character_id, workload_score")
        .lt("workload_score", 60)
        .eq("burnout_triggered", false)
        .order("workload_score", { ascending: true })
        .limit(1)
        .single();

      if (substitute) {
        await sb.from("approvals")
          .update({ approver_character_id: substitute.character_id })
          .eq("id", approval.id);
        await logEvent({
          entityType: "approval", entityId: approval.id,
          eventType: "approval.approver_escalated",
          changedBy: "worker:approvals",
          comment: `Escalated from ${approval.approver_character_id} (overloaded) to ${substitute.character_id}`,
          relatedTaskId: approval.entity_id, now,
        });
        return {
          ok: true, handler: QUEUE_NAMES.approvals, processedAt: now,
          summary: `Escalated approval ${approval.id} to ${substitute.character_id}`,
        };
      }
    }
  }

  return {
    ok: true, handler: QUEUE_NAMES.approvals, processedAt: now,
    summary: `approval ${approval.id} checked, awaiting ${level} review`,
  };
}

// ── artifact-postprocess ──────────────────────────────────────────────────────
// Quality check: word count, update artifact status

async function processArtifactPostprocess(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const sb = getSupabase();
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
  const sb = getSupabase();
  const characterId = (jobData.payload?.input?.["characterId"] as string | undefined)
    ?? jobData.payload?.characterId;

  const now = new Date().toISOString();
  let updated = 0;

  const activeStates = [TaskState.Assigned, TaskState.Accepted, TaskState.InProgress, TaskState.PendingReview];

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

// ── Handler map ───────────────────────────────────────────────────────────────

const handlerMap: Record<QueueName, (jobData: WorkerJobPayload) => Promise<WorkerHandlerResult>> = {
  [QUEUE_NAMES.workflowTransitions]: processWorkflowTransitions,
  [QUEUE_NAMES.aiActions]: processAiActions,
  [QUEUE_NAMES.approvals]: processApprovals,
  [QUEUE_NAMES.artifactPostprocess]: processArtifactPostprocess,
  [QUEUE_NAMES.analyticsRollups]: processAnalyticsRollups,
  [QUEUE_NAMES.notifications]: processNotifications,
};

export async function runQueueHandler(queueName: QueueName, jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const handler = handlerMap[queueName];
  if (!handler) throw new Error(`No handler registered for queue: ${queueName}`);
  return handler(jobData);
}
