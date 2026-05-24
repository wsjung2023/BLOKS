"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import LoadStateBlock from "@/components/common/LoadStateBlock";
import { apiGet } from "@/lib/apiClient";
import { AnalyticsHelp } from "@/components/layout/AppHelp";

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
  state?: string;
  virtual_budget_allocated?: number;
  virtual_budget_consumed?: number;
  api_cost_accumulated?: number;
}

interface TaskItem {
  id: string;
  state: string;
  project_id?: string;
  assignee_character_id?: string;
  priority?: string;
}

interface QueueItem {
  name: string;
  depth: number | null;
}

interface CostData {
  totalCostUsd: number;
  byProject: Array<{ id: string; title: string; costUsd: number }>;
}

function toRuntime(character: CharacterItem): RuntimeState {
  const state = character.character_runtime_states;
  if (Array.isArray(state)) return state[0] ?? {};
  return state ?? {};
}

const STATE_COLORS: Record<string, string> = {
  Todo: "#6c8ebf",
  InProgress: "#f0a500",
  InReview: "#a06cd5",
  Blocked: "#e05c5c",
  Done: "#4caf7d",
};

const PROJECT_STATE_COLORS: Record<string, string> = {
  Draft: "#6c8ebf",
  Active: "#f0a500",
  Released: "#4caf7d",
  Completed: "#4caf7d",
  Cancelled: "#999",
};

function ProgressBar({ value, max, color = "#4caf7d" }: { value: number; max: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s" }} />
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "0.875rem 1rem" }}>
      <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: color ?? "var(--color-text)", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [costData, setCostData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadAnalytics() {
    setLoading(true);
    Promise.all([
      apiGet<{ data?: { items?: CharacterItem[] } }>("/characters?pageSize=40")
        .then((b) => b.data?.items ?? []),
      apiGet<{ data?: { items?: ProjectItem[] } }>("/projects?pageSize=30")
        .then((b) => b.data?.items ?? []),
      apiGet<{ data?: { items?: TaskItem[] } }>("/tasks?pageSize=200")
        .then((b) => b.data?.items ?? []),
      apiGet<{ data?: { queues?: QueueItem[] } }>("/metrics/queues")
        .then((b) => b.data?.queues ?? []).catch(() => [] as QueueItem[]),
      apiGet<{ data?: CostData }>("/metrics/costs")
        .then((b) => b.data ?? null).catch(() => null),
    ]).then(([characterItems, projectItems, taskItems, queueItems, cost]) => {
      setCharacters(characterItems);
      setProjects(projectItems);
      setTasks(taskItems);
      setQueues(queueItems);
      setCostData(cost);
      setError(null);
    }).catch(() => {
      setError("분석 데이터를 불러오지 못했습니다.");
    }).finally(() => setLoading(false));
  }

  useEffect(() => { loadAnalytics(); }, []);

  const taskStats = useMemo(() => {
    const counts: Record<string, number> = { Todo: 0, InProgress: 0, InReview: 0, Blocked: 0, Done: 0 };
    for (const t of tasks) {
      const s = t.state;
      if (s in counts) counts[s] = (counts[s] ?? 0) + 1;
      else if (s === "Created" || s === "Accepted" || s === "Assigned") counts["Todo"] = (counts["Todo"] ?? 0) + 1;
      else if (s === "PendingReview") counts["InReview"] = (counts["InReview"] ?? 0) + 1;
      else if (s === "Approved") counts["Done"] = (counts["Done"] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  const completionRate = tasks.length === 0 ? 0 : Math.round(((taskStats["Done"] ?? 0) / tasks.length) * 100);

  const budgetSummary = useMemo(() => {
    const allocated = projects.reduce((a, p) => a + (p.virtual_budget_allocated ?? 0), 0);
    const consumed = projects.reduce((a, p) => a + (p.virtual_budget_consumed ?? 0), 0);
    const apiCost = projects.reduce((a, p) => a + (p.api_cost_accumulated ?? 0), 0);
    return { allocated, consumed, apiCost };
  }, [projects]);

  const projectTaskMap = useMemo(() => {
    const m: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      if (!t.project_id) continue;
      if (!m[t.project_id]) m[t.project_id] = { total: 0, done: 0 };
      (m[t.project_id] as { total: number; done: number }).total++;
      if (t.state === "Done" || t.state === "Approved") (m[t.project_id] as { total: number; done: number }).done++;
    }
    return m;
  }, [tasks]);

  const activeProjects = projects.filter((p) => p.state !== "Cancelled").slice(0, 6);

  const workloadTop = useMemo(
    () =>
      [...characters]
        .filter((c) => (toRuntime(c).workload_score ?? 0) > 0)
        .sort((a, b) => (toRuntime(b).workload_score ?? 0) - (toRuntime(a).workload_score ?? 0))
        .slice(0, 8),
    [characters]
  );

  const characterTaskCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tasks) {
      if (t.assignee_character_id && t.state !== "Done" && t.state !== "Cancelled") {
        m[t.assignee_character_id] = (m[t.assignee_character_id] ?? 0) + 1;
      }
    }
    return m;
  }, [tasks]);

  return (
    <AppShell activeNav="analytics" helpContent={<AnalyticsHelp />}>
      {loading ? (
        <LoadStateBlock message="분석 데이터 로딩 중..." />
      ) : error ? (
        <LoadStateBlock message={error} tone="error" actionLabel="다시 시도" onAction={loadAnalytics} />
      ) : (
        <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* ─── 요약 통계 ─── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
            <StatCard label="전체 태스크" value={tasks.length} />
            <StatCard label="완료율" value={`${completionRate}%`} sub={`${taskStats["Done"] ?? 0} / ${tasks.length}`} color="#4caf7d" />
            <StatCard label="진행 중" value={taskStats["InProgress"] ?? 0} color="#f0a500" />
            <StatCard label="검토 중" value={taskStats["InReview"] ?? 0} color="#a06cd5" />
            <StatCard label="블로킹" value={taskStats["Blocked"] ?? 0} color="#e05c5c" />
            <StatCard label="AI 비용 (당월)" value={costData ? `$${costData.totalCostUsd.toFixed(4)}` : `$${budgetSummary.apiCost.toFixed(3)}`} sub={`예산 $${budgetSummary.allocated.toFixed(2)}`} />
            <StatCard
              label="큐 적체"
              value={queues.length === 0 ? "-" : queues.reduce((s, q) => s + (q.depth ?? 0), 0)}
              sub={queues.filter((q) => (q.depth ?? 0) > 0).map((q) => `${q.name.replace("monthly-report", "report").replace("analytics-rollups", "analytics")}: ${q.depth}`).join(" | ") || "정상"}
              color={queues.some((q) => (q.depth ?? 0) > 50) ? "#e05c5c" : "#4caf7d"}
            />
          </div>

          {/* ─── 상태 분포 바 ─── */}
          <div style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "0.875rem 1rem" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.75rem" }}>태스크 상태 분포</div>
            <div style={{ display: "flex", height: 20, borderRadius: 6, overflow: "hidden", gap: 1 }}>
              {Object.entries(taskStats).map(([state, count]) =>
                count > 0 ? (
                  <div
                    key={state}
                    title={`${state}: ${count}`}
                    style={{ flex: count, background: STATE_COLORS[state] ?? "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", color: "#fff", fontWeight: 600, minWidth: 2 }}
                  >
                    {count > 2 ? count : ""}
                  </div>
                ) : null
              )}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              {Object.entries(STATE_COLORS).map(([state, color]) => (
                <span key={state} style={{ fontSize: "0.72rem", color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                  {state} ({taskStats[state] ?? 0})
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>

            {/* ─── 프로젝트 진행률 ─── */}
            <div style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "0.875rem 1rem" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.75rem" }}>프로젝트 진행률</div>
              {activeProjects.length === 0 ? (
                <div style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>프로젝트 없음</div>
              ) : (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {activeProjects.map((p) => {
                    const pm = projectTaskMap[p.id] ?? { total: 0, done: 0 };
                    const pct = pm.total === 0 ? 0 : Math.round((pm.done / pm.total) * 100);
                    const stateColor = PROJECT_STATE_COLORS[p.state ?? ""] ?? "#888";
                    return (
                      <div key={p.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.78rem" }}>
                          <span style={{ fontWeight: 500 }}>{(p.title as string).slice(0, 22)}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-muted)" }}>
                            <span style={{ width: 6, height: 6, borderRadius: 3, background: stateColor, display: "inline-block" }} />
                            {pm.done}/{pm.total}
                          </span>
                        </div>
                        <ProgressBar value={pm.done} max={pm.total || 1} color={pct === 100 ? "#4caf7d" : "#f0a500"} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── 캐릭터 워크로드 ─── */}
            <div style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "0.875rem 1rem" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.75rem" }}>캐릭터 워크로드</div>
              {workloadTop.length === 0 ? (
                <div style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>워크로드 데이터 없음</div>
              ) : (
                <div style={{ display: "grid", gap: "0.55rem" }}>
                  {workloadTop.map((c) => {
                    const rt = toRuntime(c);
                    const wl = rt.workload_score ?? 0;
                    const fa = rt.fatigue_score ?? 0;
                    const isBurnout = rt.burnout_triggered ?? false;
                    const activeTasks = characterTaskCount[c.id] ?? 0;
                    const barColor = isBurnout ? "#e05c5c" : wl > 70 ? "#f0a500" : "#4caf7d";
                    return (
                      <div key={c.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: "0.75rem" }}>
                          <span>
                            {isBurnout ? "🔥 " : ""}{c.name}
                            {activeTasks > 0 && <span style={{ marginLeft: 4, color: "var(--color-muted)" }}>({activeTasks})</span>}
                          </span>
                          <span style={{ color: "var(--color-muted)" }}>
                            wl:{wl} fa:{fa}
                          </span>
                        </div>
                        <ProgressBar value={wl} max={100} color={barColor} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── 새로고침 ─── */}
          <div style={{ textAlign: "right" }}>
            <button
              onClick={loadAnalytics}
              style={{ fontSize: "0.78rem", color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0.5rem" }}
            >
              ↻ 새로고침
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
