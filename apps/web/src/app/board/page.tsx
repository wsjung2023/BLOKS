// Board page — Kanban-style task board (from /api/v1/tasks)
"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import LoadStateBlock from "@/components/common/LoadStateBlock";
import { ContextPanelContext } from "@/components/layout/AppShell-nav";
import { apiGet } from "@/lib/apiClient";

const COLUMNS = ["Created", "Assigned", "InProgress", "PendingReview", "Blocked", "Done"] as const;
type TaskState = (typeof COLUMNS)[number];

interface TaskItem {
  id: string;
  title: string;
  state: TaskState;
  priority: "P0" | "P1" | "P2" | "P3" | "P4";
  assignee_character_id?: string;
}

interface TaskListResponse {
  data?: {
    items?: TaskItem[];
  };
}

const COLUMN_META: Array<{ key: TaskState; label: string }> = [
  { key: "Created", label: "Created" },
  { key: "Assigned", label: "Assigned" },
  { key: "InProgress", label: "In Progress" },
  { key: "PendingReview", label: "Review" },
  { key: "Blocked", label: "Blocked" },
  { key: "Done", label: "Done" },
];

const PRIORITY_COLOR: Record<TaskItem["priority"], string> = {
  P0: "#ff6b6b",
  P1: "#ffa94d",
  P2: "#ffd43b",
  P3: "#4dabf7",
  P4: "#adb5bd",
};

export default function BoardPage() {
  const { openPanel } = useContext(ContextPanelContext);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadTasks() {
    setLoading(true);
    apiGet<TaskListResponse>("/tasks")
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

  useEffect(() => {
    loadTasks();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<TaskState, TaskItem[]>();
    for (const col of COLUMNS) map.set(col, []);
    for (const task of tasks) {
      if (!map.has(task.state)) continue;
      map.get(task.state)?.push(task);
    }
    return map;
  }, [tasks]);

  function openTaskPanel(task: TaskItem) {
    openPanel(
      `Task: ${task.title}`,
      <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.82rem" }}>
        <div>ID: {task.id}</div>
        <div>State: {task.state}</div>
        <div>Priority: {task.priority}</div>
        <div>Assignee: {task.assignee_character_id ?? "미지정"}</div>
      </div>
    );
  }

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
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openTaskPanel(task);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${task.title} 상세 보기`}
                        style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: "0.6rem", background: "var(--color-panel)", cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                          <strong style={{ fontSize: "0.8rem" }}>{task.title}</strong>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: PRIORITY_COLOR[task.priority], flexShrink: 0 }} />
                        </div>
                        <div style={{ marginTop: "0.45rem", fontSize: "0.72rem", color: "var(--color-muted)" }}>
                          {task.id}
                        </div>
                        <div style={{ marginTop: "0.45rem", fontSize: "0.72rem", color: "var(--color-muted)" }}>
                          Assignee: {task.assignee_character_id ?? "미지정"}
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
