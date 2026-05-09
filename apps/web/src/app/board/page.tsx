"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import LoadStateBlock from "@/components/common/LoadStateBlock";
import { ContextPanelContext } from "@/components/layout/AppShell-nav";
import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";

const ALL_STATES = ["Draft", "Created", "Assigned", "Accepted", "InProgress", "PendingReview", "Rejected", "Rework", "Approved", "Done", "Blocked", "Cancelled"] as const;
const COLUMNS = ["Created", "Assigned", "InProgress", "PendingReview", "Blocked", "Done"] as const;
type TaskState = (typeof ALL_STATES)[number];
type ColumnState = (typeof COLUMNS)[number];

// Next allowed transitions per state (mirrors server TASK_TRANSITIONS)
const NEXT_STATES: Partial<Record<TaskState, TaskState[]>> = {
  Created: ["Assigned"],
  Assigned: ["Accepted", "Cancelled"],
  Accepted: ["InProgress"],
  InProgress: ["PendingReview", "Blocked"],
  PendingReview: ["Approved", "Rejected"],
  Rejected: ["Rework"],
  Rework: ["PendingReview"],
  Approved: ["Done"],
  Blocked: ["InProgress", "Cancelled"],
};

const STATE_LABELS: Record<string, string> = {
  Created: "Created", Assigned: "Assigned", Accepted: "Accepted",
  InProgress: "In Progress", PendingReview: "Review", Rejected: "Rejected",
  Rework: "Rework", Approved: "Approved", Done: "Done",
  Blocked: "Blocked", Cancelled: "Cancelled", Draft: "Draft",
};

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  state: TaskState;
  priority: "P0" | "P1" | "P2" | "P3" | "P4";
  assignee_character_id?: string;
  reviewer_character_id?: string;
  project_id?: string;
  due_at?: string;
  created_at?: string;
}

interface TaskListResponse {
  data?: { items?: TaskItem[] };
}

const COLUMN_META: Array<{ key: ColumnState; label: string }> = [
  { key: "Created", label: "Created" },
  { key: "Assigned", label: "Assigned" },
  { key: "InProgress", label: "In Progress" },
  { key: "PendingReview", label: "Review" },
  { key: "Blocked", label: "Blocked" },
  { key: "Done", label: "Done" },
];

const PRIORITY_COLOR: Record<TaskItem["priority"], string> = {
  P0: "#ff6b6b", P1: "#ffa94d", P2: "#ffd43b", P3: "#4dabf7", P4: "#adb5bd",
};

const STATE_BADGE_COLOR: Partial<Record<TaskState, string>> = {
  Done: "rgba(74,222,128,0.2)", Blocked: "rgba(255,107,107,0.2)",
  PendingReview: "rgba(255,212,59,0.2)", Approved: "rgba(74,222,128,0.2)",
  Cancelled: "rgba(200,200,200,0.15)", Rejected: "rgba(255,107,107,0.2)",
};

export default function BoardPage() {
  const { openPanel } = useContext(ContextPanelContext);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadTasks() {
    setLoading(true);
    apiGet<TaskListResponse>("/tasks?pageSize=100")
      .then((body) => {
        const next = body.data?.items ?? [];
        setTasks(Array.isArray(next) ? next : []);
        setError(null);
      })
      .catch(() => {
        setTasks([]);
        setError("보드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadTasks(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<ColumnState, TaskItem[]>();
    for (const col of COLUMNS) map.set(col, []);
    for (const task of tasks) {
      const col = COLUMNS.find((c) => c === task.state);
      if (col) map.get(col)?.push(task);
    }
    return map;
  }, [tasks]);

  const openTaskPanel = useCallback((task: TaskItem) => {
    openPanel(
      task.title,
      <TaskDetailPanel
        task={task}
        onTransition={async (nextState) => {
          await apiPatch(`/tasks/${task.id}/state`, { nextState });
          loadTasks();
        }}
        onTriggerAI={async () => {
          await apiPost(`/jobs`, {
            queueName: "ai-actions",
            payload: { input: { taskId: task.id } },
          });
        }}
      />
    );
  }, [openPanel]);

  return (
    <AppShell activeNav="board">
      {loading ? (
        <LoadStateBlock message="보드 로딩 중..." />
      ) : error ? (
        <LoadStateBlock message={error} tone="error" actionLabel="다시 시도" onAction={loadTasks} />
      ) : (
        <div style={{ display: "flex", gap: "0.75rem", height: "100%", overflowX: "auto", padding: "1rem" }}>
          {COLUMN_META.map((col) => {
            const items = grouped.get(col.key) ?? [];
            return (
              <div key={col.key} style={{ display: "flex", flexDirection: "column", minWidth: 220, width: 240, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{col.label}</span>
                  <span style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.06)", color: "var(--color-muted)", borderRadius: 999, padding: "0.1rem 0.5rem" }}>
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", textAlign: "center", padding: "0.8rem", border: "1px dashed var(--color-border)", borderRadius: 10 }}>
                    비어 있음
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    {items.map((task) => (
                      <article
                        key={task.id}
                        onClick={() => openTaskPanel(task)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTaskPanel(task); } }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${task.title} 상세 보기`}
                        style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: "0.6rem", background: "var(--color-panel)", cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                          <strong style={{ fontSize: "0.8rem" }}>{task.title}</strong>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: PRIORITY_COLOR[task.priority], flexShrink: 0 }} />
                        </div>
                        {task.description && (
                          <div style={{ marginTop: "0.35rem", fontSize: "0.72rem", color: "var(--color-muted)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                            {task.description}
                          </div>
                        )}
                        <div style={{ marginTop: "0.45rem", fontSize: "0.72rem", color: "var(--color-muted)" }}>
                          {task.assignee_character_id ? `담당: ${task.assignee_character_id.slice(0, 8)}…` : "담당자 없음"}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

// ── Task detail panel ─────────────────────────────────────────────────────────

function TaskDetailPanel({
  task,
  onTransition,
  onTriggerAI,
}: {
  task: TaskItem;
  onTransition: (nextState: TaskState) => Promise<void>;
  onTriggerAI: () => Promise<void>;
}) {
  const [transitioning, setTransitioning] = useState<TaskState | null>(null);
  const [triggeringAI, setTriggeringAI] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const nextStates = NEXT_STATES[task.state] ?? [];

  const handleTransition = async (nextState: TaskState) => {
    setTransitioning(nextState);
    setActionError(null);
    setActionSuccess(null);
    try {
      await onTransition(nextState);
      setActionSuccess(`→ ${STATE_LABELS[nextState]} 전환 완료`);
    } catch {
      setActionError("상태 전환에 실패했습니다.");
    } finally {
      setTransitioning(null);
    }
  };

  const handleTriggerAI = async () => {
    setTriggeringAI(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await onTriggerAI();
      setActionSuccess("AI 작업이 큐에 등록되었습니다.");
    } catch {
      setActionError("AI 작업 실행에 실패했습니다.");
    } finally {
      setTriggeringAI(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "1rem", fontSize: "0.82rem" }}>
      {/* Status badge */}
      <div style={{
        display: "inline-flex",
        alignSelf: "start",
        padding: "0.2rem 0.6rem",
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 600,
        background: STATE_BADGE_COLOR[task.state] ?? "rgba(255,255,255,0.08)",
        color: "var(--color-text)",
      }}>
        {STATE_LABELS[task.state]}
      </div>

      {/* Meta */}
      <div style={{ display: "grid", gap: "0.35rem", color: "var(--color-muted)", fontSize: "0.78rem" }}>
        <div>우선순위: <strong style={{ color: PRIORITY_COLOR[task.priority] }}>{task.priority}</strong></div>
        {task.assignee_character_id && <div>담당자 ID: {task.assignee_character_id}</div>}
        {task.reviewer_character_id && <div>리뷰어 ID: {task.reviewer_character_id}</div>}
        {task.project_id && <div>프로젝트: {task.project_id.slice(0, 12)}…</div>}
        {task.due_at && <div>마감: {new Date(task.due_at).toLocaleDateString("ko-KR")}</div>}
        <div style={{ fontSize: "0.72rem" }}>ID: {task.id}</div>
      </div>

      {/* Description */}
      {task.description && (
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginBottom: "0.35rem" }}>설명</div>
          <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{task.description}</p>
        </div>
      )}

      {/* State transitions */}
      {nextStates.length > 0 && (
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginBottom: "0.5rem" }}>상태 전환</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {nextStates.map((next) => (
              <button
                key={next}
                onClick={() => handleTransition(next)}
                disabled={transitioning !== null}
                style={{
                  background: next === "Cancelled" || next === "Rejected" ? "rgba(255,107,107,0.15)" : "rgba(255,255,255,0.08)",
                  border: `1px solid ${next === "Cancelled" || next === "Rejected" ? "rgba(255,107,107,0.3)" : "var(--color-border)"}`,
                  color: transitioning === next ? "var(--color-muted)" : "var(--color-text)",
                  borderRadius: 6,
                  padding: "0.35rem 0.7rem",
                  fontSize: "0.78rem",
                  cursor: transitioning !== null ? "default" : "pointer",
                }}
              >
                {transitioning === next ? "처리 중…" : `→ ${STATE_LABELS[next]}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI trigger — only for InProgress tasks with assignee */}
      {task.state === "InProgress" && task.assignee_character_id && (
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginBottom: "0.5rem" }}>AI 작업</div>
          <button
            onClick={handleTriggerAI}
            disabled={triggeringAI}
            style={{
              background: "rgba(74,222,128,0.12)",
              border: "1px solid rgba(74,222,128,0.3)",
              color: triggeringAI ? "var(--color-muted)" : "#4ade80",
              borderRadius: 6,
              padding: "0.35rem 0.9rem",
              fontSize: "0.78rem",
              cursor: triggeringAI ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            {triggeringAI ? "실행 중…" : "⚡ AI 실행"}
          </button>
        </div>
      )}

      {/* Feedback messages */}
      {actionSuccess && (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "#4ade80" }}>{actionSuccess}</p>
      )}
      {actionError && (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-toxic-red)" }}>{actionError}</p>
      )}
    </div>
  );
}
