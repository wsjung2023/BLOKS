// World Tick Engine — the "heart" of BLOKS
// Runs every WORLD_TICK_INTERVAL_MS (default 60s) and:
//   Phase 1: Update character runtime states (workload, fatigue, activity)
//   Phase 2: Auto-assign unassigned tasks to best-fit characters
//   Phase 3: Auto-advance stale state transitions
//   Phase 4: Dispatch InProgress tasks to ai-actions queue
//   Phase 5: Update character locations based on activity
//   Phase 6: Broadcast world snapshot via Redis Pub/Sub → SSE

import { QUEUE_NAMES, TaskState } from "@bloks/shared";
import { getSupabase } from "@bloks/db";
import { routeAI } from "@bloks/ai-router";
import { compressCharacterMemories } from "@bloks/memory";
import { sendAgentMessage } from "./helpers.js";
import { runQueueHandler } from "./handlers.js";

// ── Config ────────────────────────────────────────────────────────────────────

const TICK_INTERVAL_MS = parseInt(process.env["WORLD_TICK_INTERVAL_MS"] ?? "60000", 10);
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min before auto-advancing states

// ── Activity status → location zone mapping ──────────────────────────────────

const ACTIVITY_LOCATION_MAP: Record<string, string> = {
  Working: "desk",
  Idle: "lounge",
  InMeeting: "meeting-room",
  Overloaded: "desk",
  Burnout: "cafe",
  Offline: "offline",
};

// ── Floor mapping for departments ────────────────────────────────────────────

const DEPT_FLOOR_MAP: Record<string, string> = {
  engineering: "3f-engineering",
  operations: "2f-ops",
  research: "4f-research",
  marketing: "5f-marketing",
  strategy: "6f-planning",
  executive: "8f-executive",
};

function publishWorldEvent(_type: string, _payload: Record<string, unknown>): void {
  // No-op: cross-process Redis pub/sub removed. API emits SSE directly.
}

// ── Phase 1: Character runtime state updates ─────────────────────────────────

async function phaseUpdateCharacterStates(): Promise<number> {
  const sb = getSupabase();
  const now = new Date().toISOString();

  // Only process active (non-vacation) characters
  const { data: activeChars } = await sb
    .from("characters")
    .select("id")
    .eq("active_flag", true);

  if (!activeChars || activeChars.length === 0) return 0;
  const activeCharIds = activeChars.map((c) => c.id as string);

  const { data: runtimes } = await sb
    .from("character_runtime_states")
    .select("character_id, workload_score, fatigue_score, burnout_triggered, activity_status")
    .in("character_id", activeCharIds);

  if (!runtimes || runtimes.length === 0) return 0;

  let updated = 0;

  for (const rt of runtimes) {
    const charId = rt.character_id as string;

    // Count active tasks for this character
    const { count } = await sb
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_character_id", charId)
      .in("state", [TaskState.Todo, TaskState.InProgress, TaskState.InReview]);

    const activeCount = count ?? 0;
    const workloadScore = Math.min(100, activeCount * 15);
    const currentFatigue = (rt.fatigue_score as number) ?? 0;

    // Fatigue increases under high workload, recovers under low
    const newFatigue = workloadScore > 70
      ? Math.min(100, currentFatigue + 3)
      : Math.max(0, currentFatigue - 1);

    const burnoutTriggered = newFatigue >= 85 && workloadScore >= 80;

    // Derive activity status
    let activityStatus: string;
    if (burnoutTriggered) {
      activityStatus = "Burnout";
    } else if (workloadScore >= 80) {
      activityStatus = "Overloaded";
    } else if (activeCount > 0) {
      activityStatus = "Working";
    } else {
      activityStatus = "Idle";
    }

    const prevStatus = rt.activity_status as string;
    const locationZone = ACTIVITY_LOCATION_MAP[activityStatus] ?? "desk";

    await sb.from("character_runtime_states").update({
      workload_score: workloadScore,
      fatigue_score: newFatigue,
      burnout_triggered: burnoutTriggered,
      activity_status: activityStatus,
      location_zone: locationZone,
      last_active_at: activeCount > 0 ? now : undefined,
      updated_at: now,
    }).eq("character_id", charId);

    // Broadcast if status changed
    if (prevStatus !== activityStatus) {
      void publishWorldEvent("character_moved", {
        characterId: charId,
        fromStatus: prevStatus,
        toStatus: activityStatus,
        location_zone: locationZone,
        reason: burnoutTriggered ? "burnout" : activeCount > 0 ? "task" : "idle",
      });
    }

    void publishWorldEvent("runtime_update", {
      characterId: charId,
      workload_score: workloadScore,
      fatigue_score: newFatigue,
      burnout_triggered: burnoutTriggered,
      activity_status: activityStatus,
      current_task_count: activeCount,
    });

    updated++;
  }

  return updated;
}

// ── Phase 2: Auto-assign unassigned tasks ────────────────────────────────────

async function phaseAutoAssignTasks(): Promise<number> {
  const sb = getSupabase();
  const now = new Date().toISOString();

  // Find tasks in Created state with no assignee
  const { data: unassigned } = await sb
    .from("tasks")
    .select("id, title, department_id, project_id, priority")
    .eq("state", TaskState.Backlog)
    .is("assignee_character_id", null)
    .order("priority", { ascending: true }) // Critical first
    .limit(10);

  if (!unassigned || unassigned.length === 0) return 0;

  let assigned = 0;

  for (const task of unassigned) {
    // Find best character: same department, lowest workload, not in burnout
    let candidateQuery = sb
      .from("character_runtime_states")
      .select("character_id, workload_score")
      .eq("burnout_triggered", false)
      .order("workload_score", { ascending: true })
      .limit(1);

    // If task has a department, prefer characters from that department
    if (task.department_id) {
      const { data: deptChars } = await sb
        .from("characters")
        .select("id")
        .eq("department_id", task.department_id)
        .eq("active_flag", true);

      if (deptChars && deptChars.length > 0) {
        const charIds = deptChars.map((c) => c.id);
        candidateQuery = candidateQuery.in("character_id", charIds);
      }
    }

    const { data: candidates } = await candidateQuery;
    const bestCandidate = candidates?.[0];

    if (!bestCandidate) continue;

    // Assign task
    await sb.from("tasks").update({
      assignee_character_id: bestCandidate.character_id,
      state: TaskState.Todo,
      updated_at: now,
    }).eq("id", task.id);

    void publishWorldEvent("task_state_changed", {
      taskId: task.id,
      characterId: bestCandidate.character_id,
      from: TaskState.Backlog,
      to: TaskState.Todo,
    });

    assigned++;
  }

  return assigned;
}

// ── Phase 3: Auto-advance stale state transitions ────────────────────────────

async function phaseAutoAdvanceStates(): Promise<number> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

  let advanced = 0;

  const advance = async (id: string, from: TaskState, to: TaskState, meta?: { characterId?: string; taskTitle?: string }) => {
    await sb.from("tasks").update({ state: to, updated_at: now }).eq("id", id);
    void publishWorldEvent("task_state_changed", { taskId: id, from, to, ...(meta ?? {}) });
    advanced++;
  };

  // Todo → InProgress (after 5 min, for tasks with assignee)
  const { data: todoTasks } = await sb
    .from("tasks")
    .select("id, title, assignee_character_id")
    .eq("state", "Todo")
    .lt("updated_at", staleThreshold)
    .not("assignee_character_id", "is", null)
    .limit(20);

  for (const task of todoTasks ?? []) {
    await advance(task.id, TaskState.Todo, TaskState.InProgress, { characterId: task.assignee_character_id as string, taskTitle: task.title as string });
  }

  // InReview → Done (auto-approve after 5 min — no human reviewer in MVP)
  const { data: reviewTasks } = await sb
    .from("tasks")
    .select("id, title, assignee_character_id")
    .eq("state", TaskState.InReview)
    .lt("updated_at", staleThreshold)
    .limit(20);

  for (const task of reviewTasks ?? []) {
    await advance(task.id, TaskState.InReview, TaskState.Done, { characterId: task.assignee_character_id as string, taskTitle: task.title as string });
  }

  return advanced;
}

// ── Phase 3b: Unblock tasks whose predecessors are all Done ──────────────────

async function phaseUnblockTasks(): Promise<number> {
  const sb = getSupabase();
  const now = new Date().toISOString();

  const { data: blockedTasks } = await sb
    .from("tasks")
    .select("id, assignee_character_id")
    .eq("state", "Blocked")
    .limit(30);

  if (!blockedTasks || blockedTasks.length === 0) return 0;

  let unblocked = 0;

  for (const task of blockedTasks) {
    const { data: deps } = await sb
      .from("task_dependencies")
      .select("predecessor_id")
      .eq("successor_id", task.id)
      .eq("active_flag", true);

    if (!deps || deps.length === 0) {
      await sb.from("tasks").update({ state: "Todo", updated_at: now }).eq("id", task.id);
      void publishWorldEvent("task_state_changed", { taskId: task.id, characterId: task.assignee_character_id, from: "Blocked", to: "Todo" });
      unblocked++;
      continue;
    }

    const predIds = deps.map((d) => d.predecessor_id as string);
    const { count: doneCount } = await sb
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("id", predIds)
      .eq("state", "Done");

    if (doneCount === predIds.length) {
      await sb.from("tasks").update({ state: "Todo", updated_at: now }).eq("id", task.id);
      void publishWorldEvent("task_state_changed", { taskId: task.id, characterId: task.assignee_character_id, from: "Blocked", to: "Todo" });
      unblocked++;
    }
  }

  return unblocked;
}

// ── Phase 4: Dispatch AI actions ─────────────────────────────────────────────

async function phaseDispatchAiActions(): Promise<number> {
  const sb = getSupabase();

  // Find ai_enabled characters so we skip LLM for those with it off
  const { data: aiEnabledChars } = await sb
    .from("characters")
    .select("id")
    .eq("active_flag", true)
    .eq("ai_enabled", true);

  const aiEnabledIds = new Set((aiEnabledChars ?? []).map((c) => c.id as string));

  // Find InProgress tasks that haven't been processed by AI yet
  const { data: readyTasks } = await sb
    .from("tasks")
    .select("id, assignee_character_id")
    .eq("state", TaskState.InProgress)
    .is("ai_output", null)
    .not("assignee_character_id", "is", null)
    .limit(5);

  if (!readyTasks || readyTasks.length === 0) return 0;

  let dispatched = 0;
  const now = new Date().toISOString();

  for (const task of readyTasks) {
    if (!aiEnabledIds.has(task.assignee_character_id as string)) continue;

    void runQueueHandler(QUEUE_NAMES.aiActions, {
      queueName: QUEUE_NAMES.aiActions,
      payload: { input: { taskId: task.id, characterId: task.assignee_character_id } },
      requestedByCharacterId: "system:tick-engine",
      queuedAt: now,
      traceId: `tick-${Date.now()}`,
    }).catch((err: unknown) => console.error("[tick-engine] ai-actions failed", err));

    dispatched++;
  }

  return dispatched;
}

// ── Phase 5: Update character locations ──────────────────────────────────────
// (Already handled in Phase 1 via activity_status → location_zone mapping)

// ── Phase 6: Broadcast world snapshot ────────────────────────────────────────

async function phaseBroadcastSnapshot(tickNumber: number, stats: TickStats): Promise<void> {
  void publishWorldEvent("world_tick", {
    tick: tickNumber,
    stats,
    timestamp: new Date().toISOString(),
  });
}

// ── Phase 7: Generate character bubbles (thoughts/speech) ────────────────────

type PersonaType = "technical" | "manager" | "creative" | "analytical" | "executive";

function getPersonaType(codeName: string): PersonaType {
  const c = (codeName ?? "").toUpperCase();
  if (/ARCH|FORGE|GLITCH|DEBUG|STACK|BYTE|CIPHER|NEXUS/.test(c)) return "technical";
  if (/SPRINT|COMPLY|DEPLOY|ERP/.test(c)) return "manager";
  if (/NABI|PIXELS|VESPER|ECHO|BUZZ|LENS/.test(c)) return "creative";
  if (/AXIOM|CLOVER/.test(c)) return "analytical";
  if (/AURELION|HECTOR|FOUNDER|NOVA/.test(c)) return "executive";
  return "manager";
}

const PERSONA_BUBBLE_TEMPLATES: Record<PersonaType, Record<string, string[]>> = {
  technical: {
    Working: ["타입 오류 잡는 중...", "이 로직 리팩터링 해야겠는데", "PR 올려야지", "테스트 커버리지 확인해야 함"],
    Idle: ["스택 오버플로우 좀 봐야겠다", "코드 리뷰 남은 거 있나?", "기술 블로그 글 좀 읽자"],
    Overloaded: ["이슈가 너무 많아...", "CI 또 실패했네", "빌드 언제 끝나는 거야"],
    Burnout: ["(더 이상 디버깅하기 싫다...)", "(잠깐 쉬어야 해...)", "(...)"],
  },
  manager: {
    Working: ["스프린트 마감까지 얼마 안 남았는데", "리소스 재배분 고려해야겠어", "이번 주 KPI 확인"],
    Idle: ["다음 계획 세워야지", "팀 상태 체크해야 하나", "미팅 준비해야겠는데"],
    Overloaded: ["일정이 너무 타이트해...", "우선순위 조정이 필요해", "도움 요청해야 할 것 같아"],
    Burnout: ["(번아웃 직전이야...)", "(좀 쉬어야 해...)", "(...)"],
  },
  creative: {
    Working: ["이 레이아웃 더 정리해야지", "컬러 팔레트 다시 봐야겠어", "사용자 입장에서 생각해보면..."],
    Idle: ["영감이 필요해", "레퍼런스 좀 찾아봐야지", "커피 한 잔 하면서 생각해볼까"],
    Overloaded: ["아이디어가 너무 많아서 정리가 안 돼", "피드백이 쏟아지고 있어...", "방향을 다시 잡아야 할 것 같아"],
    Burnout: ["(더 이상 창의적인 게 안 나와...)", "(쉬어야 해...)", "(...)"],
  },
  analytical: {
    Working: ["데이터 패턴이 흥미롭네", "이 수치는 좀 검토가 필요해", "가설을 검증해봐야겠어"],
    Idle: ["새로운 리서치 자료 읽어야지", "인사이트를 더 뽑아낼 수 있을 것 같은데", "메트릭 정리해야겠다"],
    Overloaded: ["너무 많은 변수를 고려해야 해...", "데이터가 너무 많아", "분석이 복잡해지고 있어"],
    Burnout: ["(더 이상 집중이 안 돼...)", "(쉬어야 해...)", "(...)"],
  },
  executive: {
    Working: ["큰 그림을 봐야 해", "이 방향이 맞는지 다시 검토", "팀 전체 방향성 점검"],
    Idle: ["비전을 다시 정리해야겠어", "오늘 중요 결정 사항이 있었는데", "팀원들 상태를 파악해야지"],
    Overloaded: ["너무 많은 결정 사항들...", "임팩트 있는 것부터 처리해야겠어", "우선순위를 다시 잡자"],
    Burnout: ["(잠깐 물러서야 할 것 같아...)", "(쉬어야 해...)", "(...)"],
  },
};

async function phaseGenerateBubbles(tickNumber: number): Promise<number> {
  // Only generate bubbles every other tick to save costs
  if (tickNumber % 2 !== 0) return 0;

  const sb = getSupabase();

  // Get active (non-vacation) characters with their ai_enabled flag
  const { data: activeCharsForBubble } = await sb
    .from("characters")
    .select("id, name, code_name, persona_summary, ai_enabled")
    .eq("active_flag", true);

  if (!activeCharsForBubble || activeCharsForBubble.length === 0) return 0;

  const activeCharMap = new Map(activeCharsForBubble.map((c) => [c.id as string, c]));

  const { data: runtimes } = await sb
    .from("character_runtime_states")
    .select("character_id, activity_status")
    .in("character_id", [...activeCharMap.keys()])
    .neq("activity_status", "Offline");

  if (!runtimes || runtimes.length === 0) return 0;

  // Pick 2-3 random characters
  const shuffled = runtimes.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(3, shuffled.length));
  let generated = 0;

  for (const rt of selected) {
    const charId = rt.character_id as string;
    const status = (rt.activity_status as string) ?? "Idle";

    const char = activeCharMap.get(charId);
    if (!char) continue;

    const bubbleType = status === "Burnout" || status === "Idle" ? "thought" : "speech";
    let text: string;

    const aiEnabled = char.ai_enabled as boolean ?? true;
    // Try LLM generation for some, use templates as fallback (skip LLM if ai disabled)
    const useLLM = aiEnabled && Math.random() < 0.3;

    if (useLLM && char.persona_summary) {
      try {
        const result = await routeAI({
          characterId: charId,
          taskType: "character_action",
          prompt: `당신은 ${char.name}입니다. ${char.persona_summary}\n현재 상태: ${status}.\n지금 머릿속에 떠오르는 짧은 생각을 한 문장(15자 이내)으로 말하세요. 따옴표 없이 텍스트만 출력.`,
          systemPrompt: "짧은 한 문장만 출력하세요.",
          maxTokens: 50,
        });
        text = (result.output ?? "").trim().slice(0, 50);
        if (!text) throw new Error("empty");
      } catch {
        const persona = getPersonaType((char.code_name as string) ?? "");
        const templates = PERSONA_BUBBLE_TEMPLATES[persona][status] ?? PERSONA_BUBBLE_TEMPLATES[persona]["Idle"]!;
        text = templates[Math.floor(Math.random() * templates.length)]!;
      }
    } else {
      const persona = getPersonaType((char.code_name as string) ?? "");
      const templates = PERSONA_BUBBLE_TEMPLATES[persona][status] ?? PERSONA_BUBBLE_TEMPLATES[persona]["Idle"]!;
      text = templates[Math.floor(Math.random() * templates.length)]!;
    }

    void publishWorldEvent("character_bubble", {
      characterId: charId,
      characterName: char.name,
      bubbleType,
      text,
      emoji: status === "Working" ? "💻" : status === "Burnout" ? "😵" : status === "Overloaded" ? "😰" : "💬",
      duration: 8000,
    });

    generated++;
  }

  return generated;
}

// ── Phase 8: Autonomous character conversations ───────────────────────────
// Pairs characters on the same floor/zone for short exchanges

interface DialoguePair {
  aLine: string;
  bResponses: Record<PersonaType | "default", string>;
}

const DIALOGUE_BY_STATUS: Record<string, DialoguePair[]> = {
  Working: [
    {
      aLine: "이 부분 같이 봐줄 수 있어?",
      bResponses: { technical: "어디? 코드 한번 볼게", manager: "잠깐, 5분 후에 볼게", creative: "보여줘, 같이 생각해보자", analytical: "어떤 문제야? 같이 살펴볼게", executive: "핵심 이슈만 간단히 말해봐", default: "응, 잠깐만" },
    },
    {
      aLine: "이번 태스크 어디까지 왔어?",
      bResponses: { technical: "거의 다 됐어, PR 검토만 남았어", manager: "70% 정도? 오늘 안에 끝낼게", creative: "초안은 나왔는데 다듬는 중", analytical: "데이터 수집까지 완료, 분석 중이야", executive: "방향 잡았고 팀이 진행 중이야", default: "진행 중이야" },
    },
    {
      aLine: "막히는 게 있어?",
      bResponses: { technical: "타입 에러 좀 있는데 거의 다 잡았어", manager: "리소스가 부족한 게 문제야", creative: "방향이 좀 흔들리긴 하는데 잡아가는 중", analytical: "데이터가 생각보다 복잡하네", executive: "큰 그림은 보이는데 디테일이 문제야", default: "조금 막히는 부분 있어" },
    },
  ],
  Idle: [
    {
      aLine: "점심 먹었어?",
      bResponses: { technical: "아직, 커피부터 마시려고", manager: "미팅 때문에 못 먹었어, 이제 먹으러 가려고", creative: "나가서 먹을까 하는데, 같이 갈래?", analytical: "아직, 뭐 먹을지 고민 중", executive: "응, 간단하게 먹었어", default: "아직이야" },
    },
    {
      aLine: "오늘 어때?",
      bResponses: { technical: "코드 좀 정리했더니 상쾌해", manager: "미팅이 많아서 좀 피곤해", creative: "좋은 아이디어가 떠올랐어서 기분 좋아", analytical: "흥미로운 패턴 발견해서 기분 좋아", executive: "팀 분위기 좋아서 괜찮아", default: "괜찮아, 넌?" },
    },
    {
      aLine: "이번 프로젝트 잘 되고 있지?",
      bResponses: { technical: "기술적으로는 순탄하게 가고 있어", manager: "일정이 좀 빡빡하긴 한데 맞춰가고 있어", creative: "방향은 좋은데 디테일 다듬는 중이야", analytical: "지표는 긍정적으로 나오고 있어", executive: "팀이 잘 해주고 있어", default: "응, 잘 되고 있어" },
    },
  ],
  Overloaded: [
    {
      aLine: "요즘 일이 너무 많지 않아?",
      bResponses: { technical: "이슈 티켓이 쌓여서 정신없어", manager: "업무 배분을 다시 해야 할 것 같아", creative: "피드백이 계속 쏟아져서 힘들어", analytical: "분석할 게 너무 많아서 우선순위 잡기가 어려워", executive: "결정해야 할 게 너무 많아", default: "맞아, 좀 힘들어" },
    },
    {
      aLine: "도움이 필요해?",
      bResponses: { technical: "코드 리뷰 해줄 수 있어? 엄청 도움이 될 것 같아", manager: "일정 조율 좀 도와줄 수 있어?", creative: "피드백 한번 줄 수 있어?", analytical: "데이터 해석 같이 봐줄 수 있어?", executive: "지금 중요한 결정 앞에 있어, 의견 줄 수 있어?", default: "응, 부탁할게" },
    },
  ],
};

async function phaseAutonomousConversations(tickNumber: number): Promise<number> {
  // Every 3rd tick
  if (tickNumber % 3 !== 0) return 0;

  const sb = getSupabase();

  // Get active (non-vacation) character IDs
  const { data: activeCharsForConv } = await sb
    .from("characters")
    .select("id, ai_enabled")
    .eq("active_flag", true);

  if (!activeCharsForConv || activeCharsForConv.length < 2) return 0;
  const activeConvIds = activeCharsForConv.map((c) => c.id as string);
  const convAiEnabledMap = new Map(activeCharsForConv.map((c) => [c.id as string, c.ai_enabled as boolean ?? true]));

  // Get characters grouped by location_zone
  const { data: runtimes } = await sb
    .from("character_runtime_states")
    .select("character_id, activity_status, location_zone")
    .in("character_id", activeConvIds)
    .neq("activity_status", "Offline")
    .neq("activity_status", "Burnout");

  if (!runtimes || runtimes.length < 2) return 0;

  // Build status map for topic selection
  const statusMap = new Map<string, string>(runtimes.map((rt) => [rt.character_id as string, (rt.activity_status as string) ?? "Idle"]));

  // Group by location
  const byZone = new Map<string, string[]>();
  for (const rt of runtimes) {
    const zone = (rt.location_zone as string) ?? "desk";
    const arr = byZone.get(zone) ?? [];
    arr.push(rt.character_id as string);
    byZone.set(zone, arr);
  }

  let conversations = 0;

  for (const [zone, charIds] of byZone) {
    if (charIds.length < 2) continue;
    // Pick a random pair
    const shuffled = charIds.sort(() => Math.random() - 0.5);
    const charA = shuffled[0]!;
    const charB = shuffled[1]!;

    // Get character details including code_name for persona
    const { data: chars } = await sb
      .from("characters")
      .select("id, name, code_name, persona_summary")
      .in("id", [charA, charB]);

    if (!chars || chars.length < 2) continue;
    const a = chars.find((c) => c.id === charA);
    const b = chars.find((c) => c.id === charB);
    if (!a || !b) continue;

    const bPersona = getPersonaType((b.code_name as string) ?? "");
    const statusA = statusMap.get(charA) ?? "Idle";

    let textA: string;
    let textB: string;

    // Try LLM only if both have ai_enabled
    const bothAiEnabled = (convAiEnabledMap.get(charA) ?? true) && (convAiEnabledMap.get(charB) ?? true);
    const useLLM = bothAiEnabled && Math.random() < 0.2;

    if (useLLM && a.persona_summary && b.persona_summary) {
      try {
        const result = await routeAI({
          characterId: charA,
          taskType: "character_action",
          prompt: `${a.name}와 ${b.name}이 사무실에서 마주쳤습니다.\n${a.name}: ${a.persona_summary}\n${b.name}: ${b.persona_summary}\n짧은 대화 2줄을 생성하세요. 형식: "A: ...", "B: ...". 각 15자 이내.`,
          systemPrompt: "2줄 대화만 출력. A: B: 형식.",
          maxTokens: 80,
        });
        const lines = (result.output ?? "").split("\n").filter((l) => l.trim());
        const pool = DIALOGUE_BY_STATUS[statusA] ?? DIALOGUE_BY_STATUS["Idle"]!;
        const fallbackPair = pool[Math.floor(Math.random() * pool.length)]!;
        textA = lines[0]?.replace(/^[AB]:\s*/, "").trim().slice(0, 40) ?? fallbackPair.aLine;
        textB = lines[1]?.replace(/^[AB]:\s*/, "").trim().slice(0, 40) ?? (fallbackPair.bResponses[bPersona] ?? fallbackPair.bResponses["default"]);
      } catch {
        const pool = DIALOGUE_BY_STATUS[statusA] ?? DIALOGUE_BY_STATUS["Idle"]!;
        const pair = pool[Math.floor(Math.random() * pool.length)]!;
        textA = pair.aLine;
        textB = pair.bResponses[bPersona] ?? pair.bResponses["default"];
      }
    } else {
      const pool = DIALOGUE_BY_STATUS[statusA] ?? DIALOGUE_BY_STATUS["Idle"]!;
      const pair = pool[Math.floor(Math.random() * pool.length)]!;
      textA = pair.aLine;
      textB = pair.bResponses[bPersona] ?? pair.bResponses["default"];
    }

    // Emit conversation bubbles with slight delay
    void publishWorldEvent("character_bubble", {
      characterId: charA,
      characterName: a.name,
      bubbleType: "speech",
      text: textA,
      targetCharacterId: charB,
      emoji: "💬",
      duration: 6000,
    });

    // Second bubble after short delay (2s)
    setTimeout(() => {
      void publishWorldEvent("character_bubble", {
        characterId: charB,
        characterName: b.name,
        bubbleType: "speech",
        text: textB,
        targetCharacterId: charA,
        emoji: "💬",
        duration: 6000,
      });
    }, 2000);

    conversations++;
    if (conversations >= 2) break; // Max 2 conversations per tick
  }

  return conversations;
}

// ── Phase 0: Schedule transitions (출퇴근/점심) ───────────────────────────────

async function phaseSchedule(): Promise<number> {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;
  const isWorkHour = !isWeekend && hour >= 9 && hour < 18;
  const isLunchHour = !isWeekend && hour === 12;
  const isMorningArrival = !isWeekend && hour === 9;
  const isEveningDeparture = !isWeekend && hour === 18;

  const sb = getSupabase();
  const now_str = now.toISOString();

  const { data: activeChars } = await sb
    .from("characters")
    .select("id")
    .eq("active_flag", true);

  if (!activeChars || activeChars.length === 0) return 0;

  const charIds = activeChars.map((c) => c.id as string);

  const { data: runtimes } = await sb
    .from("character_runtime_states")
    .select("character_id, activity_status, location_zone")
    .in("character_id", charIds);

  if (!runtimes) return 0;

  let transitioned = 0;

  for (const rt of runtimes) {
    const charId = rt.character_id as string;
    const currentStatus = rt.activity_status as string;
    const currentZone = (rt.location_zone as string) ?? "desk";

    if (!isWorkHour && currentStatus !== "Offline") {
      await sb.from("character_runtime_states").update({
        activity_status: "Offline",
        location_zone: "offline",
        updated_at: now_str,
      }).eq("character_id", charId);

      void publishWorldEvent("runtime_update", { characterId: charId, activity_status: "Offline" });

      if (isEveningDeparture) {
        const farewells = ["오늘도 수고했어요! 내일 봐요~", "퇴근합니다 👋", "오늘 열심히 했어!", "내일 또 봐요!"];
        void publishWorldEvent("character_bubble", {
          characterId: charId, bubbleType: "speech",
          text: farewells[Math.floor(Math.random() * farewells.length)]!,
          emoji: "👋", duration: 6000,
        });
      }
      transitioned++;
    } else if (isWorkHour && currentStatus === "Offline") {
      await sb.from("character_runtime_states").update({
        activity_status: "Idle",
        location_zone: "desk",
        updated_at: now_str,
      }).eq("character_id", charId);

      void publishWorldEvent("runtime_update", { characterId: charId, activity_status: "Idle" });

      if (isMorningArrival) {
        const greetings = ["좋은 아침이에요! ☀️", "안녕하세요, 출근했어요!", "오늘도 화이팅!", "커피 한 잔 해야겠다..."];
        void publishWorldEvent("character_bubble", {
          characterId: charId, bubbleType: "speech",
          text: greetings[Math.floor(Math.random() * greetings.length)]!,
          emoji: "☀️", duration: 6000,
        });
      }
      transitioned++;
    } else if (isLunchHour && currentZone !== "cafe" && currentStatus !== "Offline" && currentStatus !== "InMeeting") {
      if (Math.random() < 0.4) {
        await sb.from("character_runtime_states").update({
          location_zone: "cafe",
          updated_at: now_str,
        }).eq("character_id", charId);

        void publishWorldEvent("character_moved", {
          characterId: charId, toStatus: currentStatus,
          location_zone: "cafe", reason: "lunch",
        });

        const lunches = ["점심 먹으러 가야겠다!", "배고파... 밥 먹고 와야지", "오늘 점심 뭐 먹지?"];
        void publishWorldEvent("character_bubble", {
          characterId: charId, bubbleType: "speech",
          text: lunches[Math.floor(Math.random() * lunches.length)]!,
          emoji: "🍜", duration: 5000,
        });
        transitioned++;
      }
    } else if (hour === 13 && currentZone === "cafe") {
      await sb.from("character_runtime_states").update({
        location_zone: "desk",
        updated_at: now_str,
      }).eq("character_id", charId);

      void publishWorldEvent("character_moved", {
        characterId: charId, toStatus: currentStatus,
        location_zone: "desk", reason: "lunch_end",
      });
      transitioned++;
    }
  }

  return transitioned;
}

// ── Phase 9: Meeting system ───────────────────────────────────────────────
// Groups collaborators on a project into a meeting

async function phaseMeetings(tickNumber: number): Promise<number> {
  // Every 5th tick
  if (tickNumber % 5 !== 0) return 0;

  const sb = getSupabase();

  // Find active projects with multiple assignees
  const { data: activeTasks } = await sb
    .from("tasks")
    .select("project_id, assignee_character_id")
    .eq("state", TaskState.InProgress)
    .not("assignee_character_id", "is", null)
    .not("project_id", "is", null)
    .limit(50);

  if (!activeTasks || activeTasks.length === 0) return 0;

  // Group by project
  const projectMembers = new Map<string, Set<string>>();
  for (const task of activeTasks) {
    const pid = task.project_id as string;
    const cid = task.assignee_character_id as string;
    const set = projectMembers.get(pid) ?? new Set();
    set.add(cid);
    projectMembers.set(pid, set);
  }

  let meetings = 0;

  for (const [projectId, members] of projectMembers) {
    if (members.size < 2) continue;

    const memberIds = [...members].slice(0, 4); // Max 4 per meeting

    // Get character names
    const { data: chars } = await sb
      .from("characters")
      .select("id, name")
      .in("id", memberIds);

    if (!chars || chars.length < 2) continue;

    // Move characters to meeting room
    for (const charId of memberIds) {
      await sb.from("character_runtime_states").update({
        activity_status: "InMeeting",
        location_zone: "meeting-room",
        updated_at: new Date().toISOString(),
      }).eq("character_id", charId);

      void publishWorldEvent("character_moved", {
        characterId: charId,
        toStatus: "InMeeting",
        location_zone: "meeting-room",
        reason: "meeting",
      });
    }

    // Get project title
    const { data: project } = await sb
      .from("projects")
      .select("title")
      .eq("id", projectId)
      .single();

    const projectTitle = (project?.title as string) ?? "프로젝트";
    const attendeeNames = chars.map((c) => c.name).join(", ");

    // Emit meeting bubble
    void publishWorldEvent("character_bubble", {
      characterId: memberIds[0],
      characterName: chars[0]!.name,
      bubbleType: "speech",
      text: `회의 시작: "${projectTitle.slice(0, 20)}" (함께: ${attendeeNames})`,
      emoji: "📊",
      duration: 10000,
    });

    // Schedule meeting end (return to desk after 3 ticks)
    setTimeout(async () => {
      for (const charId of memberIds) {
        await sb.from("character_runtime_states").update({
          activity_status: "Working",
          location_zone: "desk",
          updated_at: new Date().toISOString(),
        }).eq("character_id", charId);

        void publishWorldEvent("character_moved", {
          characterId: charId,
          toStatus: "Working",
          location_zone: "desk",
          reason: "meeting_end",
        });
      }
    }, TICK_INTERVAL_MS * 3);

    meetings++;
    if (meetings >= 1) break; // Max 1 meeting per tick
  }

  return meetings;
}

// ── Phase 10: Agent message processing ───────────────────────────────────────

async function phaseProcessAgentMessages(): Promise<number> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const threshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();

  const { data: pending } = await sb
    .from("agent_messages")
    .select("id, from_char_id, to_char_id, related_task_id")
    .eq("message_type", "REVIEW_REQUEST")
    .eq("status", "PENDING")
    .lt("created_at", threshold)
    .limit(5);

  if (!pending || pending.length === 0) return 0;
  let processed = 0;

  for (const msg of pending) {
    if (!msg.related_task_id) {
      await sb.from("agent_messages").update({ status: "READ" }).eq("id", msg.id);
      continue;
    }
    const { data: task } = await sb.from("tasks")
      .select("id, state, title, revision_count, assignee_character_id, priority, ai_output")
      .eq("id", msg.related_task_id).single();

    if (!task || task.state !== TaskState.InReview) {
      await sb.from("agent_messages").update({ status: "READ" }).eq("id", msg.id);
      continue;
    }

    await sb.from("tasks").update({ state: TaskState.Done, updated_at: now }).eq("id", task.id);
    void publishWorldEvent("task_state_changed", {
      taskId: task.id, characterId: task.assignee_character_id,
      taskTitle: task.title, from: TaskState.InReview, to: TaskState.Done,
    });
    await sendAgentMessage({
      fromCharId: msg.to_char_id as string,
      toCharId: msg.from_char_id as string,
      messageType: "RESPONSE",
      content: `"${(task.title as string).slice(0, 25)}" 확인 완료, 승인! ✅`,
      relatedTaskId: task.id as string,
      now,
    });
    await sb.from("agent_messages").update({ status: "ACTED_ON" }).eq("id", msg.id);

    // 경험치 부여
    if (task.assignee_character_id) {
      const { calcTaskExperience, expRequiredForLevel } = await import("@bloks/simulation");
      const gained = calcTaskExperience(task.priority as string, !!task.ai_output);
      const { data: char } = await sb.from("characters")
        .select("total_experience, current_level, level_experience, total_tasks_done")
        .eq("id", task.assignee_character_id).single();
      if (char) {
        let level = (char.current_level as number) ?? 1;
        let levelExp = ((char.level_experience as number) ?? 0) + gained;
        let leveledUp = false;
        while (levelExp >= expRequiredForLevel(level)) { levelExp -= expRequiredForLevel(level); level++; leveledUp = true; }
        await sb.from("characters").update({
          total_experience: ((char.total_experience as number) ?? 0) + gained,
          current_level: level, level_experience: levelExp,
          total_tasks_done: ((char.total_tasks_done as number) ?? 0) + 1,
          updated_at: now,
        }).eq("id", task.assignee_character_id);
        if (leveledUp) void publishWorldEvent("character_levelup", { characterId: task.assignee_character_id, newLevel: level, gainedExp: gained });
      }
    }

    processed++;
  }

  // HANDOFF/FYI → READ
  await sb.from("agent_messages")
    .update({ status: "READ" })
    .in("message_type", ["HANDOFF", "FYI"])
    .eq("status", "PENDING")
    .lt("created_at", threshold);

  return processed;
}

// ── Phase 11: Project completion detection ────────────────────────────────────

async function phaseProjectCompletion(): Promise<number> {
  const sb = getSupabase();
  const now_str = new Date().toISOString();

  const { data: activeProjects } = await sb
    .from("projects")
    .select("id, title, owner_character_id")
    .not("state", "in", '("Released","Cancelled","Completed")');

  if (!activeProjects || activeProjects.length === 0) return 0;

  let completed = 0;

  for (const project of activeProjects) {
    const { count: total } = await sb.from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .neq("state", "Cancelled");

    const { count: done } = await sb.from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("state", "Done");

    if (!total || !done || total === 0 || done < total) continue;

    // Gather assignee IDs for celebration animation
    const { data: assignees } = await sb.from("tasks")
      .select("assignee_character_id")
      .eq("project_id", project.id)
      .eq("state", "Done")
      .not("assignee_character_id", "is", null);
    const celebrantIds = [...new Set((assignees ?? []).map((t) => t.assignee_character_id as string).filter(Boolean))];

    await sb.from("projects").update({
      state: "Released",
      completed_at: now_str,
      updated_at: now_str,
    }).eq("id", project.id);

    void publishWorldEvent("world_tick", {
      event: "project_completed",
      projectId: project.id,
      projectTitle: project.title,
    });

    // workflow_stage event so canvas shows celebration animation
    void publishWorldEvent("workflow_stage", {
      stage: "project_delivered",
      projectId: project.id,
      projectTitle: project.title,
      speakerId: project.owner_character_id ?? "",
      characterIds: celebrantIds,
      text: `🎁 "${(project.title as string).slice(0, 20)}" 납품 완료!`,
    });

    if (project.owner_character_id) {
      void publishWorldEvent("character_bubble", {
        characterId: project.owner_character_id,
        bubbleType: "speech",
        text: `🎉 "${(project.title as string).slice(0, 20)}" 프로젝트 완료!`,
        emoji: "🎉",
        duration: 10000,
      });
    }

    completed++;
  }

  return completed;
}

// ── Phase 11: Memory auto-compression ────────────────────────────────────────
// Runs every 10th tick. For each character with >30 memories, summarizes
// the oldest 20 into a single "lesson" memory via LLM.

async function phaseMemoryCompression(tickNumber: number): Promise<number> {
  if (tickNumber % 10 !== 0) return 0;

  const sb = getSupabase();
  const { data: chars } = await sb.from("characters").select("id").eq("active_flag", true);
  if (!chars || chars.length === 0) return 0;

  let totalCompressed = 0;

  for (const char of chars) {
    try {
      const compressed = await compressCharacterMemories(char.id as string, {
        threshold: 30,
        batchSize: 20,
        summarize: async (texts) => {
          const result = await routeAI({
            characterId: char.id as string,
            taskType: "character_action",
            prompt: `다음 경험들을 한국어로 3-5개 핵심 교훈으로 압축해주세요 (각 항목 최대 100자):\n\n${texts.join("\n")}`,
            maxTokens: 300,
            responseFormat: "text",
          });
          return result.output;
        },
      });
      totalCompressed += compressed;
    } catch {
      // Non-fatal per character
    }
  }

  return totalCompressed;
}

// ── Phase 13: Outbox Relay ────────────────────────────────────────────────────
// Recovery path: execute outbox_events rows that were never dispatched.

async function phaseRelayOutbox(): Promise<number> {
  const sb = getSupabase();
  const threshold = new Date(Date.now() - 60_000).toISOString();

  const { data: stuck } = await sb
    .from("outbox_events")
    .select("id, queue_name, payload, requested_by_character_id, trace_id, idempotency_key, created_at")
    .is("published_at", null)
    .lt("created_at", threshold)
    .limit(20);

  if (!stuck?.length) return 0;

  const now = new Date().toISOString();
  let relayed = 0;

  for (const row of stuck) {
    try {
      await runQueueHandler(row.queue_name as (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES], {
        queueName: row.queue_name as string,
        payload: row.payload as Record<string, unknown>,
        requestedByCharacterId: (row.requested_by_character_id as string | null) ?? null,
        queuedAt: row.created_at as string,
        traceId: (row.trace_id as string | null) ?? null,
        idempotencyKey: (row.idempotency_key as string | null) ?? null,
      });
      await sb.from("outbox_events").update({ published_at: now }).eq("id", row.id);
      relayed++;
    } catch (err) {
      console.warn("[tick-engine] outbox relay failed for", row.id, err instanceof Error ? err.message : err);
    }
  }

  if (relayed > 0) console.log(`[tick-engine] outbox relay: ${relayed} jobs executed`);
  return relayed;
}

// ── Phase 14: Monthly Report Trigger ─────────────────────────────────────────
// On the first tick of each month, enqueue a monthly-report job for the previous month.

async function phaseMonthlyReportTrigger(tickNumber: number): Promise<void> {
  if (tickNumber % 360 !== 0) return; // check roughly every 6 hours
  const now = new Date();
  if (now.getUTCDate() !== 1 || now.getUTCHours() !== 0) return;

  const month = now.getUTCMonth(); // 0-based: 0 = Jan → previous month
  const prevMonth = month === 0 ? 12 : month;
  const prevYear = month === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  void runQueueHandler(QUEUE_NAMES.monthlyReport, {
    queueName: QUEUE_NAMES.monthlyReport,
    payload: { input: { year: prevYear, month: prevMonth } },
    requestedByCharacterId: null,
    queuedAt: now.toISOString(),
    traceId: null,
    idempotencyKey: `monthly-report-${prevYear}-${prevMonth}`,
  }).catch((err: unknown) => console.error("[tick-engine] monthly report failed", err));

  console.log(`[tick-engine] monthly report triggered for ${prevYear}-${prevMonth}`);
}

// ── Tick Stats ────────────────────────────────────────────────────────────────

interface TickStats {
  charactersUpdated: number;
  tasksAssigned: number;
  statesAdvanced: number;
  unblockedTasks: number;
  aiDispatched: number;
  bubblesGenerated: number;
  conversations: number;
  meetings: number;
  scheduled: number;
  projectsCompleted: number;
  agentMessages: number;
  durationMs: number;
}

// ── Main Tick Engine Class ────────────────────────────────────────────────────

export class WorldTickEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickNumber = 0;
  private running = false;

  start(): void {
    if (this.timer) return;
    console.log(`[tick-engine] starting (interval: ${TICK_INTERVAL_MS}ms)`);

    // Run first tick after a short delay to let worker fully initialize
    setTimeout(() => {
      void this.tick();
    }, 5000);

    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log(`[tick-engine] stopped after ${this.tickNumber} ticks`);
  }

  private async tick(): Promise<void> {
    if (this.running) {
      console.warn("[tick-engine] previous tick still running, skipping");
      return;
    }

    this.running = true;
    this.tickNumber++;
    const startTime = Date.now();

    const stats: TickStats = {
      charactersUpdated: 0,
      tasksAssigned: 0,
      statesAdvanced: 0,
      unblockedTasks: 0,
      aiDispatched: 0,
      bubblesGenerated: 0,
      conversations: 0,
      meetings: 0,
      scheduled: 0,
      projectsCompleted: 0,
      agentMessages: 0,
      durationMs: 0,
    };

    try {
      // Phase 0: Schedule transitions
      try {
        stats.scheduled = await phaseSchedule();
      } catch (err) {
        console.error("[tick-engine] Phase 0 (schedule) error:", err instanceof Error ? err.message : err);
      }

      // Phase 1: Character states
      try {
        stats.charactersUpdated = await phaseUpdateCharacterStates();
      } catch (err) {
        console.error("[tick-engine] Phase 1 (character states) error:", err instanceof Error ? err.message : err);
      }

      // Phase 2: Auto-assign
      try {
        stats.tasksAssigned = await phaseAutoAssignTasks();
      } catch (err) {
        console.error("[tick-engine] Phase 2 (auto-assign) error:", err instanceof Error ? err.message : err);
      }

      // Phase 3: State transitions
      try {
        stats.statesAdvanced = await phaseAutoAdvanceStates();
      } catch (err) {
        console.error("[tick-engine] Phase 3 (state transitions) error:", err instanceof Error ? err.message : err);
      }

      // Phase 3b: Unblock tasks
      try {
        stats.unblockedTasks = await phaseUnblockTasks();
      } catch (err) {
        console.error("[tick-engine] Phase 3b (unblock tasks) error:", err instanceof Error ? err.message : err);
      }

      // Phase 4: AI dispatch
      try {
        stats.aiDispatched = await phaseDispatchAiActions();
      } catch (err) {
        console.error("[tick-engine] Phase 4 (AI dispatch) error:", err instanceof Error ? err.message : err);
      }

      // Phase 7: Character bubbles
      try {
        stats.bubblesGenerated = await phaseGenerateBubbles(this.tickNumber);
      } catch (err) {
        console.error("[tick-engine] Phase 7 (bubbles) error:", err instanceof Error ? err.message : err);
      }

      // Phase 8: Autonomous conversations
      try {
        stats.conversations = await phaseAutonomousConversations(this.tickNumber);
      } catch (err) {
        console.error("[tick-engine] Phase 8 (conversations) error:", err instanceof Error ? err.message : err);
      }

      // Phase 9: Meetings
      try {
        stats.meetings = await phaseMeetings(this.tickNumber);
      } catch (err) {
        console.error("[tick-engine] Phase 9 (meetings) error:", err instanceof Error ? err.message : err);
      }

      // Phase 10: Agent message processing
      try {
        stats.agentMessages = await phaseProcessAgentMessages();
      } catch (err) {
        console.error("[tick-engine] Phase 10 (agent-messages) error:", err instanceof Error ? err.message : err);
      }

      // Phase 11: Project completion
      try {
        stats.projectsCompleted = await phaseProjectCompletion();
      } catch (err) {
        console.error("[tick-engine] Phase 11 (project completion) error:", err instanceof Error ? err.message : err);
      }

      // Phase 12: Memory compression (every 10th tick)
      try {
        await phaseMemoryCompression(this.tickNumber);
      } catch (err) {
        console.error("[tick-engine] Phase 12 (memory compression) error:", err instanceof Error ? err.message : err);
      }

      // Phase 13: Outbox relay — recover jobs that were never executed
      try {
        await phaseRelayOutbox();
      } catch (err) {
        console.error("[tick-engine] Phase 13 (outbox relay) error:", err instanceof Error ? err.message : err);
      }

      // Phase 14: Monthly report trigger — enqueue report job on 1st of month
      try {
        await phaseMonthlyReportTrigger(this.tickNumber);
      } catch (err) {
        console.error("[tick-engine] Phase 14 (monthly report) error:", err instanceof Error ? err.message : err);
      }

      // Phase 6: Broadcast
      stats.durationMs = Date.now() - startTime;
      try {
        await phaseBroadcastSnapshot(this.tickNumber, stats);
      } catch (err) {
        console.error("[tick-engine] Phase 6 (broadcast) error:", err instanceof Error ? err.message : err);
      }

      console.log(
        `[tick-engine] tick #${this.tickNumber}: ` +
        `chars=${stats.charactersUpdated}, assigned=${stats.tasksAssigned}, ` +
        `advanced=${stats.statesAdvanced}, ai=${stats.aiDispatched}, ` +
        `bubbles=${stats.bubblesGenerated}, convos=${stats.conversations}, ` +
        `meetings=${stats.meetings}, scheduled=${stats.scheduled}, projects=${stats.projectsCompleted}, ${stats.durationMs}ms`,
      );
    } catch (err) {
      console.error("[tick-engine] fatal tick error:", err instanceof Error ? err.message : err);
    } finally {
      this.running = false;
    }
  }
}
