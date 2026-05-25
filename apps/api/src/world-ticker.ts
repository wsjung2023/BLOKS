// In-process world ticker — runs inside the API so it can emit SSE directly.
// The worker's tick-engine does the heavy lifting (AI, memory, etc.).
// This handles the lightweight visual simulation: movement, bubbles, status.

import { getDb } from "@bloks/db";
import { emitWorldEvent } from "./routes/stream.js";

const TICK_MS = Math.max(
  15_000,
  parseInt(process.env["WORLD_TICK_INTERVAL_MS"] ?? "30000", 10),
);

const ACTIVITY_CYCLE = ["Working", "Working", "Working", "Idle", "Working", "InMeeting", "Working"] as const;
type Activity = typeof ACTIVITY_CYCLE[number];

const LOCATION_MAP: Record<Activity, string> = {
  Working:   "desk",
  Idle:      "lounge",
  InMeeting: "meeting-room",
};

const BUBBLES: string[] = [
  "태스크 분석 중...",
  "데이터 검토 완료",
  "보고서 초안 작성 중",
  "팀원과 협의 필요",
  "AI 모델 실행 중...",
  "완료! 다음 태스크 확인",
  "코드 리뷰 진행 중",
  "일정 조율 중",
  "결과물 정리 완료",
  "미팅 준비 중...",
];

let tick = 0;

async function runTick(): Promise<void> {
  const sb = getDb();
  tick++;
  const now = new Date().toISOString();

  const { data: chars } = await sb
    .from("characters")
    .select("id,code_name,active_flag,ai_enabled,division_id")
    .eq("active_flag", true);

  if (!chars?.length) return;

  const activeChars = chars as { id: string; code_name: string; ai_enabled: boolean; division_id?: string }[];
  const updated: string[] = [];

  for (let i = 0; i < activeChars.length; i++) {
    const char = activeChars[i]!;
    // Each character offsets through the cycle differently
    const activity = ACTIVITY_CYCLE[(tick + i * 2) % ACTIVITY_CYCLE.length]!;
    const location = LOCATION_MAP[activity];

    // Update runtime state in DB
    await sb
      .from("character_runtime_states")
      .update({ activity_status: activity, location_zone: location, updated_at: now })
      .eq("character_id", char.id);

    // Emit movement event
    emitWorldEvent("character_moved", {
      characterId: char.id,
      location,
      activity_status: activity,
    });

    emitWorldEvent("runtime_update", {
      characterId: char.id,
      activity_status: activity,
      location_zone: location,
    });

    updated.push(char.id);
  }

  // Emit a chat bubble for a random AI-enabled character
  const aiChars = activeChars.filter((c) => c.ai_enabled);
  if (aiChars.length > 0) {
    const speaker = aiChars[tick % aiChars.length]!;
    const bubble = BUBBLES[tick % BUBBLES.length]!;
    emitWorldEvent("character_bubble", {
      characterId: speaker.id,
      message: bubble,
      type: "work",
    });
  }

  // Broadcast tick summary
  emitWorldEvent("world_tick", {
    tick,
    activeChars: updated.length,
    timestamp: now,
  });

  console.log(`[world-ticker] tick #${tick} — ${updated.length}명 업데이트`);
}

export function startWorldTicker(): void {
  // First tick after 4s (let server finish starting)
  setTimeout(() => { void runTick(); }, 4_000);
  setInterval(() => { void runTick(); }, TICK_MS);
  console.log(`[world-ticker] 시작 (간격: ${TICK_MS / 1000}초)`);
}
