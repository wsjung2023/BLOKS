// Board page — Kanban-style task board (from /api/v1/tasks)
"use client";

import { useEffect, useState } from 'react';
import { apiGet } from '../../lib/apiClient';

const COLUMNS = ['Created', 'Assigned', 'InProgress', 'PendingReview', 'Done'] as const;
type TaskState = (typeof COLUMNS)[number];

interface TaskItem {
  id: string;
  title: string;
  state: TaskState;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  assignee_character_id?: string;
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
  P0: 'bg-red-500',
  P1: 'bg-orange-500',
  P2: 'bg-yellow-500',
  P3: 'bg-blue-500',
  P4: 'bg-gray-400',
};

const COL_LABEL: Record<string, string> = {
  Created: '생성됨',
  Assigned: '배정됨',
  InProgress: '진행 중',
  PendingReview: '검토 대기',
  Done: '완료',
};

export default function BoardPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ data?: { items?: Task[] } }>("/tasks")
      .then((body: { data?: { items?: Task[] } }) => {
        const next = body.data?.items ?? [];
        setTasks(Array.isArray(next) ? next : []);
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

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
                {task.assignee_character_id && (
                  <div className="flex items-center gap-1 mt-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white">
                      A
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
