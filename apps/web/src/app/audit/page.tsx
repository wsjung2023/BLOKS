"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { apiGet, apiPost } from "@/lib/apiClient";
import { useWorldStream } from "@/lib/useWorldStream";

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  eventType: string;
  recordedAt: string;
  execution: {
    id: string;
    tool_name: string;
    risk_level?: string;
    status: string;
    requested_by_character_id: string;
    trace_id?: string;
    input?: Record<string, unknown>;
  };
}

interface ReplayEvent {
  eventType: string;
  recordedAt: string;
  status: string;
}

interface ReplayData {
  traceId: string;
  toolName: string;
  characterId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  finalStatus: string;
  events: ReplayEvent[];
}

// ── 상태 배지 ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  executed: "#2f9e44",
  denied: "#c92a2a",
  approval_required: "#e67700",
  failed: "#c92a2a",
  pending: "#868e96",
};

const RISK_COLOR: Record<string, string> = {
  L0: "#2f9e44",
  L1: "#1971c2",
  L2: "#e67700",
  L3: "#c92a2a",
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 8px",
      borderRadius: 999,
      background: `${color}22`,
      color,
      fontSize: "0.72rem",
      fontWeight: 700,
      border: `1px solid ${color}44`,
    }}>
      {label}
    </span>
  );
}

// ── 리플레이 모달 ─────────────────────────────────────────────────────────────

function ReplayModal({ traceId, onClose }: { traceId: string; onClose: () => void }) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ data: ReplayData }>(`/runtime/audit/replay/${traceId}`)
      .then((r) => setData(r.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [traceId]);

  const EVENT_LABEL: Record<string, string> = {
    "tool.requested": "📋 요청됨",
    "tool.policy.evaluated": "🔍 정책 평가",
    "tool.approval.requested": "⏳ 승인 대기",
    "tool.approved": "✅ 승인됨",
    "tool.denied": "❌ 거부됨",
    "tool.executed": "⚡ 실행됨",
    "tool.failed": "💥 실패",
    "tool.audit.persisted": "📝 감사 기록",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#1a1a2e", borderRadius: 16, padding: "1.5rem",
        width: "min(600px, 90vw)", maxHeight: "80vh", overflow: "auto",
        border: "1px solid #333",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ color: "#e8e8e8", margin: 0, fontSize: "1rem" }}>실행 리플레이</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
        </div>

        {loading && <p style={{ color: "#aaa" }}>로딩 중...</p>}
        {error && <p style={{ color: "#e05c5c" }}>{error}</p>}
        {data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
              <div style={{ background: "#111", borderRadius: 8, padding: "0.75rem" }}>
                <div style={{ color: "#888", fontSize: "0.72rem", marginBottom: 4 }}>툴</div>
                <div style={{ color: "#e8e8e8", fontWeight: 600 }}>{data.toolName}</div>
              </div>
              <div style={{ background: "#111", borderRadius: 8, padding: "0.75rem" }}>
                <div style={{ color: "#888", fontSize: "0.72rem", marginBottom: 4 }}>소요 시간</div>
                <div style={{ color: "#e8e8e8", fontWeight: 600 }}>{data.durationMs}ms</div>
              </div>
              <div style={{ background: "#111", borderRadius: 8, padding: "0.75rem" }}>
                <div style={{ color: "#888", fontSize: "0.72rem", marginBottom: 4 }}>최종 상태</div>
                <Badge
                  label={data.finalStatus}
                  color={STATUS_COLOR[data.finalStatus] ?? "#868e96"}
                />
              </div>
              <div style={{ background: "#111", borderRadius: 8, padding: "0.75rem" }}>
                <div style={{ color: "#888", fontSize: "0.72rem", marginBottom: 4 }}>캐릭터</div>
                <div style={{ color: "#e8e8e8", fontSize: "0.85rem" }}>{data.characterId}</div>
              </div>
            </div>

            <div style={{ color: "#888", fontSize: "0.72rem", marginBottom: "0.5rem" }}>이벤트 타임라인</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {data.events.map((ev, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  background: "#111", borderRadius: 8, padding: "0.5rem 0.75rem",
                }}>
                  <div style={{ color: "#555", fontSize: "0.72rem", whiteSpace: "nowrap", minWidth: 70 }}>
                    {new Date(ev.recordedAt).toLocaleTimeString("ko-KR")}
                  </div>
                  <div style={{ flex: 1, color: "#ccc", fontSize: "0.82rem" }}>
                    {EVENT_LABEL[ev.eventType] ?? ev.eventType}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

interface PauseState {
  paused: boolean;
  pausedAt: string | null;
  reason: string | null;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toolFilter, setToolFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [replayTraceId, setReplayTraceId] = useState<string | null>(null);
  const [pauseState, setPauseState] = useState<PauseState>({ paused: false, pausedAt: null, reason: null });
  const [killSwitchBusy, setKillSwitchBusy] = useState(false);

  const loadPauseState = useCallback(async () => {
    try {
      const res = await apiGet<{ data: PauseState }>("/runtime/execution/status");
      setPauseState(res.data);
    } catch { /* silent */ }
  }, []);

  const toggleKillSwitch = useCallback(async () => {
    setKillSwitchBusy(true);
    try {
      if (pauseState.paused) {
        await apiPost("/runtime/execution/resume", {});
      } else {
        await apiPost("/runtime/execution/pause", { reason: "관리자 수동 정지" });
      }
      await loadPauseState();
    } catch { /* silent */ }
    finally { setKillSwitchBusy(false); }
  }, [pauseState.paused, loadPauseState]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (toolFilter) params.set("toolName", toolFilter);
      const res = await apiGet<{ data: AuditEntry[] }>(`/runtime/audit?${params}`);
      let items = res.data ?? [];
      if (statusFilter) items = items.filter((e) => e.execution.status === statusFilter);
      setEntries(items);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [toolFilter, statusFilter]);

  useEffect(() => { void load(); void loadPauseState(); }, [load, loadPauseState]);

  useWorldStream((event) => {
    if (event.type.startsWith("tool_")) void load();
  });

  const uniqueTools = [...new Set(entries.map((e) => e.execution.tool_name))].sort();

  return (
    <AppShell>
      <div style={{ padding: "1.5rem", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ color: "#e8e8e8", fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>실행 감사 로그</h1>
            <p style={{ color: "#888", fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
              모든 툴 실행 이벤트 — 클릭하면 리플레이 가능
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {pauseState.paused && (
              <span style={{ fontSize: "0.75rem", color: "#e67700", background: "#e6770022", border: "1px solid #e6770044", borderRadius: 6, padding: "0.25rem 0.6rem" }}>
                ⛔ 실행 정지 중
              </span>
            )}
            <button
              onClick={() => void toggleKillSwitch()}
              disabled={killSwitchBusy}
              style={{
                background: pauseState.paused ? "#2f9e44" : "#c92a2a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0.4rem 0.9rem",
                cursor: killSwitchBusy ? "wait" : "pointer",
                fontSize: "0.82rem",
                fontWeight: 600,
                opacity: killSwitchBusy ? 0.6 : 1,
              }}
            >
              {pauseState.paused ? "▶ 실행 재개" : "⛔ 긴급 정지"}
            </button>
            <button
              onClick={() => void load()}
              style={{ background: "#2c2c3e", color: "#ccc", border: "1px solid #444", borderRadius: 8, padding: "0.4rem 0.9rem", cursor: "pointer", fontSize: "0.82rem" }}
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 필터 */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
          <select
            value={toolFilter}
            onChange={(e) => setToolFilter(e.target.value)}
            style={{ background: "#1a1a2e", color: "#ccc", border: "1px solid #333", borderRadius: 8, padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}
          >
            <option value="">전체 툴</option>
            {uniqueTools.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ background: "#1a1a2e", color: "#ccc", border: "1px solid #333", borderRadius: 8, padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}
          >
            <option value="">전체 상태</option>
            <option value="executed">executed</option>
            <option value="denied">denied</option>
            <option value="approval_required">approval_required</option>
            <option value="failed">failed</option>
          </select>
          <span style={{ color: "#888", fontSize: "0.82rem", alignSelf: "center" }}>
            {entries.length}건
          </span>
        </div>

        {loading && <p style={{ color: "#888" }}>로딩 중...</p>}

        {!loading && entries.length === 0 && (
          <div style={{
            textAlign: "center", padding: "4rem 2rem",
            background: "#111", borderRadius: 16, border: "1px solid #222",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📋</div>
            <p style={{ color: "#888", margin: 0 }}>실행 기록이 없습니다.</p>
            <p style={{ color: "#555", fontSize: "0.82rem", margin: "0.5rem 0 0" }}>
              툴이 실행되면 여기에 감사 로그가 쌓입니다.
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => {
                const traceId = entry.execution.trace_id;
                if (traceId) setReplayTraceId(traceId);
              }}
              style={{
                background: "#111", borderRadius: 10,
                border: "1px solid #222",
                padding: "0.75rem 1rem",
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                gap: "0.75rem", alignItems: "center",
                cursor: entry.execution.trace_id ? "pointer" : "default",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => { if (entry.execution.trace_id) (e.currentTarget as HTMLElement).style.borderColor = "#444"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#222"; }}
            >
              <div>
                <div style={{ color: "#e8e8e8", fontWeight: 600, fontSize: "0.88rem" }}>
                  {entry.execution.tool_name}
                </div>
                <div style={{ color: "#555", fontSize: "0.72rem", marginTop: 2 }}>
                  {entry.execution.requested_by_character_id} · {new Date(entry.recordedAt).toLocaleString("ko-KR")}
                </div>
              </div>
              {entry.execution.risk_level && (
                <Badge label={entry.execution.risk_level} color={RISK_COLOR[entry.execution.risk_level] ?? "#868e96"} />
              )}
              <Badge
                label={entry.execution.status}
                color={STATUS_COLOR[entry.execution.status] ?? "#868e96"}
              />
              {entry.execution.trace_id && (
                <span style={{ color: "#555", fontSize: "0.72rem" }}>▶ 리플레이</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {replayTraceId && (
        <ReplayModal traceId={replayTraceId} onClose={() => setReplayTraceId(null)} />
      )}
    </AppShell>
  );
}
