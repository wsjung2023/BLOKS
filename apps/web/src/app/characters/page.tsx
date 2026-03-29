"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import LoadStateBlock from "@/components/common/LoadStateBlock";
import { ContextPanelContext } from "@/components/layout/AppShell-nav";
import { apiGet } from "@/lib/apiClient";

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
  character_runtime_states?: RuntimeState | RuntimeState[];
}

function getRuntime(character: Character): RuntimeState | undefined {
  const state = character.character_runtime_states;
  return Array.isArray(state) ? state[0] : state;
}

export default function CharacterDirectoryPage() {
  const { openPanel } = useContext(ContextPanelContext);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadCharacters() {
    setLoading(true);
    apiGet<{ data?: { items?: Character[] } }>("/characters?pageSize=40")
      .then((body: { data?: { items?: Character[] } }) => {
        setCharacters(body.data?.items ?? []);
        setError(null);
      })
      .catch(() => {
        setCharacters([]);
        setError("캐릭터 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      })
      .finally(() => setLoading(false));
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
    openPanel(
      character.name,
      <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.82rem" }}>
        <div>Code: {character.code_name}</div>
        <div>Mode: {character.active_mode ?? "N/A"}</div>
        <div>Workload: {runtime?.workload_score ?? 0}</div>
        <div>Fatigue: {runtime?.fatigue_score ?? 0}</div>
        <div>Burnout: {runtime?.burnout_triggered ? "YES" : "NO"}</div>
      </div>
    );
  }

  return (
    <AppShell activeNav="directory">
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{character.name}</strong>
                    {locked ? <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>LOCKED</span> : null}
                  </div>
                  <div style={{ marginTop: "0.3rem", fontSize: "0.75rem", color: "var(--color-muted)" }}>
                    {character.code_name}
                  </div>
                  <div style={{ marginTop: "0.7rem", fontSize: "0.78rem" }}>
                    {(character.persona_summary ?? "persona 미등록").split(" ")[0]}
                  </div>

                  <div style={{ marginTop: "0.7rem", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    <span style={{ border: "1px solid var(--color-border)", borderRadius: 999, padding: "0.15rem 0.45rem", fontSize: "0.68rem" }}>mod_gpt4o</span>
                    <span style={{ border: "1px solid var(--color-border)", borderRadius: 999, padding: "0.15rem 0.45rem", fontSize: "0.68rem" }}>mod_claude3</span>
                  </div>

                  <div style={{ marginTop: "0.8rem", fontSize: "0.72rem", color: "var(--color-muted)", display: "grid", gap: "0.15rem" }}>
                    <span>Workload: {runtime?.workload_score ?? 0}</span>
                    <span>Fatigue: {runtime?.fatigue_score ?? 0}</span>
                    <span style={{ color: runtime?.burnout_triggered ? "var(--color-toxic-red)" : "var(--color-muted)" }}>
                      Burnout: {runtime?.burnout_triggered ? "YES" : "NO"}
                    </span>
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
