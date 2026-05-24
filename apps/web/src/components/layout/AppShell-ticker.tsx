// AppShell-ticker — BottomLiveTicker: 폴링(태스크/결재) + SSE 실시간 툴 이벤트
"use client";
import { useEffect, useRef, useState } from "react";
import { apiGet } from "../../lib/apiClient";
import { useWorldStream, type WorldStreamEvent } from "../../lib/useWorldStream";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TickerEvent {
  id: string;
  text: string;
  ts: string;
  level: "info" | "warn" | "critical";
}

type ApiItem = Record<string, unknown>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTime(val: unknown): string {
  try {
    return new Date(String(val ?? "")).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--";
  }
}

function taskToEvent(t: ApiItem): TickerEvent {
  const state = String(t["state"] ?? "");
  const title = String(t["title"] ?? t["id"]);
  const level: TickerEvent["level"] =
    state === "Blocked" ? "critical"
    : state === "InReview" || state === "Overdue" ? "warn"
    : "info";
  return {
    id: `t-${String(t["id"])}`,
    text: `[태스크 / ${state}] ${title}`,
    ts: toTime(t["updated_at"]),
    level,
  };
}

function approvalToEvent(a: ApiItem): TickerEvent {
  const state = String(a["state"] ?? "");
  const title = String(a["title"] ?? a["entity_id"] ?? a["id"]);
  const isUrgent = state.includes("Founder") || state.includes("L3");
  return {
    id: `a-${String(a["id"])}`,
    text: `[결재 / ${state}] ${title}`,
    ts: toTime(a["created_at"]),
    level: isUrgent ? "critical" : "warn",
  };
}

// 툴 이벤트 → TickerEvent 변환
const TOOL_LEVEL: Record<string, TickerEvent["level"]> = {
  tool_requested: "info",
  tool_policy_evaluated: "info",
  tool_approval_requested: "critical",
  tool_approved: "info",
  tool_denied: "warn",
  tool_executed: "info",
  tool_failed: "warn",
  tool_audit_persisted: "info",
};

const TOOL_LABEL: Record<string, string> = {
  tool_requested: "요청",
  tool_policy_evaluated: "정책검토",
  tool_approval_requested: "⚠ 승인필요",
  tool_approved: "승인됨",
  tool_denied: "차단됨",
  tool_executed: "실행완료",
  tool_failed: "실패",
  tool_audit_persisted: "감사기록",
};

function toolEventToTicker(event: WorldStreamEvent): TickerEvent | null {
  if (!event.type.startsWith("tool_")) return null;
  const execution = (event.payload as { execution?: Record<string, unknown> })?.execution;
  if (!execution) return null;
  const toolName = String(execution["tool_name"] ?? "?");
  const label = TOOL_LABEL[event.type] ?? event.type;
  return {
    id: `tool-${String(execution["id"] ?? Date.now())}-${event.type}`,
    text: `[툴/${label}] ${toolName}`,
    ts: toTime(event.timestamp),
    level: TOOL_LEVEL[event.type] ?? "info",
  };
}

async function loadPolledEvents(): Promise<TickerEvent[]> {
  try {
    const [tr, ar] = await Promise.all([
      apiGet<{ data?: { items?: ApiItem[] } }>("/tasks?pageSize=8"),
      apiGet<{ data?: { items?: ApiItem[] } }>("/approvals?pageSize=4"),
    ]);
    const tasks = tr?.data?.items ?? [];
    const approvals = ar?.data?.items ?? [];
    return [
      ...tasks.slice(0, 4).map(taskToEvent),
      ...approvals.slice(0, 3).map(approvalToEvent),
    ];
  } catch {
    return [];
  }
}

// ── Level colors ──────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<string, string> = {
  info:     "var(--color-muted)",
  warn:     "var(--color-toxic-orange)",
  critical: "#e05c5c",
};

// ── Component ─────────────────────────────────────────────────────────────────

const MAX_TOOL_EVENTS = 5;

export function BottomLiveTicker() {
  const [polledEvents, setPolledEvents] = useState<TickerEvent[]>([]);
  const [toolEvents, setToolEvents] = useState<TickerEvent[]>([]);
  const toolEventsRef = useRef<TickerEvent[]>([]);

  // 5초마다 태스크/결재 폴링
  useEffect(() => {
    loadPolledEvents().then(setPolledEvents);
    const id = setInterval(() => loadPolledEvents().then(setPolledEvents), 5_000);
    return () => clearInterval(id);
  }, []);

  // SSE 실시간 툴 이벤트
  useWorldStream((event: WorldStreamEvent) => {
    const ticker = toolEventToTicker(event);
    if (!ticker) return;
    const next = [ticker, ...toolEventsRef.current].slice(0, MAX_TOOL_EVENTS);
    toolEventsRef.current = next;
    setToolEvents([...next]);
  });

  const allEvents = [...toolEvents, ...polledEvents].slice(0, 12);

  return (
    <footer
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: "var(--ticker-h)", zIndex: 50,
        background: "#1A1510", color: "#aaa",
        display: "flex", alignItems: "center",
        padding: "0 1rem", gap: "0.75rem",
        fontSize: "0.75rem", overflow: "hidden",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span style={{ color: "var(--color-accent)", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
        ▶ LIVE
      </span>
      <div style={{ display: "flex", gap: "2.5rem", overflow: "hidden", whiteSpace: "nowrap", flex: 1 }}>
        {allEvents.length === 0 ? (
          <span style={{ color: "var(--color-muted)" }}>대기 중...</span>
        ) : (
          allEvents.map((evt) => (
            <span key={evt.id} style={{ color: LEVEL_COLOR[evt.level], flexShrink: 0 }}>
              [{evt.ts}] {evt.text}
            </span>
          ))
        )}
      </div>
    </footer>
  );
}
