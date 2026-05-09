// World Tick Engine — the "heart" of BLOKS
// Runs every WORLD_TICK_INTERVAL_MS (default 60s) and:
//   Phase 1: Update character runtime states (workload, fatigue, activity)
//   Phase 2: Auto-assign unassigned tasks to best-fit characters
//   Phase 3: Auto-advance stale state transitions
//   Phase 4: Dispatch InProgress tasks to ai-actions queue
//   Phase 5: Update character locations based on activity
//   Phase 6: Broadcast world snapshot via Redis Pub/Sub → SSE

import { Queue } from "bullmq";
import { QUEUE_NAMES, TaskState } from "@bloks/shared";
import { getSupabase } from "@bloks/db";
import { routeAI } from "@bloks/ai-router";
import Redis from "ioredis";

// ── Config ────────────────────────────────────────────────────────────────────

const TICK_INTERVAL_MS = parseInt(process.env["WORLD_TICK_INTERVAL_MS"] ?? "60000", 10);
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min before auto-advancing states
const WORLD_EVENTS_CHANNEL = "world:events";

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

// ── Redis + BullMQ setup ─────────────────────────────────────────────────────

const redisConnection = {
  host: process.env["REDIS_HOST"] ?? "127.0.0.1",
  port: Number(process.env["REDIS_PORT"] ?? 6379),
  password: process.env["REDIS_PASSWORD"] || undefined,
};

let _redisPub: Redis | null = null;
function getRedisPub(): Redis {
  if (_redisPub) return _redisPub;
  _redisPub = new Redis({
    ...redisConnection,
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
  _redisPub.connect().catch(() => {});
  return _redisPub;
}

let _aiActionsQueue: Queue | null = null;
function getAiActionsQueue(): Queue {
  if (_aiActionsQueue) return _aiActionsQueue;
  _aiActionsQueue = new Queue(QUEUE_NAMES.aiActions, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    },
  });
  return _aiActionsQueue;
}

async function publishWorldEvent(type: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await getRedisPub().publish(
      WORLD_EVENTS_CHANNEL,
      JSON.stringify({ type, payload, timestamp: new Date().toISOString() }),
    );
  } catch {
    // Non-fatal
  }
}

// ── Phase 1: Character runtime state updates ─────────────────────────────────

async function phaseUpdateCharacterStates(): Promise<number> {
  const sb = getSupabase();
  const now = new Date().toISOString();

  // Get all characters with their active task counts
  const { data: runtimes } = await sb
    .from("character_runtime_states")
    .select("character_id, workload_score, fatigue_score, burnout_triggered, activity_status");

  if (!runtimes || runtimes.length === 0) return 0;

  let updated = 0;

  for (const rt of runtimes) {
    const charId = rt.character_id as string;

    // Count active tasks for this character
    const { count } = await sb
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_character_id", charId)
      .in("state", [TaskState.Assigned, TaskState.Accepted, TaskState.InProgress, TaskState.PendingReview]);

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
    .eq("state", TaskState.Created)
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
      state: TaskState.Assigned,
      updated_at: now,
    }).eq("id", task.id);

    void publishWorldEvent("task_state_changed", {
      taskId: task.id,
      characterId: bestCandidate.character_id,
      from: TaskState.Created,
      to: TaskState.Assigned,
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

  const advance = async (id: string, from: TaskState, to: TaskState) => {
    await sb.from("tasks").update({ state: to, updated_at: now }).eq("id", id);
    void publishWorldEvent("task_state_changed", { taskId: id, from, to });
    advanced++;
  };

  // Assigned → Accepted (after 5 min)
  const { data: assignedTasks } = await sb
    .from("tasks")
    .select("id")
    .eq("state", TaskState.Assigned)
    .lt("updated_at", staleThreshold)
    .not("assignee_character_id", "is", null)
    .limit(20);

  for (const task of assignedTasks ?? []) {
    await advance(task.id, TaskState.Assigned, TaskState.Accepted);
  }

  // Accepted → InProgress (after 5 min)
  const { data: acceptedTasks } = await sb
    .from("tasks")
    .select("id")
    .eq("state", TaskState.Accepted)
    .lt("updated_at", staleThreshold)
    .limit(20);

  for (const task of acceptedTasks ?? []) {
    await advance(task.id, TaskState.Accepted, TaskState.InProgress);
  }

  return advanced;
}

// ── Phase 4: Dispatch AI actions ─────────────────────────────────────────────

async function phaseDispatchAiActions(): Promise<number> {
  const sb = getSupabase();

  // Find InProgress tasks that haven't been processed by AI yet
  const { data: readyTasks } = await sb
    .from("tasks")
    .select("id, assignee_character_id")
    .eq("state", TaskState.InProgress)
    .is("ai_output", null)
    .not("assignee_character_id", "is", null)
    .limit(5);

  if (!readyTasks || readyTasks.length === 0) return 0;

  const queue = getAiActionsQueue();
  let dispatched = 0;

  for (const task of readyTasks) {
    const jobId = `tick_ai_${task.id}_${Date.now()}`;

    await queue.add("execute", {
      queueName: QUEUE_NAMES.aiActions,
      payload: {
        input: {
          taskId: task.id,
          characterId: task.assignee_character_id,
        },
      },
      requestedByCharacterId: "system:tick-engine",
      queuedAt: new Date().toISOString(),
      traceId: `tick-${Date.now()}`,
    }, { jobId });

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

const BUBBLE_TEMPLATES: Record<string, string[]> = {
  Working: [
    "이 작업 거의 다 됐어...",
    "집중, 집중...",
    "음... 이 부분은 좀 더 생각해봐야겠는데",
    "데드라인 전에 끝낼 수 있을 거야",
  ],
  Idle: [
    "커피 한 잔 마셔야겠다",
    "다음 할 일이 뭐지?",
    "잠깐 스트레칭이나 해야지",
    "오늘 날씨 좋은데...",
  ],
  Overloaded: [
    "일이 너무 많아...",
    "우선순위를 다시 정리해야 할 것 같은데",
    "도움이 좀 필요할 것 같아",
  ],
  Burnout: [
    "(더 이상 못하겠다...)",
    "(쉬어야 해...)",
    "(...)",
  ],
};

async function phaseGenerateBubbles(tickNumber: number): Promise<number> {
  // Only generate bubbles every other tick to save costs
  if (tickNumber % 2 !== 0) return 0;

  const sb = getSupabase();

  // Get active characters (not Offline)
  const { data: runtimes } = await sb
    .from("character_runtime_states")
    .select("character_id, activity_status")
    .neq("activity_status", "Offline");

  if (!runtimes || runtimes.length === 0) return 0;

  // Pick 2-3 random characters
  const shuffled = runtimes.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(3, shuffled.length));
  let generated = 0;

  for (const rt of selected) {
    const charId = rt.character_id as string;
    const status = (rt.activity_status as string) ?? "Idle";

    // Get character name
    const { data: char } = await sb
      .from("characters")
      .select("name, code_name, persona_summary")
      .eq("id", charId)
      .single();

    if (!char) continue;

    const bubbleType = status === "Burnout" || status === "Idle" ? "thought" : "speech";
    let text: string;

    // Try LLM generation for some, use templates as fallback
    const useLLM = Math.random() < 0.3; // 30% chance of LLM, 70% template

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
        // Fallback to template
        const templates = BUBBLE_TEMPLATES[status] ?? BUBBLE_TEMPLATES["Idle"]!;
        text = templates[Math.floor(Math.random() * templates.length)]!;
      }
    } else {
      const templates = BUBBLE_TEMPLATES[status] ?? BUBBLE_TEMPLATES["Idle"]!;
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

const CONVERSATION_STARTERS: string[] = [
  "요즘 프로젝트 어떨?",
  "점심 같이 먹을래?",
  "이거 너한테 도움 요청해도 될까?",
  "어제 미팅 내용 봤어?",
  "오늘 바쁘?",
];

async function phaseAutonomousConversations(tickNumber: number): Promise<number> {
  // Every 3rd tick
  if (tickNumber % 3 !== 0) return 0;

  const sb = getSupabase();

  // Get characters grouped by location_zone
  const { data: runtimes } = await sb
    .from("character_runtime_states")
    .select("character_id, activity_status, location_zone")
    .neq("activity_status", "Offline")
    .neq("activity_status", "Burnout");

  if (!runtimes || runtimes.length < 2) return 0;

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

    // Get character names
    const { data: chars } = await sb
      .from("characters")
      .select("id, name, persona_summary")
      .in("id", [charA, charB]);

    if (!chars || chars.length < 2) continue;
    const a = chars.find((c) => c.id === charA);
    const b = chars.find((c) => c.id === charB);
    if (!a || !b) continue;

    // Generate conversation (LLM 20%, template 80%)
    const useLLM = Math.random() < 0.2;
    let textA: string;
    let textB: string;

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
        textA = lines[0]?.replace(/^[AB]:\s*/, "").trim().slice(0, 40) ?? CONVERSATION_STARTERS[Math.floor(Math.random() * CONVERSATION_STARTERS.length)]!;
        textB = lines[1]?.replace(/^[AB]:\s*/, "").trim().slice(0, 40) ?? "응, 그렇게 하자!";
      } catch {
        textA = CONVERSATION_STARTERS[Math.floor(Math.random() * CONVERSATION_STARTERS.length)]!;
        textB = "응, 좋아!";
      }
    } else {
      textA = CONVERSATION_STARTERS[Math.floor(Math.random() * CONVERSATION_STARTERS.length)]!;
      textB = "응, 좋아!";
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

// ── Tick Stats ────────────────────────────────────────────────────────────────

interface TickStats {
  charactersUpdated: number;
  tasksAssigned: number;
  statesAdvanced: number;
  aiDispatched: number;
  bubblesGenerated: number;
  conversations: number;
  meetings: number;
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
      aiDispatched: 0,
      bubblesGenerated: 0,
      conversations: 0,
      meetings: 0,
      durationMs: 0,
    };

    try {
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
        `meetings=${stats.meetings}, ${stats.durationMs}ms`,
      );
    } catch (err) {
      console.error("[tick-engine] fatal tick error:", err instanceof Error ? err.message : err);
    } finally {
      this.running = false;
    }
  }
}
