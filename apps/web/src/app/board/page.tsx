"use client";

import { TaskState } from "@bloks/shared";
import AppShell from "@/components/layout/AppShell";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/apiClient";

type BoardTaskState =
  | TaskState.Created
  | TaskState.Assigned
  | TaskState.InProgress
  | TaskState.PendingReview
  | TaskState.Blocked
  | TaskState.Done;

interface TaskItem {
  id: string;
  title: string;
  state: BoardTaskState;
  priority: "P0" | "P1" | "P2" | "P3" | "P4";
  assignee_character_id?: string | null;
}

interface TaskListResponse {
  ok: boolean;
  data?: {
    items?: TaskItem[];
  };
}

const COLUMNS: Array<{ key: BoardTaskState; label: string }> = [
  { key: TaskState.Created, label: "Created" },
  { key: TaskState.Assigned, label: "Assigned" },
  { key: TaskState.InProgress, label: "In Progress" },
  { key: TaskState.PendingReview, label: "Review" },
  { key: TaskState.Blocked, label: "Blocked" },
  { key: TaskState.Done, label: "Done" },
];

const PRIORITY_COLOR: Record<TaskItem["priority"], string> = {
  P0: "bg-red-500",
  P1: "bg-orange-500",
  P2: "bg-yellow-500",
  P3: "bg-blue-500",
  P4: "bg-gray-500",
};

export default function BoardPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    apiGet<TaskListResponse>("/tasks")
      .then((body) => {
        if (!alive) return;
        const items = body.data?.items;
        setTasks(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!alive) return;
        setTasks([]);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<BoardTaskState, TaskItem[]>();
    for (const col of COLUMNS) map.set(col.key, []);

    for (const task of tasks) {
      if (!map.has(task.state)) continue;
      map.get(task.state)?.push(task);
    }

    return map;
  }, [tasks]);

  return (
    <AppShell activeNav="board">
      {loading ? (
        <div className="flex h-full items-center justify-center text-gray-400">로딩 중...</div>
      ) : (
        <div className="flex h-full gap-3 overflow-x-auto p-4">
          {COLUMNS.map((col) => {
            const items = grouped.get(col.key) ?? [];

            return (
              <section key={col.key} className="flex w-60 min-w-[240px] flex-shrink-0 flex-col">
                <header className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-300">{col.label}</span>
                  <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">{items.length}</span>
                </header>

                <div className="space-y-2 rounded-xl border border-gray-800 bg-gray-900/30 p-2">
                  {items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-700 py-4 text-center text-xs text-gray-600">
                      비어 있음
                    </div>
                  ) : (
                    items.map((task) => (
                      <article key={task.id} className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h3 className="line-clamp-2 text-sm font-medium text-gray-100">{task.title}</h3>
                          <span
                            className={`h-2 w-2 flex-shrink-0 rounded-full ${PRIORITY_COLOR[task.priority]}`}
                            title={task.priority}
                          />
                        </div>
                        <p className="text-xs text-gray-500">{task.assignee_character_id ? `담당: ${task.assignee_character_id}` : "미배정"}</p>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
