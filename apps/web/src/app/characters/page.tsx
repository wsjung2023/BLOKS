"use client";

import { useContext, useEffect, useMemo, useState } from "react";
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
}

function getRuntime(character: Character): RuntimeState | undefined {
  const state = character.character_runtime_states;
  return Array.isArray(state) ? state[0] : state;
}

function getCharacterSpriteUrl(codeName: string): string {
  return `/sprites-v2/char-${codeName.toLowerCase().replace(/_/g, "-")}-work-stand.png`;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function CharacterDirectoryPage() {
  const { openPanel } = useContext(ContextPanelContext);
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

  useEffect(() => {
    loadCharacters();
  }, []);

  const burnoutCount = useMemo(
    () => characters.filter((c) => getRuntime(c)?.burnout_triggered).length,
    [characters]
  );

  function openCharacterPanel(character: Character) {
    const runtime = getRuntime(character);
    const lv = character.current_level ?? 1;
    const totalExp = character.total_experience ?? 0;
    const tasksDone = character.total_tasks_done ?? 0;
    openPanel(
      character.name,
      <div style={{ display: "grid", gap: "0.6rem", fontSize: "0.82rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ background: "rgba(255,215,0,0.15)", color: "#ffd700", padding: "0.2rem 0.6rem", borderRadius: 999, fontWeight: 700 }}>
            Lv.{lv}
          </span>
          <span style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{totalExp} exp 누적 · 완료 {tasksDone}개</span>
        </div>
        <div>Code: {character.code_name}</div>
        <div>Mode: {character.active_mode ?? "N/A"}</div>
        <div style={{ color: runtime?.burnout_triggered ? "#e05c5c" : "var(--color-muted)" }}>
          Workload: {runtime?.workload_score ?? 0} · Fatigue: {runtime?.fatigue_score ?? 0}
          {runtime?.burnout_triggered ? " 🔥 번아웃" : ""}
        </div>
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
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            }}
          >
            {characters.map((character) => {
              const runtime = getRuntime(character);
              const locked = character.active_mode === "Specialist";

              return (
                <article
                  key={character.id}
                  onClick={() => openCharacterPanel(character)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openCharacterPanel(character);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${character.name} 상세 보기`}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    padding: "0.8rem",
                    background: locked ? "rgba(255,255,255,0.03)" : "var(--color-panel)",
                    opacity: locked ? 0.7 : 1,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", minWidth: 0 }}>
                      <div
                        aria-hidden="true"
                        style={{
                          position: "relative",
                          width: 52,
                          height: 52,
                          flexShrink: 0,
                          borderRadius: 12,
                          overflow: "hidden",
                          border: "1px solid rgba(0,0,0,0.08)",
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(218,198,159,0.42) 100%)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: "rgba(92, 68, 34, 0.72)",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {getInitials(character.name)}
                        </span>
                        <img
                          src={getCharacterSpriteUrl(character.code_name)}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            imageRendering: "pixelated",
                            transform: "scale(1.18)",
                          }}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", lineHeight: 1.2 }}>{character.name}</strong>
                        <div style={{ marginTop: "0.3rem", fontSize: "0.75rem", color: "var(--color-muted)" }}>
                          {character.code_name}
                        </div>
                      </div>
                    </div>
                    {locked ? <span style={{ fontSize: "0.7rem", color: "var(--color-muted)", flexShrink: 0 }}>LOCKED</span> : null}
                  </div>
                  <div style={{ marginTop: "0.7rem", fontSize: "0.78rem" }}>
                    {(character.persona_summary ?? "persona 미등록").split(" ")[0]}
                  </div>

                  {(() => {
                    const tc = taskCounts.get(character.id);
                    const lv = character.current_level ?? 1;
                    const wl = runtime?.workload_score ?? 0;
                    const fa = runtime?.fatigue_score ?? 0;
                    const isBurnout = runtime?.burnout_triggered ?? false;
                    const barColor = isBurnout ? "#e05c5c" : wl > 70 ? "#f0a500" : "#4caf7d";
                    return (
                      <div style={{ marginTop: "0.8rem", display: "grid", gap: "0.45rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ background: "rgba(255,215,0,0.12)", color: "#ffd700", padding: "0.1rem 0.45rem", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700 }}>
                            Lv.{lv}
                          </span>
                        </div>
                        {tc && (
                          <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.72rem" }}>
                            {tc.active > 0 && (
                              <span style={{ background: "rgba(240,165,0,0.12)", color: "#f0a500", padding: "0.1rem 0.4rem", borderRadius: 999 }}>
                                진행 {tc.active}
                              </span>
                            )}
                            {tc.done > 0 && (
                              <span style={{ background: "rgba(76,175,125,0.12)", color: "#4caf7d", padding: "0.1rem 0.4rem", borderRadius: 999 }}>
                                완료 {tc.done}
                              </span>
                            )}
                          </div>
                        )}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--color-muted)", marginBottom: 3 }}>
                            <span>{isBurnout ? "🔥 번아웃" : "워크로드"}</span>
                            <span>{wl} / fa:{fa}</span>
                          </div>
                          <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                            <div style={{ width: `${wl}%`, height: "100%", background: barColor, borderRadius: 3, transition: "width 0.3s" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
