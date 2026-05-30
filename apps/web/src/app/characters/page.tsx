"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import LoadStateBlock from "@/components/common/LoadStateBlock";
import { ContextPanelContext } from "@/components/layout/AppShell-nav";
import { apiGet } from "@/lib/apiClient";
import { CharactersHelp } from "@/components/layout/AppHelp";

interface TaskCount {
  assignee_character_id: string;
  state: string;
}

interface RuntimeState {
  activity_status?: string;
  workload_score?: number;
  fatigue_score?: number;
  burnout_triggered?: boolean;
}

interface Character {
  id: string;
  name: string;
  code_name: string;
  active_mode?: string;
  persona_summary?: string;
  current_level?: number;
  total_experience?: number;
  level_experience?: number;
  total_tasks_done?: number;
  character_runtime_states?: RuntimeState | RuntimeState[];
  divisions?: { division_type?: string };
  ranks?:     { name?: string };
  roles?:     { name?: string };
}

function getRuntime(character: Character): RuntimeState | undefined {
  const state = character.character_runtime_states;
  return Array.isArray(state) ? state[0] : state;
}

function getSlug(codeName: string): string {
  return codeName.toLowerCase().replace(/_/g, "-");
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
}

// 에디터 저장 스프라이트: DOWN 방향 0번 프레임 (col=0, row=2 → pixel 0,128)
// 표시 크기 52×52, 원본 프레임 64×64 → scale 0.8125
const FRAME = 64, DISPLAY = 52, SCALE = DISPLAY / FRAME;
const SHEET_W = 576 * SCALE, SHEET_H = 256 * SCALE;
const POS_X = 0, POS_Y = -(128 * SCALE); // DOWN row offset

function CharacterSprite({ codeName }: { codeName: string }) {
  const slug = getSlug(codeName);
  const editorSrc  = `/assets/characters/${slug}.png`;
  const fallbackSrc = `/sprites-v2/char-${slug}-work-stand.png`;
  const [useEditor, setUseEditor] = useState(true);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  if (!useEditor) {
    if (fallbackFailed) return null;
    return (
      <img
        src={fallbackSrc}
        alt=""
        loading="lazy"
        onError={() => setFallbackFailed(true)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated", transform: "scale(1.18)" }}
      />
    );
  }

  return (
    <>
      {/* 에디터 스프라이트 존재 여부 감지용 숨김 img */}
      <img src={editorSrc} alt="" style={{ display: "none" }} onError={() => setUseEditor(false)} />
      <div
        style={{
          position: "absolute", inset: 0,
          backgroundImage: `url('${editorSrc}')`,
          backgroundSize: `${SHEET_W}px ${SHEET_H}px`,
          backgroundPosition: `${POS_X}px ${POS_Y}px`,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
        }}
      />
    </>
  );
}

const STATUS_LABEL: Record<string, string> = {
  Idle: "대기", Working: "근무 중", InMeeting: "회의 중", OnBreak: "휴식", Focused: "집중",
};
const DIVISION_COLOR: Record<string, string> = {
  Engineering: "#5b8dee", Marketing: "#e8824a", Research: "#5cb85c",
  Strategy: "#9b7fe8", Operations: "#7ec8c8", Executive: "#c8a84b",
};

export default function CharacterDirectoryPage() {
  const { openPanel } = useContext(ContextPanelContext);
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [taskCounts, setTaskCounts] = useState<Map<string, { active: number; done: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadCharacters() {
    setLoading(true);
    Promise.all([
      apiGet<{ data?: { items?: Character[] } }>("/characters?pageSize=40&includeLevel=true")
        .then((b) => b.data?.items ?? []),
      apiGet<{ data?: { items?: TaskCount[] } }>("/tasks?pageSize=100")
        .then((b) => b.data?.items ?? []).catch(() => [] as TaskCount[]),
    ]).then(([chars, tasks]) => {
      setCharacters(chars);
      const m = new Map<string, { active: number; done: number }>();
      for (const t of tasks) {
        if (!t.assignee_character_id) continue;
        const cur = m.get(t.assignee_character_id) ?? { active: 0, done: 0 };
        if (t.state === "Done" || t.state === "Approved") cur.done++;
        else if (t.state !== "Cancelled") cur.active++;
        m.set(t.assignee_character_id, cur);
      }
      setTaskCounts(m);
      setError(null);
    }).catch(() => {
      setCharacters([]);
      setError("캐릭터 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }).finally(() => setLoading(false));
  }

  useEffect(() => { loadCharacters(); }, []);

  const burnoutCount = useMemo(
    () => characters.filter((c) => getRuntime(c)?.burnout_triggered).length,
    [characters]
  );

  function openCharacterPanel(character: Character) {
    const runtime = getRuntime(character);
    const lv = character.current_level ?? 1;
    openPanel(
      character.name,
      <div style={{ display: "grid", gap: "0.6rem", fontSize: "0.82rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ background: "rgba(255,255,255,0.12)", color: "var(--color-text)", border: "1px solid var(--color-border)", padding: "0.2rem 0.6rem", borderRadius: 999, fontWeight: 700, fontSize: "0.78rem" }}>
            Lv.{lv}
          </span>
          {character.divisions?.division_type && (
            <span style={{ color: DIVISION_COLOR[character.divisions.division_type] ?? "var(--color-muted)", fontWeight: 600 }}>
              {character.divisions.division_type}
            </span>
          )}
        </div>
        {character.ranks?.name && <div><span style={{ color: "var(--color-muted)" }}>직급: </span>{character.ranks.name}</div>}
        {character.roles?.name && <div><span style={{ color: "var(--color-muted)" }}>역할: </span>{character.roles.name}</div>}
        <div><span style={{ color: "var(--color-muted)" }}>코드명: </span>{character.code_name}</div>
        <div><span style={{ color: "var(--color-muted)" }}>모드: </span>{character.active_mode ?? "N/A"}</div>
        <div style={{ color: runtime?.burnout_triggered ? "#e05c5c" : "var(--color-muted)" }}>
          워크로드 {runtime?.workload_score ?? 0} · 피로도 {runtime?.fatigue_score ?? 0}
          {runtime?.burnout_triggered ? " 🔥 번아웃" : ""}
        </div>
        <div style={{ color: "var(--color-muted)", fontSize: "0.78rem", lineHeight: 1.6 }}>
          {character.persona_summary}
        </div>
        <div><span style={{ color: "var(--color-muted)" }}>누적 경험치: </span>{character.total_experience ?? 0} · 완료 {character.total_tasks_done ?? 0}개</div>
        <button
          onClick={() => router.push(`/characters/editor?id=${character.id}`)}
          style={{
            marginTop: "0.5rem", width: "100%", padding: "0.5rem",
            background: "rgba(100,180,255,0.15)", border: "1px solid rgba(100,180,255,0.3)",
            borderRadius: 8, color: "#7aaee8", cursor: "pointer", fontSize: "0.82rem",
          }}
        >
          🎨 스프라이트 에디터에서 편집
        </button>
      </div>
    );
  }

  return (
    <AppShell activeNav="directory" helpContent={<CharactersHelp />}>
      <section style={{ padding: "1rem", height: "100%", overflow: "auto" }}>
        <header style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.1rem" }}>Character Directory</h1>
            <p style={{ margin: "0.4rem 0 0", color: "var(--color-muted)", fontSize: "0.82rem" }}>
              총 {characters.length}명 · Burnout {burnoutCount}명
            </p>
          </div>
        </header>

        {loading ? (
          <LoadStateBlock message="캐릭터 로딩 중..." />
        ) : error ? (
          <LoadStateBlock message={error} tone="error" actionLabel="다시 시도" onAction={loadCharacters} />
        ) : characters.length === 0 ? (
          <LoadStateBlock message="표시할 캐릭터가 없습니다." actionLabel="새로고침" onAction={loadCharacters} />
        ) : (
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
            {characters.map((character) => {
              const runtime = getRuntime(character);
              const locked = character.active_mode === "Specialist";
              const tc = taskCounts.get(character.id);
              const lv = character.current_level ?? 1;
              const wl = runtime?.workload_score ?? 0;
              const fa = runtime?.fatigue_score ?? 0;
              const isBurnout = runtime?.burnout_triggered ?? false;
              const barColor = isBurnout ? "#e05c5c" : wl > 70 ? "#e07a3a" : "#4caf7d";
              const divType = character.divisions?.division_type;
              const divColor = DIVISION_COLOR[divType ?? ""] ?? "var(--color-muted)";
              const statusLabel = STATUS_LABEL[runtime?.activity_status ?? ""] ?? runtime?.activity_status ?? "대기";

              return (
                <article
                  key={character.id}
                  onClick={() => openCharacterPanel(character)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCharacterPanel(character); } }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${character.name} 상세 보기`}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    padding: "0.85rem",
                    background: locked ? "rgba(255,255,255,0.03)" : "var(--color-panel)",
                    opacity: locked ? 0.7 : 1,
                    cursor: "pointer",
                    display: "grid",
                    gap: "0.6rem",
                  }}
                >
                  {/* 헤더: 스프라이트 + 이름 */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div
                      aria-hidden="true"
                      style={{
                        position: "relative", width: 52, height: 52, flexShrink: 0,
                        borderRadius: 10, overflow: "hidden",
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(218,198,159,0.42) 100%)",
                        display: "grid", placeItems: "center",
                      }}
                    >
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "rgba(92,68,34,0.72)", letterSpacing: "0.04em" }}>
                        {getInitials(character.name)}
                      </span>
                      <CharacterSprite codeName={character.code_name} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ display: "block", lineHeight: 1.2, fontSize: "0.9rem" }}>{character.name}</strong>
                      <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginTop: 1 }}>{character.code_name}</div>
                      {divType && (
                        <div style={{ fontSize: "0.72rem", color: divColor, fontWeight: 600, marginTop: 2 }}>{divType}</div>
                      )}
                    </div>
                    {locked && <span style={{ fontSize: "0.68rem", color: "var(--color-muted)", flexShrink: 0 }}>LOCKED</span>}
                  </div>

                  {/* 직급 / 역할 */}
                  {(character.ranks?.name || character.roles?.name) && (
                    <div style={{ fontSize: "0.73rem", color: "var(--color-muted)", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      {character.ranks?.name && <span>{character.ranks.name}</span>}
                      {character.ranks?.name && character.roles?.name && <span style={{ opacity: 0.4 }}>·</span>}
                      {character.roles?.name && <span>{character.roles.name}</span>}
                    </div>
                  )}

                  {/* 페르소나 요약 */}
                  <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {character.persona_summary ?? "—"}
                  </div>

                  {/* 뱃지 행 */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                    <span style={{ background: "rgba(255,255,255,0.1)", color: "var(--color-text)", border: "1px solid var(--color-border)", padding: "0.1rem 0.45rem", borderRadius: 999, fontSize: "0.68rem", fontWeight: 700 }}>
                      Lv.{lv}
                    </span>
                    <span style={{ fontSize: "0.68rem", color: isBurnout ? "#e05c5c" : wl > 70 ? "#e07a3a" : "var(--color-muted)" }}>
                      {isBurnout ? "🔥 번아웃" : statusLabel}
                    </span>
                    {tc && tc.active > 0 && (
                      <span style={{ background: "rgba(90,140,220,0.15)", color: "#7aaee8", padding: "0.1rem 0.4rem", borderRadius: 999, fontSize: "0.68rem" }}>
                        진행 {tc.active}
                      </span>
                    )}
                    {tc && tc.done > 0 && (
                      <span style={{ background: "rgba(76,175,125,0.12)", color: "#4caf7d", padding: "0.1rem 0.4rem", borderRadius: 999, fontSize: "0.68rem" }}>
                        완료 {tc.done}
                      </span>
                    )}
                  </div>

                  {/* 워크로드 바 */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.67rem", color: "var(--color-muted)", marginBottom: 3 }}>
                      <span>워크로드</span>
                      <span>{wl} · 피로 {fa}</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                      <div style={{ width: `${wl}%`, height: "100%", background: barColor, borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
