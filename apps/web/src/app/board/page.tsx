"use client";

import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import LoadStateBlock from "@/components/common/LoadStateBlock";
import { ContextPanelContext } from "@/components/layout/AppShell-nav";
import { useWorldStream } from "@/lib/useWorldStream";
import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { BoardHelp } from "@/components/layout/AppHelp";

// ── State machine (실제 사용 상태만) ─────────────────────────────────────────

const COLUMNS = ["Todo", "InProgress", "InReview", "Blocked", "Done"] as const;
type ColumnState = (typeof COLUMNS)[number];

const NEXT_STATES: Partial<Record<string, string[]>> = {
  Todo:       ["InProgress", "Blocked", "Cancelled"],
  InProgress: ["InReview",   "Blocked", "Cancelled"],
  InReview:   ["Done",       "InProgress"],
  Blocked:    ["Todo",       "Cancelled"],
  Done:       [],
  // legacy states still in DB
  Created:    ["Todo"],
  Assigned:   ["InProgress", "Cancelled"],
  Accepted:   ["InProgress"],
  PendingReview: ["Done", "InProgress"],
  Approved:   ["Done"],
  Rejected:   ["InProgress"],
};

const STATE_LABEL: Record<string, string> = {
  Todo: "할 일", InProgress: "진행 중", InReview: "검토 중", Done: "완료",
  Blocked: "블록", Cancelled: "취소", Created: "생성됨", Assigned: "배정됨",
  Accepted: "수락됨", PendingReview: "검토 대기", Approved: "승인됨", Rejected: "반려됨",
};

const COLUMN_LABEL: Record<ColumnState, string> = {
  Todo: "할 일", InProgress: "진행 중", InReview: "검토 중", Blocked: "블록", Done: "완료",
};

const STATE_TO_COLUMN: Record<string, ColumnState> = {
  Todo: "Todo", InProgress: "InProgress", InReview: "InReview",
  Blocked: "Blocked", Done: "Done",
  // legacy mapping
  Created: "Todo", Assigned: "InProgress", Accepted: "InProgress",
  PendingReview: "InReview", Approved: "Done", Rejected: "InProgress",
};

const COLUMN_COLOR: Record<ColumnState, string> = {
  Todo: "rgba(156,163,175,0.15)", InProgress: "rgba(96,165,250,0.12)",
  InReview: "rgba(251,191,36,0.12)", Blocked: "rgba(248,113,113,0.12)",
  Done: "rgba(74,222,128,0.12)",
};

const PRIORITY_COLOR: Record<string, string> = {
  P0: "#ff6b6b", P1: "#ffa94d", P2: "#ffd43b", P3: "#4dabf7", P4: "#adb5bd",
  Critical: "#ff6b6b", High: "#ffa94d", Medium: "#ffd43b", Low: "#adb5bd",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  state: string;
  priority: string;
  assignee_character_id?: string;
  project_id?: string;
  created_at?: string;
  ai_output?: { text?: string; modelUsed?: string; tokensUsed?: number; costUsd?: number } | null;
}

interface Character { id: string; name: string }
interface Project   { id: string; title: string }

// ── Board Page ────────────────────────────────────────────────────────────────

export default function BoardPage() {
  const { openPanel } = useContext(ContextPanelContext);
  const [tasks,      setTasks]      = useState<TaskItem[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [filterProject, setFilterProject] = useState<string>("all");

  function loadAll() {
    setLoading(true);
    Promise.all([
      apiGet<{ data?: { items?: TaskItem[] } }>("/tasks?pageSize=100"),
      apiGet<{ data?: { items?: Character[] } }>("/characters?pageSize=100"),
      apiGet<{ data?: { items?: Project[] } }>("/projects?limit=50"),
    ])
      .then(([t, c, p]) => {
        setTasks(t.data?.items ?? []);
        setCharacters(c.data?.items ?? []);
        setProjects(p.data?.items ?? []);
        setError(null);
      })
      .catch(() => setError("보드 데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadAll(); }, []);

  // SSE: 태스크 상태 변경 시 해당 태스크만 갱신
  useWorldStream(useCallback((event) => {
    if (event.type === "task_state_changed") {
      const { taskId, to } = event.payload as { taskId?: string; to?: string };
      if (taskId && to) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, state: to } : t));
      }
    }
  }, []));

  const charMap = useMemo(() => new Map(characters.map(c => [c.id, c.name])), [characters]);
  const projMap = useMemo(() => new Map(projects.map(p => [p.id, p.title])), [projects]);

  const filteredTasks = useMemo(() =>
    filterProject === "all" ? tasks : tasks.filter(t => t.project_id === filterProject),
    [tasks, filterProject],
  );

  const grouped = useMemo(() => {
    const map = new Map<ColumnState, TaskItem[]>(COLUMNS.map(c => [c, []]));
    for (const task of filteredTasks) {
      const col = STATE_TO_COLUMN[task.state];
      if (col) map.get(col)?.push(task);
    }
    return map;
  }, [filteredTasks]);

  const openTask = useCallback((task: TaskItem) => {
    openPanel(task.title, (
      <TaskPanel
        task={task}
        charMap={charMap}
        projMap={projMap}
        onTransition={async (next) => {
          await apiPatch(`/tasks/${task.id}/state`, { nextState: next });
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, state: next } : t));
        }}
        onTriggerAI={async () => {
          await apiPost("/jobs", {
            queueName: "ai-actions",
            payload: { input: { taskId: task.id, characterId: task.assignee_character_id } },
          });
        }}
      />
    ));
  }, [openPanel, charMap, projMap]);

  const activeProjects = useMemo(() =>
    projects.filter(p => tasks.some(t => t.project_id === p.id)),
    [projects, tasks],
  );

  return (
    <AppShell activeNav="board" helpContent={<BoardHelp />}>
      {loading ? (
        <LoadStateBlock message="보드 로딩 중..." />
      ) : error ? (
        <LoadStateBlock message={error} tone="error" actionLabel="다시 시도" onAction={loadAll} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          {/* 프로젝트 필터 */}
          {activeProjects.length > 1 && (
            <div style={{
              display: "flex", gap: "0.35rem", padding: "0.5rem 1rem",
              borderBottom: "1px solid var(--color-border)", overflowX: "auto", flexShrink: 0,
            }}>
              <button onClick={() => setFilterProject("all")} style={chipStyle(filterProject === "all")}>
                전체 {tasks.length}
              </button>
              {activeProjects.map(p => (
                <button key={p.id} onClick={() => setFilterProject(p.id)} style={chipStyle(filterProject === p.id)}>
                  {p.title.slice(0, 20)} {tasks.filter(t => t.project_id === p.id).length}
                </button>
              ))}
            </div>
          )}

          {/* 칸반 보드 */}
          <div style={{ display: "flex", gap: "0.75rem", flex: 1, overflowX: "auto", overflowY: "hidden", padding: "1rem" }}>
            {COLUMNS.map(col => {
              const items = grouped.get(col) ?? [];
              return (
                <div key={col} style={{ display: "flex", flexDirection: "column", minWidth: 230, width: 250, flexShrink: 0 }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: "0.5rem", padding: "0.4rem 0.6rem", borderRadius: 7,
                    background: COLUMN_COLOR[col],
                  }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700 }}>{COLUMN_LABEL[col]}</span>
                    <span style={{
                      fontSize: "0.7rem", background: "rgba(255,255,255,0.12)",
                      borderRadius: 999, padding: "0.1rem 0.5rem",
                      color: "var(--color-muted)",
                    }}>{items.length}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", overflowY: "auto", flex: 1 }}>
                    {items.length === 0 ? (
                      <div style={{
                        fontSize: "0.72rem", color: "var(--color-muted)", textAlign: "center",
                        padding: "1rem 0.5rem", border: "1px dashed var(--color-border)", borderRadius: 8,
                      }}>비어 있음</div>
                    ) : items.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        charMap={charMap}
                        projMap={projMap}
                        onClick={() => openTask(task)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ── TaskCard ──────────────────────────────────────────────────────────────────

function TaskCard({ task, charMap, projMap, onClick }: {
  task: TaskItem;
  charMap: Map<string, string>;
  projMap: Map<string, string>;
  onClick: () => void;
}) {
  const assigneeName = task.assignee_character_id
    ? (charMap.get(task.assignee_character_id) ?? task.assignee_character_id.slice(0, 8))
    : null;
  const projTitle = task.project_id ? projMap.get(task.project_id) : null;
  const priorityColor = PRIORITY_COLOR[task.priority] ?? "#adb5bd";
  const hasAI = !!task.ai_output?.text;

  return (
    <article
      onClick={onClick}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      role="button" tabIndex={0}
      style={{
        border: "1px solid var(--color-border)", borderRadius: 8,
        padding: "0.6rem 0.7rem", background: "var(--color-panel)", cursor: "pointer",
        display: "flex", flexDirection: "column", gap: "0.3rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
        <span style={{ flex: 1, fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.35 }}>{task.title}</span>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: priorityColor, flexShrink: 0, marginTop: 3 }} />
      </div>
      {projTitle && (
        <div style={{ fontSize: "0.65rem", color: "rgba(100,180,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          📁 {projTitle}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: "0.68rem", color: "var(--color-muted)" }}>
          {assigneeName ? `👤 ${assigneeName}` : "미배정"}
        </span>
        {hasAI && <span style={{ fontSize: "0.62rem", color: "#4ade80" }}>✓ AI</span>}
      </div>
    </article>
  );
}

// ── TaskPanel (우측 상세 패널) ──────────────────────────────────────────────

function TaskPanel({ task, charMap, projMap, onTransition, onTriggerAI }: {
  task: TaskItem;
  charMap: Map<string, string>;
  projMap: Map<string, string>;
  onTransition: (next: string) => Promise<void>;
  onTriggerAI: () => Promise<void>;
}) {
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [triggeringAI,  setTriggeringAI]  = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState(task.state);
  const [savingArtifact, setSavingArtifact] = useState(false);
  const [savedArtifactId, setSavedArtifactId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const nextStates = NEXT_STATES[currentState] ?? [];
  const assigneeName = task.assignee_character_id
    ? (charMap.get(task.assignee_character_id) ?? task.assignee_character_id.slice(0, 8))
    : "미배정";
  const projTitle = task.project_id ? (projMap.get(task.project_id) ?? task.project_id.slice(0, 12)) : null;
  const priorityColor = PRIORITY_COLOR[task.priority] ?? "#adb5bd";

  const handleTransition = async (next: string) => {
    setTransitioning(next);
    setMsg(null);
    try {
      await onTransition(next);
      setCurrentState(next);
      setMsg(`→ ${STATE_LABEL[next] ?? next} 전환 완료`);
    } catch {
      setMsg("상태 전환에 실패했습니다.");
    } finally {
      setTransitioning(null);
    }
  };

  const handleTriggerAI = async () => {
    setTriggeringAI(true);
    setMsg(null);
    try {
      await onTriggerAI();
      setMsg("AI 작업 큐에 등록됨");
    } catch {
      setMsg("AI 실행에 실패했습니다.");
    } finally {
      setTriggeringAI(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.8rem" }}>
      {/* 상태 + 우선순위 */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <span style={{
          padding: "0.2rem 0.65rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 600,
          background: "rgba(255,255,255,0.07)", color: "var(--color-text)",
        }}>{STATE_LABEL[currentState] ?? currentState}</span>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: priorityColor }} />
        <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>{task.priority}</span>
      </div>

      {/* 메타 */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.3rem 0.75rem", fontSize: "0.75rem" }}>
        <span style={{ color: "var(--color-muted)" }}>담당자</span>
        <span>{assigneeName}</span>
        {projTitle && <>
          <span style={{ color: "var(--color-muted)" }}>프로젝트</span>
          <span style={{ color: "rgba(100,180,255,0.8)" }}>{projTitle}</span>
        </>}
        {task.created_at && <>
          <span style={{ color: "var(--color-muted)" }}>생성일</span>
          <span>{new Date(task.created_at).toLocaleDateString("ko-KR")}</span>
        </>}
      </div>

      {/* 설명 */}
      {task.description && (
        <div style={{
          fontSize: "0.75rem", lineHeight: 1.6, whiteSpace: "pre-wrap",
          background: "rgba(0,0,0,0.03)", border: "1px solid var(--color-border)",
          borderRadius: 6, padding: "0.5rem 0.65rem",
        }}>{task.description}</div>
      )}

      {/* 상태 전환 */}
      {nextStates.length > 0 && (
        <div>
          <div style={{ fontSize: "0.68rem", color: "var(--color-muted)", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>상태 전환</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {nextStates.map(next => (
              <button key={next} onClick={() => void handleTransition(next)} disabled={!!transitioning} style={{
                padding: "0.3rem 0.65rem", borderRadius: 6, fontSize: "0.75rem", cursor: transitioning ? "default" : "pointer",
                background: next === "Cancelled" ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${next === "Cancelled" ? "rgba(248,113,113,0.3)" : "var(--color-border)"}`,
                color: transitioning === next ? "var(--color-muted)" : "var(--color-text)",
              }}>
                {transitioning === next ? "…" : `→ ${STATE_LABEL[next] ?? next}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI 실행 */}
      {task.assignee_character_id && (currentState === "InProgress" || currentState === "Todo" || currentState === "Assigned") && (
        <button onClick={() => void handleTriggerAI()} disabled={triggeringAI} style={{
          alignSelf: "flex-start", padding: "0.35rem 0.9rem", borderRadius: 6, fontSize: "0.78rem",
          fontWeight: 600, cursor: triggeringAI ? "default" : "pointer",
          background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)",
          color: triggeringAI ? "var(--color-muted)" : "#4ade80",
        }}>
          {triggeringAI ? "실행 중…" : "⚡ AI 즉시 실행"}
        </button>
      )}

      {/* AI 산출물 */}
      {task.ai_output?.text && (
        <div>
          <div style={{ fontSize: "0.68rem", color: "var(--color-muted)", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            AI 산출물 {task.ai_output.modelUsed ? `· ${task.ai_output.modelUsed}` : ""}
          </div>
          <div style={{
            fontSize: "0.72rem", lineHeight: 1.6, whiteSpace: "pre-wrap",
            background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.15)",
            borderRadius: 6, padding: "0.5rem 0.65rem", maxHeight: 220, overflowY: "auto",
          }}>
            {task.ai_output.text}
          </div>
          {(task.ai_output.tokensUsed || task.ai_output.costUsd) && (
            <div style={{ fontSize: "0.62rem", color: "var(--color-muted)", marginTop: "0.3rem" }}>
              {task.ai_output.tokensUsed} tokens {task.ai_output.costUsd ? `· $${task.ai_output.costUsd.toFixed(4)}` : ""}
            </div>
          )}
          <div style={{ marginTop: "0.5rem" }}>
            {savedArtifactId ? (
              <a
                href={`/artifacts/${savedArtifactId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.72rem", color: "#4ade80", textDecoration: "underline" }}
              >
                📝 아티팩트로 저장됨 — 열기 →
              </a>
            ) : (
              <button
                disabled={savingArtifact || !task.project_id}
                onClick={async () => {
                  setSavingArtifact(true);
                  try {
                    const r = await apiPost<{ ok: boolean; data?: { id: string } }>("/artifacts", {
                      projectId: task.project_id,
                      taskId: task.id,
                      artifactType: "document",
                      title: task.title,
                      content: task.ai_output!.text,
                      createdByCharacterId: task.assignee_character_id,
                    });
                    if (r.ok && r.data?.id) setSavedArtifactId(r.data.id);
                    else setMsg("아티팩트 저장 실패");
                  } catch {
                    setMsg("아티팩트 저장 실패");
                  } finally {
                    setSavingArtifact(false);
                  }
                }}
                style={{
                  padding: "0.3rem 0.7rem", borderRadius: 6, fontSize: "0.72rem",
                  background: "rgba(160,100,240,0.12)", border: "1px solid rgba(160,100,240,0.35)",
                  color: savingArtifact ? "var(--color-muted)" : "#c084fc",
                  cursor: savingArtifact || !task.project_id ? "default" : "pointer",
                }}
              >
                {savingArtifact ? "저장 중..." : "📝 아티팩트로 저장"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 피드백 */}
      {(currentState === "InReview" || currentState === "Done") && (
        <div style={{ marginTop: "1rem", borderTop: "1px solid var(--color-border)", paddingTop: "0.75rem" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--color-muted)" }}>
            피드백 / 재작업 요청
          </div>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="피드백 내용을 입력하세요..."
            rows={3}
            style={{
              width: "100%", padding: "0.5rem", borderRadius: 6,
              border: "1px solid var(--color-border)", background: "rgba(255,255,255,0.04)",
              color: "var(--color-text)", fontSize: "0.78rem", resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={async () => {
              if (!feedbackText.trim()) return;
              setSubmittingFeedback(true);
              try {
                await apiPost(`/tasks/${task.id}/feedback`, { comment: feedbackText, requestRevision: true });
                setFeedbackText("");
                setCurrentState("Todo");
                setMsg("재작업 요청 전송 완료");
              } catch {
                setMsg("피드백 전송 실패");
              } finally {
                setSubmittingFeedback(false);
              }
            }}
            disabled={submittingFeedback || !feedbackText.trim()}
            style={{
              marginTop: "0.4rem", padding: "0.4rem 1rem", borderRadius: 6,
              background: "rgba(90,140,220,0.2)", border: "1px solid rgba(90,140,220,0.4)",
              color: "#7aaee8", cursor: "pointer", fontSize: "0.78rem",
              opacity: submittingFeedback || !feedbackText.trim() ? 0.5 : 1,
            }}
          >
            {submittingFeedback ? "전송 중..." : "↩ 재작업 요청"}
          </button>
        </div>
      )}
      {msg && (
        <div style={{ fontSize: "0.75rem", color: msg.includes("실패") ? "#f87171" : "#4ade80" }}>
          {msg}
        </div>
      )}
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "0.25rem 0.7rem", borderRadius: 999, fontSize: "0.72rem",
    border: active ? "1px solid rgba(100,180,255,0.5)" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(100,180,255,0.12)" : "transparent",
    color: active ? "#64b4ff" : "var(--color-muted)",
    cursor: "pointer", whiteSpace: "nowrap", fontWeight: active ? 600 : 400,
  };
}
