import { getSupabase } from "@bloks/db";
import { routeAI } from "@bloks/ai-router";
import type { WorkerJobPayload, WorkerHandlerResult } from "./handlers.js";
import { QUEUE_NAMES } from "@bloks/shared";
import { sendAgentMessage } from "./helpers.js";

function publishWorldEvent(_type: string, _payload: Record<string, unknown>) {
  // No-op: cross-process pub/sub removed. Events visible via direct API SSE emits.
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DIVISION_ROLE_KEYWORDS: Record<string, string[]> = {
  engineering: ["engineering", "dev", "engineer", "development"],
  marketing: ["marketing", "brand", "growth"],
  research: ["research", "data", "analysis", "analyst"],
  operations: ["ops", "operations"],
  strategy: ["strategy", "finance", "planning"],
  executive: ["executive", "exec", "management", "ceo", "cto"],
};

function matchesRole(divisionType: string, assigneeRole: string): boolean {
  const dt = divisionType.toLowerCase();
  const role = assigneeRole.toLowerCase();
  const keywords = DIVISION_ROLE_KEYWORDS[role] ?? [role];
  return keywords.some(kw => dt.includes(kw));
}

// Pick one representative per division (lowest workload)
function pickDivisionLeads(characters: Array<{
  id: string;
  name: string;
  code_name: string;
  divisions: { division_type?: string } | null;
  character_runtime_states: { workload_score?: number } | null;
}>) {
  const byDivision = new Map<string, typeof characters[0]>();
  for (const c of characters) {
    const dt = (c.divisions?.division_type ?? "general").toLowerCase();
    const existing = byDivision.get(dt);
    const wl = c.character_runtime_states?.workload_score ?? 0;
    const existingWl = existing?.character_runtime_states?.workload_score ?? 999;
    if (!existing || wl < existingWl) {
      byDivision.set(dt, c);
    }
  }
  return [...byDivision.values()].slice(0, 6);
}

const PRIORITY_MAP: Record<string, string> = {
  P0: "Critical", P1: "High", P2: "Medium", P3: "Low", P4: "Low",
  critical: "Critical", high: "High", medium: "Medium", low: "Low",
};
function normalizePriority(p: string): string {
  return PRIORITY_MAP[p] ?? PRIORITY_MAP[p.toUpperCase()] ?? "Medium";
}

const MEETING_DIALOGUES = [
  "이 프로젝트, 어떻게 나눌까요?",
  "저희 팀이 분석 파트 맡겠습니다",
  "일정은 2주면 충분할 것 같아요",
  "리소스 배분이 관건이겠네요",
  "파운더님 의도를 잘 반영해야죠",
  "각 팀 R&R 명확히 하고 시작합시다",
];

export async function processOrchestrate(jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const rawPayload = jobData.payload as Record<string, unknown> | undefined;
  const projectId = rawPayload?.["projectId"] as string | undefined;
  const title = (rawPayload?.["title"] as string | undefined) ?? "새 프로젝트";
  const brief = (rawPayload?.["brief"] as string | undefined) ?? title;

  if (!projectId) throw new Error("orchestrate: projectId is required");

  const sb = getSupabase();
  const now = new Date().toISOString();

  // ── Load active characters ──────────────────────────────────────────────────
  const { data: characters } = await sb
    .from("characters")
    .select(`
      id, name, code_name, ai_enabled, persona_summary,
      divisions(division_type, name),
      character_runtime_states(workload_score)
    `)
    .eq("active_flag", true)
    .limit(50);

  if (!characters || characters.length === 0) {
    throw new Error("orchestrate: no active characters found");
  }

  type CharRow = {
    id: string;
    name: string;
    code_name: string;
    ai_enabled: boolean | null;
    persona_summary: string | null;
    divisions: { division_type?: string; name?: string } | null;
    character_runtime_states: { workload_score?: number } | null;
  };
  const chars = characters as unknown as CharRow[];

  // Pick PM: prefer executive/management
  const pm = chars.find(c => {
    const dt = (c.divisions?.division_type ?? "").toLowerCase();
    return dt.includes("exec") || dt.includes("management") || dt.includes("strategy");
  }) ?? chars[0]!;

  // Pick division leads for meeting
  const leads = pickDivisionLeads(chars);

  // ── Stage 1: Founder receives project (thinking) ──────────────────────────
  void publishWorldEvent("workflow_stage", {
    stage: "project_received",
    projectId,
    projectTitle: title,
    characterIds: [pm.id],
    speakerId: pm.id,
    text: `"${title.slice(0, 25)}" 의뢰 접수. 분석 중...`,
  });

  // ── Stage 2: Call the meeting (team leads move to 8F) ────────────────────
  await delay(3000);

  void publishWorldEvent("workflow_stage", {
    stage: "meeting_called",
    projectId,
    projectTitle: title,
    characterIds: leads.map(l => l.id),
    floorId: "executive",
    speakerId: pm.id,
    text: `팀장 회의를 소집합니다. 8층으로 모여주세요`,
  });

  // ── Start LLM call in parallel while meeting "happens" visually ──────────
  const roster = chars.map(c => {
    const divType = (c.divisions?.division_type) ?? "general";
    const wl = c.character_runtime_states?.workload_score ?? 0;
    return `- ${c.name} (${c.code_name}): ${divType}, workload ${wl}/100`;
  }).join("\n");

  const systemPrompt = `당신은 ${pm.name}입니다. 이 회사의 PM 역할을 맡고 있습니다.
팀 구성원:
${roster}

규칙:
- 각 캐릭터의 전문 분야에 맞는 태스크만 배정하세요
- 워크로드가 낮은 캐릭터를 우선 배정하세요
- 반드시 아래 JSON 형식으로만 응답하세요`;

  const userPrompt = `다음 프로젝트를 수행하기 위한 태스크 계획을 수립해주세요:

프로젝트명: ${title}
의뢰 내용: ${brief}

다음 JSON 형식으로 태스크를 분해하고 담당자를 배정하세요:
{
  "plan_summary": "전체 계획 요약 (2-3문장)",
  "estimated_total_hours": 숫자,
  "tasks": [
    {
      "title": "태스크 제목",
      "description": "상세 설명",
      "assignee_role": "engineering|marketing|research|operations|strategy|executive",
      "depends_on_titles": ["선행 태스크 제목 배열, 없으면 빈 배열"],
      "priority": "P0|P1|P2|P3|P4",
      "estimated_hours": 숫자,
      "deliverable_type": "DOCUMENT|CODE|ANALYSIS|MEMO|COPY|PROPOSAL_DRAFT|MARKET_RESEARCH|DATA_ANALYSIS|ONLINE_CONTENT|WEB_DEVELOPMENT|CODE_DEVELOPMENT|ABAP_DEVELOPMENT|SAP_CONSULTING|STRATEGY_MEMO|PROJECT_PLAN"
    }
  ]
}`;

  const llmPromise = routeAI({
    characterId: pm.id,
    taskType: "orchestrate",
    prompt: userPrompt,
    systemPrompt,
    maxTokens: 2000,
    responseFormat: "json",
  });

  // ── Meeting dialogues (sequential, while LLM runs) ────────────────────────
  const shuffledLeads = [...leads].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(shuffledLeads.length, 4); i++) {
    await delay(3000);
    const speaker = shuffledLeads[i % shuffledLeads.length]!;
    const line = MEETING_DIALOGUES[i % MEETING_DIALOGUES.length]!;
    void publishWorldEvent("workflow_stage", {
      stage: "meeting_dialogue",
      projectId,
      projectTitle: title,
      speakerId: speaker.id,
      characterIds: leads.map(l => l.id),
      text: line,
    });
  }

  // ── Wait for LLM ──────────────────────────────────────────────────────────
  const aiResult = await llmPromise;

  let plan: {
    plan_summary: string;
    estimated_total_hours: number;
    tasks: Array<{
      title: string;
      description: string;
      assignee_role: string;
      depends_on_titles: string[];
      priority: string;
      estimated_hours: number;
      deliverable_type: string;
    }>;
  };

  try {
    const raw = typeof aiResult.output === "string" ? aiResult.output : JSON.stringify(aiResult.output);
    plan = JSON.parse(raw);
    if (!Array.isArray(plan.tasks)) throw new Error("invalid plan");
  } catch {
    throw new Error(`orchestrate: failed to parse LLM response`);
  }

  // ── Stage 3: Meeting ended, leaders return ────────────────────────────────
  void publishWorldEvent("workflow_stage", {
    stage: "meeting_ended",
    projectId,
    projectTitle: title,
    characterIds: leads.map(l => l.id),
    speakerId: pm.id,
    text: `플랜 확정! 각자 팀으로 돌아가서 시작합시다`,
  });

  await delay(1500);

  // Update project state to Active
  await sb.from("projects").update({ state: "Active", updated_at: now }).eq("id", projectId);

  // ── Create tasks in DB ────────────────────────────────────────────────────
  const taskIdByTitle = new Map<string, string>();
  const taskAssigneeMap = new Map<string, CharRow>();

  for (const t of plan.tasks) {
    const candidates = chars.filter(c => {
      const dt = c.divisions?.division_type ?? "";
      return matchesRole(dt, t.assignee_role);
    });
    candidates.sort((a, b) => {
      const wa = a.character_runtime_states?.workload_score ?? 0;
      const wb = b.character_runtime_states?.workload_score ?? 0;
      return wa - wb;
    });
    const assignee = candidates[0] ?? chars[0]!;

    const hasDeps = t.depends_on_titles.length > 0;
    const { data: created, error: insertError } = await sb.from("tasks").insert({
      project_id: projectId,
      title: t.title,
      description: t.description,
      task_type: t.deliverable_type.toLowerCase(),
      state: hasDeps ? "Blocked" : "Todo",
      priority: normalizePriority(t.priority),
      assignee_character_id: assignee.id,
      created_at: now,
      updated_at: now,
    }).select("id").single();

    if (insertError) {
      console.error("[orchestrate] task insert error", insertError, { title: t.title, project_id: projectId });
    }
    if (created?.id) {
      taskIdByTitle.set(t.title, created.id);
      taskAssigneeMap.set(t.title, assignee);
    }
  }

  // Create task_dependencies
  for (const t of plan.tasks) {
    const successorId = taskIdByTitle.get(t.title);
    if (!successorId) continue;
    for (const depTitle of t.depends_on_titles) {
      const predecessorId = taskIdByTitle.get(depTitle);
      if (!predecessorId) continue;
      await Promise.resolve(sb.from("task_dependencies").insert({
        predecessor_id: predecessorId,
        successor_id: successorId,
        dependency_type: "FS",
        active_flag: true,
      })).catch(() => {});
    }
  }

  // ── Stage 4: Work delegation (team lead → each assignee) ─────────────────
  await delay(1000);

  const notifiedPairs = new Set<string>();
  for (const t of plan.tasks) {
    const assignee = taskAssigneeMap.get(t.title);
    if (!assignee) continue;

    // Find the lead for this assignee's division
    const assigneeDivType = (assignee.divisions?.division_type ?? "").toLowerCase();
    const divLead = leads.find(l => {
      const ldt = (l.divisions?.division_type ?? "").toLowerCase();
      return ldt === assigneeDivType;
    }) ?? pm;

    const pairKey = `${divLead.id}:${assignee.id}`;
    if (notifiedPairs.has(pairKey) || divLead.id === assignee.id) {
      notifiedPairs.add(pairKey);
      continue;
    }
    notifiedPairs.add(pairKey);

    void publishWorldEvent("workflow_stage", {
      stage: "work_delegated",
      projectId,
      projectTitle: title,
      characterIds: [divLead.id, assignee.id],
      speakerId: divLead.id,
      text: `"${t.title.slice(0, 20)}" 태스크 맡아줘`,
    });

    // HANDOFF agent_message: 리드 → 담당자 (fire-and-forget)
    void sendAgentMessage({
      fromCharId: divLead.id,
      toCharId: assignee.id,
      messageType: "HANDOFF",
      content: `"${t.title.slice(0, 25)}" 작업 부탁해! 잘 부탁해 💼`,
      now: new Date().toISOString(),
    });

    await delay(800);
  }

  // PM final bubble
  void publishWorldEvent("character_bubble", {
    characterId: pm.id,
    bubbleType: "speech",
    text: `✅ ${plan.tasks.length}개 태스크 배분 완료! 시작합시다`,
    duration: 10000,
  });

  // Immediately kick off first AI tasks (don't wait up to 60s for tick engine)
  const { data: readyTasks } = await sb
    .from("tasks")
    .select("id, title, assignee_character_id")
    .eq("project_id", projectId)
    .eq("state", "Todo")
    .not("assignee_character_id", "is", null)
    .limit(3);

  const { runQueueHandler } = await import("./handlers.js");
  for (const task of readyTasks ?? []) {
    await sb.from("tasks").update({ state: "InProgress", updated_at: now }).eq("id", task.id);
    void publishWorldEvent("task_state_changed", { taskId: task.id, characterId: task.assignee_character_id, taskTitle: task.title, from: "Todo", to: "InProgress" });
    void runQueueHandler(QUEUE_NAMES.aiActions, {
      queueName: QUEUE_NAMES.aiActions,
      payload: { input: { taskId: task.id, characterId: task.assignee_character_id } },
      requestedByCharacterId: "system:orchestrate",
      queuedAt: now,
      traceId: `orch-${projectId}`,
    }).catch((err: unknown) => console.error("[orchestrate] ai-actions inline failed", err));
  }

  return {
    ok: true,
    handler: QUEUE_NAMES.orchestrate,
    processedAt: now,
    summary: `orchestrated ${plan.tasks.length} tasks for project ${projectId}: ${plan.plan_summary.slice(0, 80)}`,
  };
}
