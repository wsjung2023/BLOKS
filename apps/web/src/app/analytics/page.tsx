"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { apiGet } from "@/lib/apiClient";

interface RuntimeState {
  character_id?: string;
  workload_score?: number;
  fatigue_score?: number;
  burnout_triggered?: boolean;
}

interface CharacterItem {
  id: string;
  name: string;
  character_runtime_states?: RuntimeState | RuntimeState[];
}

interface ProjectItem {
  id: string;
  title: string;
  virtual_budget_allocated?: number;
  virtual_budget_consumed?: number;
  api_cost_accumulated?: number;
}

function toRuntime(character: CharacterItem): RuntimeState {
  const state = character.character_runtime_states;
  if (Array.isArray(state)) return state[0] ?? {};
  return state ?? {};
}

export default function AnalyticsPage() {
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  useEffect(() => {
    Promise.all([
      apiGet<{ data?: { items?: CharacterItem[] } }>("/characters?pageSize=40")
        .then((b: { data?: { items?: CharacterItem[] } }) => b.data?.items ?? [])
        .catch(() => []),
      apiGet<{ data?: { items?: ProjectItem[] } }>("/projects?pageSize=20")
        .then((b: { data?: { items?: ProjectItem[] } }) => b.data?.items ?? [])
        .catch(() => []),
    ]).then(([characterItems, projectItems]) => {
      setCharacters(characterItems);
      setProjects(projectItems);
    });
  }, []);

  const burnoutTop5 = useMemo(
    () => [...characters].sort((a, b) => (toRuntime(b).fatigue_score ?? 0) - (toRuntime(a).fatigue_score ?? 0)).slice(0, 5),
    [characters]
  );

  const budgetSummary = useMemo(() => {
    const allocated = projects.reduce((acc, p) => acc + (p.virtual_budget_allocated ?? 0), 0);
    const consumed = projects.reduce((acc, p) => acc + (p.virtual_budget_consumed ?? 0), 0);
    const apiCost = projects.reduce((acc, p) => acc + (p.api_cost_accumulated ?? 0), 0);
    return { allocated, consumed, apiCost };
  }, [projects]);

  return (
    <AppShell activeNav="analytics">
      <section style={{ padding: "1rem", display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <article style={{ border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-panel)", padding: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "0.95rem" }}>Burnout Tracker (Top 5)</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.45rem", fontSize: "0.82rem" }}>
            {burnoutTop5.map((c, idx) => (
              <li key={c.id} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{idx + 1}. {c.name}</span>
                <span style={{ color: "var(--color-toxic-red)" }}>fatigue {toRuntime(c).fatigue_score ?? 0}</span>
              </li>
            ))}
          </ul>
        </article>

        <article style={{ border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-panel)", padding: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "0.95rem" }}>Cost vs Budget</h2>
          <div style={{ fontSize: "0.82rem", display: "grid", gap: "0.35rem" }}>
            <div>Allocated: ${budgetSummary.allocated.toFixed(2)}</div>
            <div>Virtual Consumed: ${budgetSummary.consumed.toFixed(2)}</div>
            <div>API Cost: ${budgetSummary.apiCost.toFixed(2)}</div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--color-muted)" }}>
              MVP 단계에서는 시계열 그래프 대신 요약 카드로 제공
            </div>
          </div>
        </article>

        <article style={{ border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-panel)", padding: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "0.95rem" }}>Delegation Rules</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", paddingBottom: "0.45rem" }}>Delegated To</th>
                <th style={{ textAlign: "left", paddingBottom: "0.45rem" }}>Band</th>
                <th style={{ textAlign: "left", paddingBottom: "0.45rem" }}>Time-left</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Twin COO</td>
                <td>L2</td>
                <td>18h</td>
              </tr>
              <tr>
                <td>Finance Bot</td>
                <td>L1</td>
                <td>7h</td>
              </tr>
            </tbody>
          </table>
        </article>
      </section>
    </AppShell>
  );
}
