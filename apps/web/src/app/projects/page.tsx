"use client";

import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import LoadStateBlock from "@/components/common/LoadStateBlock";
import { ContextPanelContext } from "@/components/layout/AppShell-nav";
import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  title: string;
  state: string;
  priority: string;
  brief?: string;
  created_at: string;
  updated_at: string;
  owner_character_id?: string;
}

interface Task {
  id: string;
  title: string;
  state: string;
  priority: string;
  project_id: string;
  assignee_character_id?: string;
  ai_output?: { text?: string; modelUsed?: string; tokensUsed?: number; costUsd?: number } | null;
}

interface Character {
  id: string;
  name: string;
  code_name: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Draft:     { label: "초안",    color: "#9ca3af", bg: "rgba(156,163,175,0.15)" },
  Active:    { label: "진행 중", color: "#60a5fa", bg: "rgba(96,165,250,0.15)"  },
  OnHold:    { label: "보류",    color: "#fbbf24", bg: "rgba(251,191,36,0.15)"  },
  Completed: { label: "완료",    color: "#4ade80", bg: "rgba(74,222,128,0.15)"  },
  Released:  { label: "납품",    color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  Cancelled: { label: "취소",    color: "#f87171", bg: "rgba(248,113,113,0.15)" },
};

const PRIORITY_COLOR: Record<string, string> = {
  Critical: "#ff6b6b", High: "#ffa94d", Medium: "#ffd43b", Low: "#adb5bd",
};

const TASK_DONE_STATES = new Set(["Done"]);
const TASK_ACTIVE_STATES = new Set(["InProgress", "InReview", "PendingReview"]);

// ── ProjectCard ───────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  tasks,
  charMap,
  onClick,
}: {
  project: Project;
  tasks: Task[];
  charMap: Map<string, string>;
  onClick: () => void;
}) {
  const total = tasks.length;
  const done = tasks.filter(t => TASK_DONE_STATES.has(t.state)).length;
  const active = tasks.filter(t => TASK_ACTIVE_STATES.has(t.state)).length;
  const blocked = tasks.filter(t => t.state === "Blocked").length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const stateConf = STATE_CONFIG[project.state] ?? STATE_CONFIG["Draft"]!;
  const priorityColor = PRIORITY_COLOR[project.priority] ?? "#adb5bd";

  const assignees = [...new Set(tasks.map(t => t.assignee_character_id).filter(Boolean))] as string[];

  return (
    <article
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: "0.9rem 1rem",
        background: "var(--color-panel)",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: "0.55rem",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.35, flex: 1 }}>
          {project.title}
        </div>
        <div style={{
          flexShrink: 0, fontSize: "0.68rem", fontWeight: 600,
          padding: "0.18rem 0.55rem", borderRadius: 999,
          color: stateConf.color, background: stateConf.bg,
        }}>
          {stateConf.label}
        </div>
      </div>

      {/* Brief */}
      {project.brief && (
        <div style={{
          fontSize: "0.73rem", color: "var(--color-muted)",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          lineHeight: 1.5,
        }}>
          {project.brief}
        </div>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--color-muted)", marginBottom: 4 }}>
            <span>태스크 {done}/{total}</span>
            <span style={{ color: progress === 100 ? "#4ade80" : "var(--color-muted)" }}>{progress}%</span>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 999,
              width: `${progress}%`,
              background: progress === 100 ? "#4ade80" : "#60a5fa",
              transition: "width 0.3s",
            }} />
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--color-muted)" }}>
        <div style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
          {active > 0 && <span style={{ color: "#60a5fa" }}>⚙️ {active}개 진행 중</span>}
          {blocked > 0 && <span style={{ color: "#f87171" }}>🔒 {blocked}개 블록</span>}
          {total === 0 && <span>태스크 없음</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: priorityColor, display: "inline-block" }} />
          <span>{project.priority}</span>
        </div>
      </div>

      {/* Assignees */}
      {assignees.length > 0 && (
        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          {assignees.slice(0, 5).map(id => (
            <span key={id} style={{
              fontSize: "0.65rem", padding: "0.12rem 0.45rem", borderRadius: 999,
              background: "rgba(255,255,255,0.06)", color: "var(--color-muted)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              {charMap.get(id) ?? id.slice(0, 8)}
            </span>
          ))}
          {assignees.length > 5 && (
            <span style={{ fontSize: "0.65rem", color: "var(--color-muted)" }}>+{assignees.length - 5}</span>
          )}
        </div>
      )}
    </article>
  );
}

// ── ProjectDetailPanel ────────────────────────────────────────────────────────

const TASK_STATE_LABEL: Record<string, string> = {
  Todo: "할 일", InProgress: "진행 중", InReview: "검토", Done: "완료",
  Blocked: "블록", Cancelled: "취소", Created: "생성됨", Assigned: "배정됨",
};
const TASK_STATE_COLOR: Record<string, string> = {
  Done: "#4ade80", InProgress: "#60a5fa", InReview: "#fbbf24",
  Blocked: "#f87171", Cancelled: "#6b7280", Todo: "#9ca3af",
};
const TASK_PRIORITY_COLOR: Record<string, string> = {
  Critical: "#ff6b6b", High: "#ffa94d", Medium: "#ffd43b",
  Low: "#adb5bd", P0: "#ff6b6b", P1: "#ffa94d", P2: "#ffd43b", P3: "#4dabf7", P4: "#adb5bd",
};

function ProjectDetailPanel({
  project,
  tasks,
  charMap,
}: {
  project: Project;
  tasks: Task[];
  charMap: Map<string, string>;
}) {
  const [triggeringAI, setTriggeringAI] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const stateConf = STATE_CONFIG[project.state] ?? STATE_CONFIG["Draft"]!;
  const total = tasks.length;
  const done = tasks.filter(t => TASK_DONE_STATES.has(t.state)).length;

  const sorted = [...tasks].sort((a, b) => {
    const order = ["InProgress", "InReview", "Todo", "Blocked", "Done", "Cancelled"];
    return (order.indexOf(a.state) ?? 99) - (order.indexOf(b.state) ?? 99);
  });

  const triggerAI = async (task: Task) => {
    setTriggeringAI(task.id);
    try {
      await apiPost("/jobs", {
        queueName: "ai-actions",
        payload: { input: { taskId: task.id, characterId: task.assignee_character_id } },
      });
    } catch { /* ignore */ } finally {
      setTriggeringAI(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.8rem" }}>
      {/* State + progress */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{
          padding: "0.2rem 0.6rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 600,
          color: stateConf.color, background: stateConf.bg,
        }}>{stateConf.label}</span>
        <span style={{ color: "var(--color-muted)", fontSize: "0.72rem" }}>
          {project.priority} · {done}/{total} 완료
        </span>
      </div>

      {/* Brief */}
      {project.brief && (
        <div style={{
          fontSize: "0.75rem", color: "var(--color-text)", lineHeight: 1.6,
          background: "rgba(0,0,0,0.03)", border: "1px solid var(--color-border)",
          borderRadius: 6, padding: "0.5rem 0.65rem",
        }}>
          {project.brief}
        </div>
      )}

      {/* Task list */}
      <div style={{ fontSize: "0.7rem", color: "var(--color-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        태스크 ({tasks.length})
      </div>

      {tasks.length === 0 ? (
        <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", fontStyle: "italic" }}>태스크 없음</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: 420, overflowY: "auto" }}>
          {sorted.map(task => {
            const stateColor = TASK_STATE_COLOR[task.state] ?? "#9ca3af";
            const stateLabel = TASK_STATE_LABEL[task.state] ?? task.state;
            const assigneeName = task.assignee_character_id ? (charMap.get(task.assignee_character_id) ?? task.assignee_character_id.slice(0, 8)) : "미배정";
            const priorityColor = TASK_PRIORITY_COLOR[task.priority] ?? "#adb5bd";
            const isExpanded = expandedTaskId === task.id;
            const hasOutput = !!task.ai_output?.text;

            return (
              <div key={task.id} style={{
                border: "1px solid var(--color-border)", borderRadius: 7,
                background: "rgba(0,0,0,0.02)", overflow: "hidden",
              }}>
                <div
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  style={{
                    padding: "0.45rem 0.6rem", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "0.45rem",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: stateColor, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: "0.75rem", fontWeight: 500 }}>{task.title}</span>
                  <span style={{ fontSize: "0.63rem", color: stateColor, flexShrink: 0 }}>{stateLabel}</span>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: priorityColor, flexShrink: 0 }} />
                </div>

                {isExpanded && (
                  <div style={{
                    borderTop: "1px solid var(--color-border)",
                    padding: "0.45rem 0.6rem",
                    background: "rgba(0,0,0,0.04)",
                    display: "flex", flexDirection: "column", gap: "0.35rem",
                  }}>
                    <div style={{ fontSize: "0.68rem", color: "var(--color-muted)" }}>
                      담당: <span style={{ color: "var(--color-text)" }}>{assigneeName}</span>
                    </div>

                    {/* AI output preview */}
                    {hasOutput && (
                      <div style={{
                        fontSize: "0.68rem", lineHeight: 1.55, color: "var(--color-text)",
                        background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)",
                        borderRadius: 5, padding: "0.4rem 0.5rem",
                        maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap",
                      }}>
                        {task.ai_output!.text!.slice(0, 400)}{task.ai_output!.text!.length > 400 ? "…" : ""}
                      </div>
                    )}

                    {/* AI trigger */}
                    {task.state === "InProgress" && task.assignee_character_id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void triggerAI(task); }}
                        disabled={triggeringAI === task.id}
                        style={{
                          alignSelf: "flex-start",
                          padding: "0.25rem 0.6rem", borderRadius: 5,
                          background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)",
                          color: triggeringAI === task.id ? "var(--color-muted)" : "#4ade80",
                          fontSize: "0.68rem", cursor: "pointer", fontWeight: 600,
                        }}
                      >
                        {triggeringAI === task.id ? "실행 중…" : "⚡ AI 실행"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: "0.65rem", color: "var(--color-muted)", marginTop: 4 }}>
        생성: {new Date(project.created_at).toLocaleDateString("ko-KR")}
        {" · "}수정: {new Date(project.updated_at).toLocaleDateString("ko-KR")}
      </div>
    </div>
  );
}

// ── First-run onboarding ──────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  {
    num: "1",
    title: "프로젝트 만들기",
    desc: "하고 싶은 작업을 프로젝트로 정의합니다. 홈페이지 제작, PPT 작성, 코드 개발 — 뭐든 괜찮습니다.",
    action: { label: "+ 첫 프로젝트 만들기", href: "/projects/new" },
    color: "#60a5fa",
  },
  {
    num: "2",
    title: "태스크에 캐릭터 배정",
    desc: "프로젝트 안에 태스크를 만들고, AI 캐릭터를 담당자로 지정합니다. 각 캐릭터는 고유한 역할과 전문성을 가집니다.",
    action: { label: "캐릭터 둘러보기", href: "/directory" },
    color: "#a78bfa",
  },
  {
    num: "3",
    title: "AI 실행 & 결과 확인",
    desc: "태스크 카드에서 ⚡ AI 실행을 누르면 캐릭터가 실제로 작업을 처리합니다. 결과는 월드 캔버스에서도 실시간으로 확인할 수 있습니다.",
    action: { label: "월드 캔버스 보기", href: "/world" },
    color: "#4ade80",
  },
];

function FirstRunGuide() {
  return (
    <div style={{
      border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 12,
      padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🏢</div>
        <div style={{ fontSize: "1rem", fontWeight: 700, color: "#e8e8e8", marginBottom: "0.35rem" }}>
          BLOKS에 오신 걸 환영합니다
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
          AI 캐릭터들이 실제 업무를 처리하는 가상 회사입니다. 아래 3단계로 시작해보세요.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
        {ONBOARDING_STEPS.map((step) => (
          <div key={step.num} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{
                width: 24, height: 24, borderRadius: "50%", fontSize: "0.72rem", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `${step.color}22`, color: step.color, border: `1px solid ${step.color}44`,
                flexShrink: 0,
              }}>{step.num}</span>
              <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#e8e8e8" }}>{step.title}</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", lineHeight: 1.55, flex: 1 }}>
              {step.desc}
            </div>
            <a href={step.action.href} style={{
              display: "inline-block", marginTop: "0.25rem",
              padding: "0.35rem 0.7rem", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600,
              color: step.color, background: `${step.color}15`,
              border: `1px solid ${step.color}33`, textDecoration: "none",
              textAlign: "center",
            }}>
              {step.action.label} →
            </a>
          </div>
        ))}
      </div>

      <div style={{
        padding: "0.75rem 1rem", borderRadius: 8,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        fontSize: "0.75rem", color: "var(--color-muted)", lineHeight: 1.6,
      }}>
        <span style={{ color: "#fbbf24", fontWeight: 600 }}>💡 팁: </span>
        위험한 작업(외부 API 호출, 대용량 데이터 삭제 등)은 실행 전 승인 센터에서 확인을 요청합니다.
        <a href="/approvals" style={{ color: "#60a5fa", marginLeft: 4 }}>승인 센터 바로가기 →</a>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { openPanel } = useContext(ContextPanelContext);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<string>("all");

  function loadData() {
    setLoading(true);
    Promise.all([
      apiGet<{ data?: { items?: Project[] } }>("/projects?limit=50"),
      apiGet<{ data?: { items?: Task[] } }>("/tasks?pageSize=100"),
      apiGet<{ data?: { items?: Character[] } }>("/characters?pageSize=100"),
    ])
      .then(([p, t, c]) => {
        setProjects(p.data?.items ?? []);
        setTasks(t.data?.items ?? []);
        setCharacters(c.data?.items ?? []);
        setError(null);
      })
      .catch(() => setError("데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  const charMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of characters) m.set(c.id, c.name);
    return m;
  }, [characters]);

  const tasksByProject = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.project_id) continue;
      const arr = m.get(t.project_id) ?? [];
      arr.push(t);
      m.set(t.project_id, arr);
    }
    return m;
  }, [tasks]);

  const filteredProjects = useMemo(() =>
    filterState === "all" ? projects : projects.filter(p => p.state === filterState),
    [projects, filterState],
  );

  const openProjectPanel = useCallback((project: Project) => {
    openPanel(project.title, (
      <ProjectDetailPanel
        project={project}
        tasks={tasksByProject.get(project.id) ?? []}
        charMap={charMap}
      />
    ));
  }, [openPanel, tasksByProject, charMap]);

  const stateCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of projects) m[p.state] = (m[p.state] ?? 0) + 1;
    return m;
  }, [projects]);

  const filterOptions = ["all", "Active", "Draft", "OnHold", "Completed", "Released", "Cancelled"];

  return (
    <AppShell activeNav="projects">
      {loading ? (
        <LoadStateBlock message="프로젝트 로딩 중..." />
      ) : error ? (
        <LoadStateBlock message={error} tone="error" actionLabel="다시 시도" onAction={loadData} />
      ) : (
        <div style={{ padding: "1.25rem", maxWidth: 1100, margin: "0 auto" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "1rem" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>프로젝트</h1>
              <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginTop: 2 }}>
                {projects.length}개 전체 · {stateCounts["Active"] ?? 0}개 진행 중
              </div>
            </div>
            <Link href="/projects/new" style={{
              padding: "0.45rem 1rem", borderRadius: 6,
              background: "rgba(100,180,255,0.15)", border: "1px solid rgba(100,180,255,0.4)",
              color: "#64b4ff", fontSize: "0.8rem", fontWeight: 600,
              textDecoration: "none", whiteSpace: "nowrap",
            }}>
              + 새 프로젝트
            </Link>
          </div>

          {/* Filter chips */}
          <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            {filterOptions.map(s => {
              const conf = s === "all" ? { label: "전체", color: "#9ca3af", bg: "rgba(156,163,175,0.12)" } : STATE_CONFIG[s];
              const count = s === "all" ? projects.length : (stateCounts[s] ?? 0);
              const isActive = filterState === s;
              if (s !== "all" && count === 0) return null;
              return (
                <button key={s} onClick={() => setFilterState(s)} style={{
                  padding: "0.28rem 0.75rem", borderRadius: 999, fontSize: "0.72rem",
                  border: isActive ? `1px solid ${conf?.color ?? "#9ca3af"}` : "1px solid rgba(255,255,255,0.1)",
                  background: isActive ? (conf?.bg ?? "rgba(156,163,175,0.12)") : "transparent",
                  color: isActive ? (conf?.color ?? "#9ca3af") : "var(--color-muted)",
                  cursor: "pointer", fontWeight: isActive ? 600 : 400,
                }}>
                  {conf?.label ?? s} {count}
                </button>
              );
            })}
          </div>

          {/* Empty state */}
          {filteredProjects.length === 0 && (
            filterState === "all" ? <FirstRunGuide /> : (
              <div style={{
                textAlign: "center", padding: "3rem",
                color: "var(--color-muted)", fontSize: "0.85rem",
                border: "1px dashed var(--color-border)", borderRadius: 8,
              }}>
                {STATE_CONFIG[filterState]?.label ?? filterState} 상태의 프로젝트가 없습니다.
              </div>
            )
          )}

          {/* Project grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "0.75rem",
          }}>
            {filteredProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                tasks={tasksByProject.get(project.id) ?? []}
                charMap={charMap}
                onClick={() => openProjectPanel(project)}
              />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
