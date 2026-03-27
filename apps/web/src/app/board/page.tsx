// Board page — Kanban-style task board (from /api/v1/tasks)
"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { createSnapshotPoller } from "@bloks/simulation";
import { getApiBase } from "../../lib/apiBase";

type TaskState =
  | "Draft"
  | "Created"
  | "Assigned"
  | "Accepted"
  | "InProgress"
  | "PendingReview"
  | "Approved"
  | "Rejected"
  | "Rework"
  | "Done"
  | "Blocked"
  | "Cancelled";

interface TaskItem {
  id: string;
  title: string;
  state: TaskState;
  priority?: string;
  assignee_character_id?: string | null;
}

interface TaskListResponse {
  ok: boolean;
  data?: {
    items?: TaskItem[];
  };
}

const COLUMNS: Array<{ key: TaskState; label: string }> = [
  { key: "Created", label: "Created" },
  { key: "Assigned", label: "Assigned" },
  { key: "InProgress", label: "In Progress" },
  { key: "PendingReview", label: "Review" },
  { key: "Blocked", label: "Blocked" },
  { key: "Done", label: "Done" },
];

const PRIORITY_COLOR: Record<string, string> = {
  P0: "bg-red-500",
  P1: "bg-orange-500",
  P2: "bg-yellow-500",
  P3: "bg-blue-500",
  P4: "bg-gray-400",
};

const AUTH_HEADERS = { Authorization: "Bearer dev-bypass" };

export default function BoardPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch(`${getApiBase()}/tasks?pageSize=100`, { headers: AUTH_HEADERS })
        .then((r) => r.json() as Promise<TaskListResponse>)
        .then((body) => setTasks(body.data?.items ?? []))
        .catch(() => setTasks([]))
        .finally(() => setLoading(false));

    const poller = createSnapshotPoller(load, 3_000);
    poller.start();
    return () => poller.stop();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<TaskState, TaskItem[]>();
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
        <div className="flex items-center justify-center h-full text-gray-400">로딩 중...</div>
      ) : (
        <div className="flex gap-3 h-full overflow-x-auto p-4">
          {COLUMNS.map((col) => {
            const items = grouped.get(col.key) ?? [];
            return (
              <div key={col.key} className="flex flex-col min-w-[220px] w-56 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-300">{col.label}</span>
                  <span className="text-xs bg-gray-700 text-gray-400 rounded-full px-2 py-0.5">
                    {items.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  {items.map((task) => (
                    <div
                      key={task.id}
                      className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-500 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-gray-200 leading-snug">{task.title}</span>
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${PRIORITY_COLOR[task.priority ?? ""] ?? "bg-gray-400"}`}
                        />
                      </div>
                      <div className="text-[11px] text-gray-500 mt-2">{task.id}</div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-xs text-gray-600 text-center py-4 border border-dashed border-gray-700 rounded-lg">
                      비어 있음
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
