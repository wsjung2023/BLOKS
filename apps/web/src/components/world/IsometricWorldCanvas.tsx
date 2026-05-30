"use client";
import React, {
  useEffect, useState, useCallback, useMemo, useRef, useContext,
} from "react";
import { ContextPanelContext } from "../layout/AppShell-nav";
import { apiGet, apiPatch, apiPost } from "../../lib/apiClient";
import {
  useWorldStream, extractRuntimePatch, type RuntimePatch,
} from "../../lib/useWorldStream";
import { FLOORS, FLOOR_DIVISION_MAP, FLOOR_DIR, MEETING_ZONES, LOCATION_ZONE_FLOOR } from "./world-sprites";
import { createWorldScene, type CharInfo, type WorldSceneAPI } from "./WorldScene";
import { useCanvasRecorder } from "../../hooks/useCanvasRecorder";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RuntimeState {
  runtime_status?: string;
  activity_status?: string;
  workload_score?: number;
  fatigue_score?: number;
  burnout_triggered?: boolean;
  current_task_count?: number;
}

interface Character {
  id: string;
  name: string;
  code_name: string;
  active_mode: string;
  active_flag?: boolean;
  ai_enabled?: boolean;
  persona_summary?: string | null;
  division_id?: string;
  divisions?: { division_type: string; name?: string };
  ranks?: { name: string };
  roles?: { name: string };
  character_runtime_states?: RuntimeState | RuntimeState[];
  current_level?: number;
  total_experience?: number;
  level_experience?: number;
  total_tasks_done?: number;
  default_model_profile_id?: string | null;
  model_profiles?: { id: string; profile_name: string; primary_model: string; provider_name: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRuntime(char: Character): RuntimeState {
  const rs = char.character_runtime_states;
  const fallback: RuntimeState = {
    activity_status: "Idle", workload_score: 0, fatigue_score: 0,
    burnout_triggered: false, current_task_count: 0,
  };
  if (!rs) return fallback;
  return Array.isArray(rs) ? (rs[0] ?? fallback) : rs;
}

function getRuntimeStatus(char: Character): string {
  const rt = getRuntime(char);
  return rt.activity_status ?? rt.runtime_status ?? "Idle";
}

function getCharFloorId(char: Character): string {
  const code = (char.divisions?.division_type ?? char.division_id ?? "").toLowerCase();
  return FLOOR_DIVISION_MAP[code] ?? "lobby";
}

const CANVAS_W = 1536;
const CANVAS_H = 1024;

const DEFAULT_SEATS = Array.from({ length: 20 }, (_, i) => ({
  x: 0.18 + (i % 5) * 0.16,
  y: 0.28 + Math.floor(i / 5) * 0.15,
}));

const FLOOR_SEAT_OVERRIDES: Record<string, Array<{ x: number; y: number }>> = {
  lobby: [
    { x: 0.30, y: 0.40 }, { x: 0.46, y: 0.43 }, { x: 0.62, y: 0.40 }, { x: 0.78, y: 0.43 },
    { x: 0.33, y: 0.55 }, { x: 0.50, y: 0.58 }, { x: 0.67, y: 0.55 },
  ],
  ops: [
    { x: 0.20, y: 0.32 }, { x: 0.36, y: 0.32 }, { x: 0.52, y: 0.32 }, { x: 0.68, y: 0.32 }, { x: 0.84, y: 0.32 },
    { x: 0.20, y: 0.48 }, { x: 0.36, y: 0.48 }, { x: 0.52, y: 0.48 }, { x: 0.68, y: 0.48 }, { x: 0.84, y: 0.48 },
    { x: 0.20, y: 0.62 }, { x: 0.36, y: 0.62 }, { x: 0.52, y: 0.62 }, { x: 0.68, y: 0.62 }, { x: 0.84, y: 0.62 },
  ],
  engineering: [
    { x: 0.20, y: 0.30 }, { x: 0.36, y: 0.30 }, { x: 0.52, y: 0.30 }, { x: 0.68, y: 0.30 }, { x: 0.84, y: 0.30 },
    { x: 0.20, y: 0.46 }, { x: 0.36, y: 0.46 }, { x: 0.52, y: 0.46 }, { x: 0.68, y: 0.46 }, { x: 0.84, y: 0.46 },
    { x: 0.20, y: 0.62 }, { x: 0.36, y: 0.62 }, { x: 0.52, y: 0.62 }, { x: 0.68, y: 0.62 }, { x: 0.84, y: 0.62 },
  ],
  marketing: [
    { x: 0.22, y: 0.33 }, { x: 0.40, y: 0.30 }, { x: 0.58, y: 0.33 }, { x: 0.76, y: 0.30 },
    { x: 0.22, y: 0.50 }, { x: 0.40, y: 0.47 }, { x: 0.58, y: 0.50 }, { x: 0.76, y: 0.47 },
    { x: 0.22, y: 0.65 }, { x: 0.40, y: 0.62 }, { x: 0.58, y: 0.65 }, { x: 0.76, y: 0.62 },
  ],
  research: [
    { x: 0.20, y: 0.30 }, { x: 0.36, y: 0.30 }, { x: 0.52, y: 0.30 }, { x: 0.68, y: 0.30 }, { x: 0.84, y: 0.30 },
    { x: 0.20, y: 0.46 }, { x: 0.36, y: 0.46 }, { x: 0.52, y: 0.46 }, { x: 0.68, y: 0.46 }, { x: 0.84, y: 0.46 },
    { x: 0.20, y: 0.62 }, { x: 0.36, y: 0.62 }, { x: 0.52, y: 0.62 }, { x: 0.68, y: 0.62 }, { x: 0.84, y: 0.62 },
  ],
  finance: [
    { x: 0.22, y: 0.34 }, { x: 0.40, y: 0.34 }, { x: 0.58, y: 0.34 }, { x: 0.76, y: 0.34 },
    { x: 0.22, y: 0.52 }, { x: 0.40, y: 0.52 }, { x: 0.58, y: 0.52 }, { x: 0.76, y: 0.52 },
    { x: 0.22, y: 0.68 }, { x: 0.40, y: 0.68 }, { x: 0.58, y: 0.68 }, { x: 0.76, y: 0.68 },
  ],
  executive: [
    { x: 0.22, y: 0.28 }, { x: 0.40, y: 0.28 }, { x: 0.58, y: 0.28 }, { x: 0.76, y: 0.28 },
    { x: 0.22, y: 0.46 }, { x: 0.40, y: 0.46 }, { x: 0.58, y: 0.46 }, { x: 0.76, y: 0.46 },
    { x: 0.22, y: 0.62 }, { x: 0.40, y: 0.62 }, { x: 0.58, y: 0.62 }, { x: 0.76, y: 0.62 },
  ],
};

function getSeats(floorId: string, layoutSeatsCache?: Record<string, Array<{ x: number; y: number }>>) {
  return FLOOR_SEAT_OVERRIDES[floorId] ?? layoutSeatsCache?.[floorId] ?? DEFAULT_SEATS;
}

// ── CharacterDetail panel ─────────────────────────────────────────────────────


function StatBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: 1 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: "0.7rem", color, minWidth: 28, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

function CharacterDetail({ char }: { char: Character }) {
  const rt = getRuntime(char);
  const fatigue = rt.fatigue_score ?? 0;
  const workload = rt.workload_score ?? 0;

  const [activeFlag, setActiveFlag] = useState(char.active_flag !== false);
  const [aiEnabled, setAiEnabled] = useState(char.ai_enabled !== false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"info" | "ai" | "memory" | "works">("info");
  const [modelProfiles, setModelProfiles] = useState<Array<{ id: string; profile_name: string; primary_model: string; provider_name: string }>>([]);
  const [modelProfilesLoading, setModelProfilesLoading] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(char.default_model_profile_id ?? null);
  const [memories, setMemories] = useState<Array<{ id: string; created_at: string; content: string }>>([]);
  const [memLoading, setMemLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<Array<{ id: string; title: string; artifact_type: string; content_markdown: string | null; created_at: string }>>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);

  useEffect(() => {
    setActiveFlag(char.active_flag !== false);
    setAiEnabled(char.ai_enabled !== false);
    setSelectedProfileId(char.default_model_profile_id ?? null);
    setTab("info");
    setArtifacts([]);
    setExpandedArtifactId(null);
  }, [char.id, char.default_model_profile_id]);

  useEffect(() => {
    if (tab !== "memory") return;
    setMemLoading(true);
    apiGet<{ data?: unknown[] }>(`/characters/${char.id}/memories?limit=20`)
      .then(r => setMemories((r.data ?? []) as typeof memories))
      .catch(() => setMemories([]))
      .finally(() => setMemLoading(false));
  }, [tab, char.id]);

  useEffect(() => {
    if (tab !== "works") return;
    setArtifactsLoading(true);
    apiGet<{ data?: { items?: typeof artifacts } }>(`/artifacts?authorCharacterId=${char.id}&limit=15`)
      .then(r => setArtifacts(r.data?.items ?? []))
      .catch(() => setArtifacts([]))
      .finally(() => setArtifactsLoading(false));
  }, [tab, char.id]);

  useEffect(() => {
    if (tab !== "ai" || modelProfiles.length > 0) return;
    setModelProfilesLoading(true);
    apiGet<{ data: Array<{ id: string; profile_name: string; primary_model: string; provider_name: string }> }>("/characters/model-profiles")
      .then(r => setModelProfiles(r.data ?? []))
      .catch(() => setModelProfiles([]))
      .finally(() => setModelProfilesLoading(false));
  }, [tab, modelProfiles.length]);

  const patchFlag = async (field: "active_flag" | "ai_enabled", value: boolean) => {
    setSaving(true);
    try {
      await apiPatch(`/characters/${char.id}`, { [field]: value });
      if (field === "active_flag") setActiveFlag(value);
      else setAiEnabled(value);
    } catch { /* revert */ } finally { setSaving(false); }
  };

  const patchModelProfile = async (profileId: string) => {
    if (!profileId) return;
    setSaving(true);
    try {
      await apiPatch(`/characters/${char.id}`, { default_model_profile_id: profileId });
      setSelectedProfileId(profileId);
    } catch { /* keep previous */ } finally { setSaving(false); }
  };

  const fatigueColor = fatigue > 70 ? "#ef4444" : fatigue > 40 ? "#f97316" : "#22c55e";
  const workloadColor = workload > 70 ? "#ef4444" : workload > 40 ? "#f97316" : "#3b82f6";
  const burnoutColor = rt.burnout_triggered ? "#ef4444" : "#22c55e";

  const tabStyle = (t: "info" | "ai" | "memory" | "works"): React.CSSProperties => ({
    flex: 1, padding: "0.3rem", fontSize: "0.7rem",
    background: tab === t ? "rgba(0,0,0,0.06)" : "transparent",
    border: "none", borderBottom: tab === t ? "2px solid #2563eb" : "2px solid transparent",
    color: tab === t ? "var(--color-text)" : "var(--color-muted)",
    cursor: "pointer", fontWeight: tab === t ? 600 : 400,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div style={{
          width: 42, height: 42, borderRadius: "50%",
          background: "rgba(0,0,0,0.06)", border: "1px solid var(--color-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.3rem", flexShrink: 0,
        }}>
          {char.code_name === "FOUNDER-01" ? "👑" : char.name[0]}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: char.code_name === "FOUNDER-01" ? "#b45309" : "var(--color-text)" }}>
            {char.name}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--color-muted)", marginTop: 1 }}>
            {char.code_name} · {char.active_mode} · {char.divisions?.name ?? char.division_id ?? "—"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.4rem" }}>
        <button disabled={saving} onClick={() => void patchFlag("active_flag", !activeFlag)}
          style={{
            flex: 1, padding: "0.4rem 0.5rem", borderRadius: 6,
            border: `1px solid ${activeFlag ? "rgba(37,99,235,0.5)" : "var(--color-border)"}`,
            background: activeFlag ? "rgba(37,99,235,0.1)" : "rgba(0,0,0,0.04)",
            color: activeFlag ? "#1d4ed8" : "var(--color-muted)",
            fontSize: "0.75rem", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600,
          }}>
          {activeFlag ? "🏢 재직 중" : "🏝️ 휴가"}
        </button>
        <button disabled={saving} onClick={() => void patchFlag("ai_enabled", !aiEnabled)}
          style={{
            flex: 1, padding: "0.4rem 0.5rem", borderRadius: 6,
            border: `1px solid ${aiEnabled ? "rgba(22,163,74,0.5)" : "rgba(239,68,68,0.4)"}`,
            background: aiEnabled ? "rgba(22,163,74,0.1)" : "rgba(239,68,68,0.08)",
            color: aiEnabled ? "#15803d" : "#dc2626",
            fontSize: "0.75rem", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600,
          }}>
          {aiEnabled ? "🤖 AI ON" : "⏸ AI OFF"}
        </button>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)" }}>
        <button style={tabStyle("info")} onClick={() => setTab("info")}>정보</button>
        <button style={tabStyle("works")} onClick={() => setTab("works")}>작업물</button>
        <button style={tabStyle("memory")} onClick={() => setTab("memory")}>메모리</button>
        <button style={tabStyle("ai")} onClick={() => setTab("ai")}>AI</button>
      </div>

      {tab === "info" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          {char.persona_summary && (
            <div style={{
              fontSize: "0.72rem", color: "var(--color-text)", lineHeight: 1.55,
              background: "rgba(0,0,0,0.03)", border: "1px solid var(--color-border)",
              borderRadius: 6, padding: "0.5rem 0.6rem",
            }}>
              {char.persona_summary}
            </div>
          )}
          {(char.current_level ?? 1) > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ background: "rgba(255,215,0,0.15)", color: "#ffd700", padding: "0.15rem 0.5rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 700 }}>
                Lv.{char.current_level ?? 1}
              </span>
              <span style={{ fontSize: "0.68rem", color: "var(--color-muted)" }}>
                {char.total_experience ?? 0} exp 누적 · 완료 {char.total_tasks_done ?? 0}개
              </span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.4rem 0.75rem", fontSize: "0.75rem" }}>
            <span style={{ color: "var(--color-muted)" }}>직급</span>
            <span style={{ color: "var(--color-text)" }}>{char.ranks?.name ?? "—"}</span>
            <span style={{ color: "var(--color-muted)" }}>역할</span>
            <span style={{ color: "var(--color-text)" }}>{char.roles?.name ?? "—"}</span>
            <span style={{ color: "var(--color-muted)" }}>상태</span>
            <span style={{ color: "#2563eb" }}>{getRuntimeStatus(char)}</span>
            <span style={{ color: "var(--color-muted)" }}>태스크</span>
            <span style={{ color: "var(--color-text)" }}>{rt.current_task_count ?? 0}개</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.72rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "var(--color-muted)", minWidth: 42 }}>업무량</span>
              <StatBar value={workload} color={workloadColor} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "var(--color-muted)", minWidth: 42 }}>피로도</span>
              <StatBar value={fatigue} color={fatigueColor} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "var(--color-muted)", minWidth: 42 }}>번아웃</span>
              <span style={{ fontSize: "0.7rem", color: burnoutColor, fontWeight: 600 }}>
                {rt.burnout_triggered ? "⚠️ 번아웃" : "✓ 정상"}
              </span>
            </div>
          </div>
        </div>
      )}

      {tab === "ai" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", fontSize: "0.75rem" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI 엔진</div>
          {modelProfilesLoading ? (
            <div style={{ color: "var(--color-muted)", fontSize: "0.72rem" }}>로딩 중...</div>
          ) : (
            <>
              <select
                value={selectedProfileId ?? ""}
                onChange={(e) => void patchModelProfile(e.target.value)}
                disabled={saving || !aiEnabled}
                style={{
                  width: "100%", padding: "0.4rem 0.5rem", borderRadius: 6,
                  border: "1px solid var(--color-border)", background: "var(--color-card)",
                  color: "var(--color-text)", fontSize: "0.75rem", cursor: aiEnabled ? "pointer" : "not-allowed",
                  opacity: aiEnabled ? 1 : 0.6,
                }}
              >
                <option value="">기본값 (태스크 타입별 자동 선택)</option>
                {(["text", "image", "video"] as const).map(cap => {
                  const group = modelProfiles.filter(p =>
                    cap === "video" ? p.provider_name === "kie.ai" :
                    cap === "image" ? ["openai-image","google-image","stability","fal","ideogram"].includes(p.provider_name) :
                    !["kie.ai","openai-image","google-image","stability","fal","ideogram"].includes(p.provider_name)
                  );
                  if (group.length === 0) return null;
                  const label = cap === "text" ? "── 텍스트 AI ──" : cap === "image" ? "── 이미지 AI ──" : "── 영상 AI ──";
                  return [
                    <option key={`grp-${cap}`} disabled value="">{label}</option>,
                    ...group.map(p => (
                      <option key={p.id} value={p.id}>{p.profile_name}</option>
                    ))
                  ];
                })}
              </select>
              {selectedProfileId && (() => {
                const active = modelProfiles.find(p => p.id === selectedProfileId) ??
                  (char.model_profiles?.id === selectedProfileId ? char.model_profiles : null);
                if (!active) return null;
                const isVideo = active.provider_name === "kie.ai";
                const isImage = ["openai-image","google-image","stability","fal","ideogram"].includes(active.provider_name);
                const capLabel = isVideo ? "영상" : isImage ? "이미지" : "텍스트";
                const capColor = isVideo ? "#7c3aed" : isImage ? "#0891b2" : "#2563eb";
                return (
                  <div style={{ fontSize: "0.68rem", color: capColor, padding: "0.3rem 0.5rem", background: `${capColor}11`, borderRadius: 4, display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ background: capColor, color: "#fff", borderRadius: 3, padding: "0 0.3rem", fontSize: "0.62rem", fontWeight: 700 }}>{capLabel}</span>
                    {active.primary_model} · {active.provider_name}
                  </div>
                );
              })()}
              {!aiEnabled && (
                <div style={{ fontSize: "0.68rem", color: "#f97316" }}>AI가 비활성화 상태입니다.</div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "memory" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: "0.68rem", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            장기 기억 — {char.name}이 쌓아온 컨텍스트
          </div>
          {memLoading ? (
            <div style={{ fontSize: "0.72rem", color: "var(--color-muted)" }}>불러오는 중...</div>
          ) : memories.length === 0 ? (
            <div style={{
              fontSize: "0.72rem", color: "var(--color-muted)", lineHeight: 1.6,
              padding: "0.75rem", background: "rgba(0,0,0,0.03)",
              borderRadius: 6, border: "1px dashed var(--color-border)",
            }}>
              아직 기억이 없습니다.<br />
              AI가 활성화된 상태에서 태스크를 처리하면 결과와 맥락이 여기에 쌓입니다.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: 280, overflowY: "auto" }}>
              {memories.map((m) => (
                <div key={m.id} style={{
                  fontSize: "0.71rem", padding: "0.4rem 0.6rem",
                  background: "rgba(0,0,0,0.03)", borderRadius: 5,
                  borderLeft: "2px solid rgba(37,99,235,0.4)",
                  color: "var(--color-text)", lineHeight: 1.5,
                }}>
                  <div style={{ fontSize: "0.62rem", color: "var(--color-muted)", marginBottom: 2 }}>
                    {new Date(m.created_at).toLocaleDateString("ko-KR")}
                  </div>
                  {m.content}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "works" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: "0.68rem", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            AI 산출물 — {char.name}이 완료한 작업
          </div>
          {artifactsLoading ? (
            <div style={{ fontSize: "0.72rem", color: "var(--color-muted)" }}>불러오는 중...</div>
          ) : artifacts.length === 0 ? (
            <div style={{
              fontSize: "0.72rem", color: "var(--color-muted)", lineHeight: 1.6,
              padding: "0.75rem", background: "rgba(0,0,0,0.03)",
              borderRadius: 6, border: "1px dashed var(--color-border)",
            }}>
              아직 완료한 작업이 없습니다.<br />
              태스크를 처리하면 산출물이 여기에 기록됩니다.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 340, overflowY: "auto" }}>
              {artifacts.map((a) => {
                const isExpanded = expandedArtifactId === a.id;
                const typeLabel: Record<string, string> = {
                  document: "📄", code: "💻", analysis: "📊", memo: "📝", copy: "✍️",
                };
                const emoji = typeLabel[a.artifact_type?.toLowerCase()] ?? "📎";
                return (
                  <div key={a.id} style={{
                    borderRadius: 6, border: "1px solid var(--color-border)",
                    background: "rgba(0,0,0,0.02)", overflow: "hidden",
                  }}>
                    <button
                      onClick={() => setExpandedArtifactId(isExpanded ? null : a.id)}
                      style={{
                        width: "100%", textAlign: "left", padding: "0.45rem 0.6rem",
                        background: "none", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "0.4rem",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem" }}>{emoji}</span>
                      <span style={{ flex: 1, fontSize: "0.73rem", fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.title.replace(/^AI Output: /, "")}
                      </span>
                      <span style={{ fontSize: "0.6rem", color: "var(--color-muted)", flexShrink: 0 }}>
                        {new Date(a.created_at).toLocaleDateString("ko-KR")}
                      </span>
                      <span style={{ fontSize: "0.65rem", color: "var(--color-muted)", flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
                    </button>
                    {isExpanded && a.content_markdown && (
                      <div style={{
                        padding: "0.5rem 0.65rem", borderTop: "1px solid var(--color-border)",
                        fontSize: "0.7rem", color: "var(--color-text)", lineHeight: 1.65,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                        maxHeight: 200, overflowY: "auto",
                        background: "rgba(0,0,0,0.03)",
                      }}>
                        {a.content_markdown}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <FounderMessageInput charId={char.id} charName={char.name} />
    </div>
  );
}

function FounderMessageInput({ charId, charName }: { charId: string; charName: string }) {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"message" | "task" | "feedback">("message");
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [inReviewTasks, setInReviewTasks] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (mode !== "task") return;
    apiGet<{ data?: { items?: Array<{ id: string; title: string; state: string }> } }>("/projects?limit=20")
      .then(r => {
        const items = r.data?.items ?? [];
        const active = items.filter(p => p.state === "Active" || p.state === "Draft");
        const list = active.length > 0 ? active : items;
        setProjects(list);
        if (list.length > 0) setSelectedProjectId(prev => prev || list[0]!.id);
      })
      .catch(() => {});
  }, [mode]);

  useEffect(() => {
    if (mode !== "feedback") return;
    apiGet<{ data?: { items?: Array<{ id: string; title: string; state: string; assignee_character_id?: string }> } }>("/tasks?state=InReview&limit=20")
      .then(r => {
        const items = (r.data?.items ?? []).map(t => ({
          id: t.id,
          title: t.title,
        }));
        setInReviewTasks(items);
        if (items.length > 0) setSelectedTaskId(prev => prev || items[0]!.id);
      })
      .catch(() => {});
  }, [mode]);

  const send = async () => {
    const text = msg.trim();
    if (!text || sending) return;
    setSending(true);
    setFeedback(null);
    try {
      if (mode === "message") {
        await apiPost<unknown>(`/characters/${charId}/message`, { message: text });
        setMsg("");
        setFeedback({ ok: true, text: "메시지 전송됨" });
      } else if (mode === "feedback") {
        if (!selectedTaskId) { setFeedback({ ok: false, text: "태스크를 선택해주세요" }); return; }
        await apiPost<unknown>(`/tasks/${selectedTaskId}/feedback`, {
          comment: text,
          requestRevision: true,
        });
        setMsg("");
        setFeedback({ ok: true, text: "피드백 전송됨 — 수정 작업이 시작됩니다" });
        setInReviewTasks(prev => prev.filter(t => t.id !== selectedTaskId));
        setSelectedTaskId("");
      } else {
        if (!selectedProjectId) { setFeedback({ ok: false, text: "프로젝트를 선택해주세요" }); return; }
        const res = await apiPost<{ ok: boolean; data?: { id?: string } }>("/tasks", {
          projectId: selectedProjectId,
          title: text,
          description: `파운더 직접 지시: ${text}`,
          assigneeCharacterId: charId,
          priority: "High",
          taskType: "document",
        });
        const taskId = res.data?.id;
        if (taskId) {
          await apiPost<unknown>("/jobs", {
            queueName: "ai-actions",
            payload: { input: { taskId, characterId: charId } },
          });
          setMsg("");
          setFeedback({ ok: true, text: `"${text.slice(0, 24)}" 태스크 생성 + AI 시작` });
        }
      }
      setTimeout(() => setFeedback(null), 3500);
    } catch {
      setFeedback({ ok: false, text: "실패. 다시 시도해주세요." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {/* Header + mode toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.72rem", color: "#b45309", fontWeight: 600 }}>👑 {charName}에게</span>
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(180,83,9,0.25)" }}>
          {(["message", "task", "feedback"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "0.2rem 0.55rem", fontSize: "0.65rem", fontWeight: mode === m ? 700 : 400,
              background: mode === m ? "rgba(180,83,9,0.18)" : "transparent",
              color: mode === m ? "#b45309" : "var(--color-muted)",
              border: "none", cursor: "pointer",
            }}>
              {m === "message" ? "💬 메시지" : m === "task" ? "📋 태스크" : "🔄 피드백"}
            </button>
          ))}
        </div>
      </div>

      {/* Project picker (task mode only) */}
      {mode === "task" && (
        <select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
          style={{
            background: "var(--color-panel)", border: "1px solid var(--color-border)",
            color: "var(--color-text)", borderRadius: 6,
            padding: "0.3rem 0.45rem", fontSize: "0.73rem",
          }}
        >
          {projects.length === 0
            ? <option value="">프로젝트 없음</option>
            : projects.map(p => <option key={p.id} value={p.id}>{p.title.slice(0, 30)}</option>)
          }
        </select>
      )}

      {/* InReview task picker (feedback mode only) */}
      {mode === "feedback" && (
        <select
          value={selectedTaskId}
          onChange={e => setSelectedTaskId(e.target.value)}
          style={{
            background: "var(--color-panel)", border: "1px solid var(--color-border)",
            color: "var(--color-text)", borderRadius: 6,
            padding: "0.3rem 0.45rem", fontSize: "0.73rem",
          }}
        >
          {inReviewTasks.length === 0
            ? <option value="">검토 중인 태스크 없음</option>
            : inReviewTasks.map(t => (
              <option key={t.id} value={t.id}>{t.title.slice(0, 35)}</option>
            ))
          }
        </select>
      )}

      {/* Input row */}
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder={
            mode === "message" ? "질문 또는 지시…"
            : mode === "feedback" ? "피드백 내용 (예: 3페이지 데이터 보완 필요)"
            : "태스크 제목 (예: 시장 분석 보고서 작성)"
          }
          style={{
            flex: 1, background: "var(--color-panel)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)", borderRadius: 6,
            padding: "0.35rem 0.55rem", fontSize: "0.78rem",
          }}
        />
        <button
          onClick={() => void send()}
          disabled={!msg.trim() || sending || (mode === "task" && !selectedProjectId) || (mode === "feedback" && !selectedTaskId)}
          style={{
            background: "rgba(180,83,9,0.1)",
            border: "1px solid rgba(180,83,9,0.35)",
            color: "#b45309", borderRadius: 6,
            padding: "0.35rem 0.65rem", fontSize: "0.78rem",
            cursor: (!msg.trim() || sending) ? "default" : "pointer",
          }}
        >
          {sending ? "…" : mode === "message" ? "전송" : mode === "feedback" ? "피드백" : "지시"}
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          fontSize: "0.7rem", padding: "0.25rem 0.5rem", borderRadius: 5,
          color: feedback.ok ? "#4ade80" : "#f87171",
          background: feedback.ok ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
          border: `1px solid ${feedback.ok ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
        }}>
          {feedback.ok ? "✓" : "✕"} {feedback.text}
        </div>
      )}
    </div>
  );
}

// ── Event Ticker ──────────────────────────────────────────────────────────────

interface TickerEvent { id: string; text: string; emoji: string }

function EventTicker({ events }: { events: TickerEvent[] }) {
  if (events.length === 0) return null;
  const doubled = [...events, ...events];
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, height: 26,
      background: "rgba(0,0,0,0.78)", borderTop: "1px solid rgba(255,255,255,0.07)",
      overflow: "hidden", display: "flex", alignItems: "center",
      pointerEvents: "none", zIndex: 10,
    }}>
      <div style={{
        display: "flex", gap: "3rem",
        animation: "bloks-ticker 40s linear infinite",
        whiteSpace: "nowrap", fontSize: "0.68rem",
        color: "rgba(255,255,255,0.55)", paddingLeft: "100%",
      }}>
        {doubled.map((e, i) => <span key={`${e.id}-${i}`}>{e.emoji} {e.text}</span>)}
      </div>
      <style>{`@keyframes bloks-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function IsometricWorldCanvas() {
  const { openPanel } = useContext(ContextPanelContext);
  const openPanelRef = useRef(openPanel);
  useEffect(() => { openPanelRef.current = openPanel; }, [openPanel]);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFloorId, setSelectedFloorId] = useState("engineering");
  const [layoutSeats, setLayoutSeats] = useState<Record<string, Array<{ x: number; y: number }>>>({});
  const [layoutZones, setLayoutZones] = useState<Record<string, Array<{ type: string; x1: number; y1: number; x2: number; y2: number }>>>({});
  const [layoutMeetingSeats, setLayoutMeetingSeats] = useState<Record<string, Array<{ x: number; y: number }>>>({});
  const [runtimePatches, setRuntimePatches] = useState<Record<string, RuntimePatch>>({});
  const [streamConnected, setStreamConnected] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [tickerEvents, setTickerEvents] = useState<TickerEvent[]>([]);
  const [meetingBanner, setMeetingBanner] = useState<string | null>(null);
  const [meetingGuestIds, setMeetingGuestIds] = useState<Set<string>>(new Set());
  const [cameraZoom, setCameraZoom] = useState(1.0);
  const [liveFeed, setLiveFeed] = useState<Array<{ id: string; emoji: string; text: string; ts: number }>>([]);
  const [charTaskStates, setCharTaskStates] = useState<Record<string, string>>({});
  const [charLocationZones, setCharLocationZones] = useState<Record<string, string>>({});
  const [dramaMode, setDramaMode] = useState(false);

  const { recordingState, elapsed, startRecording, stopRecording } = useCanvasRecorder();

  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  // WorldScene API ref — set by the scene's create() callback
  const sceneRef = useRef<WorldSceneAPI | null>(null);
  // Refs for latest values — avoids stale closure in waitForScene
  const sceneCharsRef = useRef<CharInfo[]>([]);
  const floorDirRef = useRef<string>("3f-engineering");
  // Ref for patchedCharacters — keeps handleCharClick stable so it can be set once in waitForScene
  const patchedCharactersRef = useRef<Character[]>([]);
  // Refs for SSE handler — avoids stale closures on layout/floor state
  const layoutZonesRef = useRef(layoutZones);
  const selectedFloorIdRef = useRef(selectedFloorId);

  // ── Load characters ────────────────────────────────────────────────────────
  useEffect(() => {
    apiGet<{ data?: { items?: Character[] } }>("/characters?pageSize=100&includeLevel=true")
      .then((body) => { setCharacters(body.data?.items ?? []); setLoading(false); })
      .catch(() => { setCharacters([]); setLoading(false); });
  }, []);

  // ── Fetch layout.json (seats + zones + meeting_seats) ─────────────────────
  useEffect(() => {
    const needSeats = !FLOOR_SEAT_OVERRIDES[selectedFloorId] && !layoutSeats[selectedFloorId];
    const needZones = !layoutZones[selectedFloorId];
    if (!needSeats && !needZones) return;
    const dir = FLOOR_DIR[selectedFloorId];
    if (!dir) return;
    fetch(`/floors/${dir}/layout.json`)
      .then((r) => r.json())
      .then((data: {
        seats?: Array<{ x: number; y: number }>;
        zones?: Array<{ type: string; x1: number; y1: number; x2: number; y2: number }>;
        meeting_seats?: Array<{ x: number; y: number }>;
      }) => {
        if (needSeats && data.seats?.length) {
          setLayoutSeats((prev) => ({ ...prev, [selectedFloorId]: data.seats! }));
        }
        setLayoutZones((prev) => ({ ...prev, [selectedFloorId]: data.zones ?? [] }));
        if (data.meeting_seats?.length) {
          setLayoutMeetingSeats((prev) => ({ ...prev, [selectedFloorId]: data.meeting_seats! }));
        }
      })
      .catch(() => {
        setLayoutZones((prev) => ({ ...prev, [selectedFloorId]: [] }));
      });
  }, [selectedFloorId, layoutSeats, layoutZones]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const patchedCharacters = useMemo(() => {
    if (Object.keys(runtimePatches).length === 0) return characters;
    return characters.map((char) => {
      const patch = runtimePatches[char.id];
      if (!patch) return char;
      const existing = Array.isArray(char.character_runtime_states)
        ? (char.character_runtime_states[0] ?? {})
        : (char.character_runtime_states ?? {});
      return { ...char, character_runtime_states: [{ ...existing, ...patch }] };
    });
  }, [characters, runtimePatches]);

  const selectedFloor = useMemo(
    () => FLOORS.find((f) => f.id === selectedFloorId) ?? FLOORS[0]!,
    [selectedFloorId],
  );

  const floorCharacters = useMemo(() => {
    if (selectedFloor.divisionCodes.length === 0) return [];
    const active = patchedCharacters.filter((c) =>
      c.active_flag !== false && charLocationZones[c.id] !== "offline"
    );
    const codes = new Set(selectedFloor.divisionCodes.map((c) => c.toLowerCase()));
    const residents = active.filter((c) =>
      codes.has((c.divisions?.division_type ?? c.division_id ?? "").toLowerCase())
    );
    const guests = meetingGuestIds.size > 0
      ? active.filter((c) => meetingGuestIds.has(c.id) && !codes.has((c.divisions?.division_type ?? c.division_id ?? "").toLowerCase()))
      : [];
    const maxSeats = getSeats(selectedFloor.id, layoutSeats).length;
    if (guests.length > 0) return [...residents.slice(0, maxSeats), ...guests];
    return residents.slice(0, maxSeats);
  }, [patchedCharacters, selectedFloor, meetingGuestIds, layoutSeats, charLocationZones]);

  const floorCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of patchedCharacters) {
      const id = getCharFloorId(c);
      map[id] = (map[id] ?? 0) + 1;
    }
    return map;
  }, [patchedCharacters]);

  const floorBurnout = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of patchedCharacters) {
      if (getRuntime(c).burnout_triggered) map[getCharFloorId(c)] = true;
    }
    return map;
  }, [patchedCharacters]);

  // Build CharInfo[] for the scene
  const sceneChars = useMemo<CharInfo[]>(() => {
    const residents = floorCharacters.filter((c) => !meetingGuestIds.has(c.id));
    const guests = floorCharacters.filter((c) => meetingGuestIds.has(c.id));
    const allChars = [...residents, ...guests];
    const seats = getSeats(selectedFloor.id, layoutSeats);
    // Meeting positions: prefer layout.json meeting_seats, then zones, then hardcoded MEETING_ZONES
    const floorMeetingSeats = layoutMeetingSeats[selectedFloor.id];
    const floorZones = layoutZones[selectedFloor.id] ?? [];
    const meetingZone = floorZones.find((z) => z.type === "meeting-room");
    const meetingPositions: Array<{ x: number; y: number }> = floorMeetingSeats?.length
      ? floorMeetingSeats
      : meetingZone
      ? Array.from({ length: 8 }, (_, i) => ({
          x: meetingZone.x1 + ((meetingZone.x2 - meetingZone.x1) / 8) * (i + 0.5),
          y: (meetingZone.y1 + meetingZone.y2) / 2,
        }))
      : (MEETING_ZONES[selectedFloor.id] ?? []);

    return allChars.map((char, i) => {
      const rt = getRuntime(char);
      const isGuest = meetingGuestIds.has(char.id);
      const residentIdx = i; // seat index (guests start from residents.length)
      const guestIdx = i - residents.length; // index within guests

      let seatX: number, seatY: number;
      if (isGuest && guestIdx >= 0 && guestIdx < meetingPositions.length) {
        // Place guests at meeting zone positions
        const pos = meetingPositions[guestIdx]!;
        seatX = pos.x * CANVAS_W;
        seatY = pos.y * CANVAS_H;
      } else {
        const seat = seats[residentIdx] ?? seats[0]!;
        seatX = seat.x * CANVAS_W;
        seatY = seat.y * CANVAS_H;
      }

      return {
        id: char.id, name: char.name, codeName: char.code_name,
        fatigue: rt.fatigue_score ?? 0,
        workload: rt.workload_score ?? 0,
        burnout: rt.burnout_triggered ?? false,
        seatX, seatY,
        isFounder: char.code_name === "FOUNDER-01",
        role: char.roles?.name,
        ...(charTaskStates[char.id] ? { taskState: charTaskStates[char.id] } : {}),
      };
    });
  }, [floorCharacters, meetingGuestIds, selectedFloor, layoutSeats, layoutZones, layoutMeetingSeats, charTaskStates, charLocationZones]);

  // ── Sync scene when floor or characters change ─────────────────────────────
  const floorDir = FLOOR_DIR[selectedFloorId] ?? "3f-engineering";

  // Keep refs fresh so waitForScene always has the latest values
  floorDirRef.current = floorDir;
  sceneCharsRef.current = sceneChars;
  patchedCharactersRef.current = patchedCharacters;
  layoutZonesRef.current = layoutZones;
  selectedFloorIdRef.current = selectedFloorId;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.changeFloor(floorDir);
  }, [floorDir]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.upsertCharacters(sceneChars);
  }, [sceneChars]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setCameraZoom(cameraZoom);
  }, [cameraZoom]);

  // Stable char click handler — reads patchedCharactersRef so it never goes stale
  const handleCharClick = useCallback((charId: string) => {
    const char = patchedCharactersRef.current.find((c) => c.id === charId);
    if (char) openPanelRef.current(char.name, <CharacterDetail key={char.id} char={char} />);
  }, []);

  // ── SSE event handler ──────────────────────────────────────────────────────
  useWorldStream(useCallback((event) => {
    if (event.type === "connected") { setStreamConnected(true); return; }

    const extracted = extractRuntimePatch(event);
    if (extracted) {
      setRuntimePatches((prev) => ({
        ...prev,
        [extracted.characterId]: { ...(prev[extracted.characterId] ?? {}), ...extracted.patch },
      }));
    }

    if (event.type === "character_flags_updated") {
      const { characterId, active_flag, ai_enabled } = event.payload as {
        characterId?: string; active_flag?: boolean; ai_enabled?: boolean;
      };
      if (characterId) {
        setCharacters((prev) => prev.map((c) =>
          c.id === characterId
            ? { ...c, ...(active_flag !== undefined && { active_flag }), ...(ai_enabled !== undefined && { ai_enabled }) }
            : c
        ));
      }
    }

    // Direct bubble events → scene
    if (event.type === "character_bubble") {
      const { characterId, bubbleType, text, emoji, duration, emotion, isFounderMessage } = event.payload as {
        characterId?: string; bubbleType?: string; text?: string;
        emoji?: string; duration?: number; emotion?: string; isFounderMessage?: boolean;
      };
      if (characterId && text) {
        sceneRef.current?.showBubble(
          characterId,
          (bubbleType as "speech" | "thought") ?? "speech",
          text, duration ?? 8000, emoji, emotion,
          isFounderMessage ?? false,
        );
      }
    }

    if (event.type === "character_moved") {
      const { characterId, toStatus, location_zone } = event.payload as {
        characterId?: string; toStatus?: string; location_zone?: string;
      };
      if (!characterId) return;
      if (location_zone) {
        setCharLocationZones((prev) => ({ ...prev, [characterId]: location_zone }));

        // Switch floor if this zone has a designated home floor
        const zoneHomeFloor = LOCATION_ZONE_FLOOR[location_zone];
        if (zoneHomeFloor) setSelectedFloorId(zoneHomeFloor);

        const charInfo = sceneCharsRef.current.find(c => c.id === characterId);
        if (charInfo && location_zone !== "offline") {
          if (location_zone === "desk") {
            sceneRef.current?.walkToPositions([{ charId: characterId, x: charInfo.seatX, y: charInfo.seatY }]);
          } else if (location_zone !== "meeting-room") {
            // Walk to the matching zone's center on the target floor
            const targetFloor = zoneHomeFloor ?? selectedFloorIdRef.current;
            const zones = layoutZonesRef.current[targetFloor] ?? [];
            const zone = zones.find(z => z.type === location_zone);
            if (zone) {
              const targetX = ((zone.x1 + zone.x2) / 2) * CANVAS_W;
              const targetY = ((zone.y1 + zone.y2) / 2) * CANVAS_H;
              sceneRef.current?.walkToPositions([{ charId: characterId, x: targetX, y: targetY }]);
            }
          }
          // meeting-room is handled via meetingGuestIds → sceneChars recompute below
        }
      }
      if (toStatus === "InMeeting") {
        setMeetingGuestIds((prev) => new Set([...prev, characterId]));
      } else if (toStatus && toStatus !== "InMeeting") {
        setMeetingGuestIds((prev) => { const s = new Set(prev); s.delete(characterId); return s; });
      }
      if (toStatus === "Burnout") {
        sceneRef.current?.triggerFlash(220, 60, 60);
        sceneRef.current?.showBubble(characterId, "thought", "😵 번아웃...", 6000, "😵", "sad");
      }
    }

    if (event.type === "agent_message") {
      const { fromCharId, toCharId, content } = event.payload as { fromCharId?: string; toCharId?: string; content?: string };
      if (fromCharId && toCharId) {
        sceneRef.current?.walkCharacterToCharacter(toCharId, fromCharId, content ?? "");
      }
    }

    if (event.type === "character_message") {
      const { characterId, direction } = event.payload as { characterId?: string; direction?: string };
      if (characterId && direction === "founder_to_char") {
        const founderChar = characters.find((c) => c.code_name === "FOUNDER-01");
        if (founderChar) {
          sceneRef.current?.walkCharacterToCharacter(founderChar.id, characterId, "");
        }
      }
    }

    // workflow_stage events → scene + React state
    if (event.type === "workflow_stage") {
      const p = event.payload as {
        stage?: string; characterIds?: string[]; floorId?: string;
        speakerId?: string; text?: string; projectTitle?: string;
      };
      const scene = sceneRef.current;

      if (p.stage === "project_received" && p.speakerId && p.text) {
        scene?.showBubble(p.speakerId, "thought", p.text, 6000, "🤔", "question");
      }

      if (p.stage === "meeting_called" && p.characterIds) {
        const targetFloor = p.floorId ?? LOCATION_ZONE_FLOOR["meeting-room"] ?? FLOORS[FLOORS.length - 1]!.id;
        setMeetingGuestIds(new Set(p.characterIds));
        setSelectedFloorId(targetFloor);
        setMeetingBanner(`🏢 ${p.projectTitle ?? "프로젝트"} — 회의 진행 중`);
        if (p.speakerId && p.text) {
          scene?.showBubble(p.speakerId, "speech", p.text, 5000, "📢", "excited");
        }
      }

      if (p.stage === "meeting_dialogue" && p.speakerId && p.text) {
        scene?.showBubble(p.speakerId, "speech", p.text, 6000, "💬", "neutral");
      }

      if (p.stage === "meeting_ended") {
        if (p.speakerId && p.text) {
          scene?.showBubble(p.speakerId, "speech", p.text, 7000, "✅", "excited");
        }
        setTimeout(() => {
          setMeetingGuestIds(new Set());
          setMeetingBanner(null);
        }, 8000);
      }

      if (p.stage === "work_delegated" && p.characterIds && p.characterIds.length >= 2) {
        const [leaderId, memberId] = p.characterIds;
        if (leaderId && memberId && scene) {
          scene.walkCharacterToCharacter(leaderId, memberId, p.text ?? "");
        }
      }

      if (p.stage === "project_delivered") {
        scene?.triggerFlash(255, 215, 0); // gold flash
        if (p.speakerId && p.text) {
          scene?.showBubble(p.speakerId as string, "speech", p.text as string, 8000, "🎁", "excited");
          scene?.triggerParticleBurst(p.speakerId as string);
          if (dramaMode) scene?.focusCameraOnChar(p.speakerId as string);
        }
        // 팀원 전체에 축하 버블 + 파티클
        for (const charId of (p.characterIds ?? [])) {
          if (charId !== p.speakerId) {
            const delay = 800 + Math.random() * 1200;
            setTimeout(() => {
              scene?.showBubble(charId as string, "speech", "🎉", 5000, "🎉", "excited");
              scene?.triggerParticleBurst(charId as string);
            }, delay);
          }
        }
        setTickerEvents((prev) => [...prev, {
          id: `${Date.now()}-delivered`,
          emoji: "🎁",
          text: `${p.projectTitle ?? "프로젝트"} 납품 완료!`,
        }].slice(-20));
      }

      // Ticker
      const stageEmoji: Record<string, string> = {
        project_received: "📥", meeting_called: "🏢", meeting_dialogue: "💬",
        meeting_ended: "✅", work_delegated: "📋", review_requested: "🔍", project_delivered: "🎁",
      };
      if (p.stage && p.projectTitle) {
        const emoji = stageEmoji[p.stage] ?? "⚙️";
        setTickerEvents((prev) => [
          ...prev,
          { id: `${Date.now()}-wf`, text: `${p.projectTitle}: ${p.stage?.replace(/_/g, " ")}`, emoji },
        ].slice(-20));
      }
    }

    // 캐릭터 레벨업 이벤트
    if (event.type === "character_levelup") {
      const p = event.payload as { characterId?: string; newLevel?: number; gainedExp?: number };
      const charName = characters.find((c) => c.id === p.characterId)?.name ?? "?";
      if (p.characterId && p.newLevel) {
        sceneRef.current?.showBubble(p.characterId, "speech", `⬆️ Lv.${p.newLevel} 달성!`, 5000, "⬆️", "excited");
        sceneRef.current?.triggerFlash(255, 215, 0);
      }
      setLiveFeed((prev) => [{
        id: `${Date.now()}-lvup`, emoji: "⬆️",
        text: `${charName} Lv.${p.newLevel ?? "??"} 달성! (+${p.gainedExp ?? 0}exp)`,
        ts: Date.now(),
      }, ...prev].slice(0, 15));
      setTickerEvents((prev) => [...prev, { id: `${Date.now()}-lvup`, emoji: "⬆️", text: `${charName} Lv.${p.newLevel} 달성!` }].slice(-20));
    }

    // Camera effects
    if (event.type === "runtime_update") {
      const { burnout_triggered } = event.payload as { characterId?: string; burnout_triggered?: boolean };
      if (burnout_triggered) sceneRef.current?.triggerFlash(255, 0, 0);
    }
    if (event.type === "world_tick" && (event.payload as { event?: string }).event === "project_completed") {
      sceneRef.current?.triggerFlash(0, 255, 136);
    }

    // agent_message → live feed
    if (event.type === "agent_message") {
      const p = event.payload as { fromCharId?: string; toCharId?: string; messageType?: string; content?: string };
      const fromName = characters.find((c) => c.id === p.fromCharId)?.name ?? "?";
      const toName = characters.find((c) => c.id === p.toCharId)?.name ?? "?";
      const msgEmoji: Record<string, string> = { HANDOFF: "💼", REVIEW_REQUEST: "🔍", RESPONSE: "✅", FYI: "📢", REQUEST: "📩" };
      const emoji = msgEmoji[p.messageType ?? ""] ?? "💬";
      setLiveFeed((prev) => [{
        id: `${Date.now()}-${Math.random()}`, emoji,
        text: `${fromName} → ${toName}: ${(p.content ?? "").slice(0, 25)}`,
        ts: Date.now(),
      }, ...prev].slice(0, 15));
    }

    // Live feed + ticker for task/workflow events
    if (event.type === "task_state_changed") {
      const p = event.payload as { taskId?: string; characterId?: string; from?: string; to?: string; taskTitle?: string };
      const charName = characters.find((c) => c.id === p.characterId)?.name ?? p.characterId ?? "?";
      const stateEmoji: Record<string, string> = { InProgress: "⚙️", InReview: "🔍", Done: "✅", Blocked: "🔒", Todo: "📋" };
      const emoji = stateEmoji[p.to ?? ""] ?? "📋";
      const text = p.taskTitle
        ? `${charName}: ${p.taskTitle.slice(0, 18)} → ${p.to}`
        : `${charName}: ${p.from} → ${p.to}`;
      setLiveFeed((prev) => [{ id: `${Date.now()}-${Math.random()}`, emoji, text, ts: Date.now() }, ...prev].slice(0, 15));
      if (p.characterId) {
        setCharTaskStates((prev) => ({ ...prev, [p.characterId!]: p.to === "Done" ? "" : (p.to ?? "") }));
      }

      // 드라마 연출: 태스크 시작 — 버블 + 글로우
      if (p.to === "InProgress" && p.characterId) {
        const label = p.taskTitle ? `💼 ${p.taskTitle.slice(0, 28)}` : "💼 작업 시작!";
        sceneRef.current?.showBubble(p.characterId, "speech", label, 7000, "💼", "working");
        sceneRef.current?.setCharacterGlow(p.characterId, true);
        if (dramaMode) sceneRef.current?.focusCameraOnChar(p.characterId);
      }

      // 드라마 연출: 검토 중 — 말풍선
      if (p.to === "InReview" && p.characterId) {
        const label = p.taskTitle ? `🔍 검토 중: ${p.taskTitle.slice(0, 22)}` : "🔍 검토 요청";
        sceneRef.current?.showBubble(p.characterId, "thought", label, 6000, "🔍", "question");
      }

      // 드라마 연출: 완료 — 파티클 + 버블 + 글로우 해제
      if (p.to === "Done" && p.characterId) {
        const label = p.taskTitle ? `✅ 완료: ${p.taskTitle.slice(0, 24)}` : "✅ 완료!";
        sceneRef.current?.showBubble(p.characterId, "speech", label, 6000, "✅", "excited");
        sceneRef.current?.triggerParticleBurst(p.characterId);
        sceneRef.current?.setCharacterGlow(p.characterId, false);
        sceneRef.current?.triggerFlash(74, 222, 128);
        setTickerEvents((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, emoji: "✅", text: `${charName} 작업 완료${p.taskTitle ? `: ${p.taskTitle.slice(0, 15)}` : ""}` }].slice(-20));
      }

      // 드라마 연출: 블록됨
      if (p.to === "Blocked" && p.characterId) {
        sceneRef.current?.showBubble(p.characterId, "thought", "🔒 진행 불가...", 5000, "🔒", "sad");
      }
    }

    // Ticker for other events
    type TickerMapper = (p: Record<string, unknown>) => { text: string; emoji: string } | null;
    const tickerMap: Partial<Record<typeof event.type, TickerMapper>> = {
      character_bubble: (p) => p.isFounderMessage
        ? { text: `👑 → "${String(p.text ?? "").slice(0, 20)}"`, emoji: "💬" }
        : null,
      world_tick: (p) => (p as { event?: string }).event === "project_completed"
        ? { text: `프로젝트 완료: "${String(p.projectTitle ?? "").slice(0, 20)}"`, emoji: "🎉" }
        : null,
      founder_override: (p) => ({ text: `파운더 오버라이드: ${String(p.action ?? "")}`, emoji: "⚡" }),
    };
    const mapper = tickerMap[event.type];
    if (mapper) {
      const result = mapper(event.payload);
      if (result) {
        setTickerEvents((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, ...result }].slice(-20));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters]));

  // ── Init Phaser (once) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    let cancelled = false;
    let waitForScene: ReturnType<typeof setInterval> | null = null;

    import("phaser").then((Phaser) => {
      if (cancelled || !containerRef.current) return;

      const WorldSceneClass = createWorldScene(Phaser, sceneRef);

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: "#1a1a2e",
        parent: containerRef.current,
        scene: [WorldSceneClass],
        pixelArt: true,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        audio: { noAudio: true },
        banner: false,
      });

      gameRef.current = game;
      if (typeof window !== "undefined") (window as never as Record<string, unknown>).__phaserGame = game;

      // Once scene is ready, apply current state via refs (avoids stale closure)
      waitForScene = setInterval(() => {
        const scene = sceneRef.current;
        if (!scene) return;
        if (waitForScene) clearInterval(waitForScene);
        scene.setCharClickHandler(handleCharClick);
        scene.changeFloor(floorDirRef.current);
        scene.upsertCharacters(sceneCharsRef.current);
      }, 100);
    });

    return () => {
      cancelled = true;
      if (waitForScene) clearInterval(waitForScene);
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  // Run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleCharClick]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0d0d18" }}>

      {/* Floor selector bar */}
      <div style={{
        display: "flex", gap: "0.25rem", padding: "0.5rem 0.75rem",
        background: "rgba(0,0,0,0.7)", borderBottom: "1px solid rgba(255,255,255,0.07)",
        overflowX: "auto", flexShrink: 0, alignItems: "center",
      }}>
        <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", marginRight: "0.25rem", whiteSpace: "nowrap" }}>FLOOR</span>

        <span style={{
          display: "inline-flex", alignItems: "center", gap: "0.25rem",
          marginRight: "0.5rem", fontSize: "0.65rem",
          color: streamConnected ? "rgba(100,220,100,0.7)" : "rgba(255,150,50,0.7)",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: streamConnected ? "#4caf50" : "#ff9800",
            boxShadow: streamConnected ? "0 0 4px #4caf50" : "none",
          }} />
          {streamConnected ? "LIVE" : "OFF"}
        </span>

        {(() => {
          const inactiveCount = patchedCharacters.filter((c) => c.active_flag === false).length;
          if (inactiveCount === 0) return null;
          return (
            <button onClick={() => setShowInactive((v) => !v)} style={{
              marginLeft: "auto", padding: "0.28rem 0.65rem", borderRadius: "0.35rem",
              border: showInactive ? "1px solid rgba(255,180,50,0.6)" : "1px solid rgba(255,255,255,0.1)",
              background: showInactive ? "rgba(255,180,50,0.15)" : "rgba(255,255,255,0.04)",
              color: showInactive ? "#ffb432" : "rgba(255,255,255,0.4)",
              fontSize: "0.72rem", cursor: "pointer", whiteSpace: "nowrap",
            }}>
              🏝️ {inactiveCount}
            </button>
          );
        })()}

        {FLOORS.map((floor) => {
          const count = floorCounts[floor.id] ?? 0;
          const isSelected = floor.id === selectedFloorId;
          const hasBurnout = floorBurnout[floor.id];
          return (
            <button key={floor.id} onClick={() => setSelectedFloorId(floor.id)} style={{
              padding: "0.28rem 0.65rem", borderRadius: "0.35rem",
              border: isSelected ? "1px solid rgba(100,180,255,0.6)" : "1px solid rgba(255,255,255,0.1)",
              background: isSelected ? "rgba(100,180,255,0.15)" : "rgba(255,255,255,0.04)",
              color: isSelected ? "#64b4ff" : hasBurnout ? "#ff6644" : "rgba(255,255,255,0.5)",
              fontSize: "0.72rem", fontWeight: isSelected ? 600 : 400,
              cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.12s",
            }}>
              {floor.label}
              {count > 0 && (
                <span style={{ marginLeft: "0.3rem", fontSize: "0.62rem", color: hasBurnout ? "#ff6644" : "rgba(255,255,255,0.35)" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
          {/* 드라마 모드 토글 */}
          <button
            onClick={() => setDramaMode(v => !v)}
            title="드라마 모드: 활성 캐릭터로 카메라 자동 이동"
            style={{
              padding: "0.2rem 0.55rem", borderRadius: 4, cursor: "pointer", fontSize: "0.65rem",
              border: dramaMode ? "1px solid rgba(255,165,0,0.6)" : "1px solid rgba(255,255,255,0.12)",
              background: dramaMode ? "rgba(255,165,0,0.18)" : "rgba(255,255,255,0.05)",
              color: dramaMode ? "#ffa500" : "rgba(255,255,255,0.4)",
              fontWeight: dramaMode ? 700 : 400,
            }}
          >
            🎬 {dramaMode ? "DRAMA" : "드라마"}
          </button>

          {/* 녹화 버튼 */}
          <button
            onClick={() => {
              if (recordingState === "idle") {
                const canvas = gameRef.current?.canvas;
                if (canvas) startRecording(canvas);
              } else if (recordingState === "recording") {
                stopRecording();
              }
            }}
            disabled={recordingState === "saving"}
            title={recordingState === "idle" ? "화면 녹화 시작" : recordingState === "recording" ? "녹화 정지 후 저장" : "저장 중..."}
            style={{
              display: "flex", alignItems: "center", gap: "0.3rem",
              padding: "0.2rem 0.55rem", borderRadius: 4, cursor: recordingState === "saving" ? "default" : "pointer",
              fontSize: "0.65rem", fontWeight: 600,
              border: recordingState === "recording" ? "1px solid rgba(255,60,60,0.8)" : "1px solid rgba(255,255,255,0.12)",
              background: recordingState === "recording" ? "rgba(255,40,40,0.2)" : "rgba(255,255,255,0.05)",
              color: recordingState === "recording" ? "#ff4444" : recordingState === "saving" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.5)",
            }}
          >
            {recordingState === "recording" ? (
              <>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4444", animation: "pulse 1s infinite", display: "inline-block" }} />
                {`${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`}
              </>
            ) : recordingState === "saving" ? "저장 중..." : (
              <>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.4)", display: "inline-block" }} />
                REC
              </>
            )}
          </button>

          {/* 줌 컨트롤 */}
          <button onClick={() => setCameraZoom(z => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))))}
            style={{ padding: "0.2rem 0.5rem", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem", lineHeight: 1 }}>−</button>
          <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", minWidth: 32, textAlign: "center" }}>{Math.round(cameraZoom * 100)}%</span>
          <button onClick={() => setCameraZoom(z => Math.min(3.0, parseFloat((z + 0.25).toFixed(2))))}
            style={{ padding: "0.2rem 0.5rem", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem", lineHeight: 1 }}>+</button>
          <button onClick={() => setCameraZoom(1.0)}
            style={{ padding: "0.2rem 0.4rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", borderRadius: 4, cursor: "pointer", fontSize: "0.6rem" }}>↺</button>
        </div>
      </div>

      {/* Inactive overlay */}
      {showInactive && (() => {
        const inactive = patchedCharacters.filter((c) => c.active_flag === false);
        return (
          <div style={{
            position: "absolute", top: 42, right: 0, zIndex: 20,
            background: "rgba(20,20,40,0.97)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "0 0 0 6px", padding: "0.5rem", width: 220,
            maxHeight: 300, overflowY: "auto",
          }}>
            <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.4rem" }}>
              휴가/재택 직원 ({inactive.length})
            </div>
            {inactive.map((c) => (
              <button key={c.id} onClick={() => {
                openPanelRef.current(c.name, <CharacterDetail key={c.id} char={c} />);
                setShowInactive(false);
              }} style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "0.3rem 0.4rem", marginBottom: 2,
                background: "rgba(255,255,255,0.04)", border: "none",
                borderRadius: 3, color: "rgba(255,255,255,0.7)",
                fontSize: "0.75rem", cursor: "pointer",
              }}>
                🏝️ {c.name}
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem", marginLeft: 4 }}>
                  {c.divisions?.division_type ?? ""}
                </span>
              </button>
            ))}
            {inactive.length === 0 && (
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>없음</div>
            )}
          </div>
        );
      })()}

      {/* Canvas + overlays */}
      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {meetingBanner && (
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.5)",
            color: "#FFD700", fontSize: "0.75rem", fontWeight: 600,
            padding: "0.35rem 1.2rem", borderRadius: 6, zIndex: 20,
            pointerEvents: "none", whiteSpace: "nowrap",
            boxShadow: "0 0 12px rgba(255,215,0,0.2)",
          }}>
            {meetingBanner}
          </div>
        )}
        <EventTicker events={tickerEvents} />

        {/* Live activity feed — bottom-right overlay */}
        {liveFeed.length > 0 && (
          <div style={{
            position: "absolute", bottom: 32, right: 12, width: 230, zIndex: 15,
            display: "flex", flexDirection: "column", gap: 4, pointerEvents: "none",
          }}>
            {liveFeed.slice(0, 8).map((entry) => (
              <div key={entry.id} style={{
                background: "rgba(0,0,0,0.72)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6, padding: "0.25rem 0.5rem",
                fontSize: "0.68rem", color: "rgba(255,255,255,0.75)",
                display: "flex", gap: "0.4rem", alignItems: "center",
              }}>
                <span>{entry.emoji}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(13,13,24,0.85)", color: "rgba(255,255,255,0.4)",
          fontSize: "0.85rem", pointerEvents: "none", zIndex: 10,
        }}>
          Loading characters...
        </div>
      )}
    </div>
  );
}
