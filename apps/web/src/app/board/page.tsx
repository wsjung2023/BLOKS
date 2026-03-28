// Board page — Kanban view of tasks by state
'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '../../lib/apiClient';

const COLUMNS = ['Created', 'Assigned', 'InProgress', 'PendingReview', 'Done'] as const;
type TaskState = (typeof COLUMNS)[number];

interface Task {
  id: string;
  title: string;
  state: TaskState;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  assignee_character_id?: string;
}

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
  const [tasks, setTasks] = useState<Task[]>([]);
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

  const byState = (state: TaskState) => tasks.filter((t) => t.state === state);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="flex gap-3 h-full overflow-x-auto p-4">
      {COLUMNS.map((col) => (
        <div key={col} className="flex flex-col min-w-[200px] w-52 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-300">{COL_LABEL[col]}</span>
            <span className="text-xs bg-gray-700 text-gray-400 rounded-full px-2 py-0.5">
              {byState(col).length}
            </span>
          </div>
          <div className="flex flex-col gap-2 flex-1">
            {byState(col).map((task) => (
              <div
                key={task.id}
                className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-500 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className="text-sm text-gray-200 leading-snug">{task.title}</span>
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${PRIORITY_COLOR[task.priority] ?? 'bg-gray-400'}`}
                  />
                </div>
                {task.assignee_character_id && (
                  <div className="flex items-center gap-1 mt-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white">
                      A
                    </div>
                  </div>
                )}
              </div>
            ))}
            {byState(col).length === 0 && (
              <div className="text-xs text-gray-600 text-center py-4 border border-dashed border-gray-700 rounded-lg">
                비어 있음
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
