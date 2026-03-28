// AppShell-ticker — BottomLiveTicker polls /tasks + /approvals every 5 s
"use client";
import { useEffect, useState } from "react";
import { apiGet } from "../../lib/apiClient";

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

async function loadEvents(): Promise<TickerEvent[]> {
  try {
    const [tr, ar] = await Promise.all([
      apiGet<{ data?: { items?: ApiItem[] } }>("/tasks?pageSize=8"),
      apiGet<{ data?: { items?: ApiItem[] } }>("/approvals?pageSize=4"),
    ]);
    const tj = tr ?? null;
    const aj = ar ?? null;
    const tasks = tj?.data?.items ?? [];
    const approvals = aj?.data?.items ?? [];
    return [
      ...tasks.slice(0, 6).map(taskToEvent),
      ...approvals.slice(0, 4).map(approvalToEvent),
    ].slice(0, 10);
  } catch {
    return [];
  }
}

// ── Level colors ──────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<string, string> = {
  info:     "var(--color-muted)",
  warn:     "var(--color-toxic-orange)",
  critical: "var(--color-toxic-red)",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function BottomLiveTicker() {
  const [events, setEvents] = useState<TickerEvent[]>([]);

  useEffect(() => {
    loadEvents().then(setEvents);
    const id = setInterval(() => loadEvents().then(setEvents), 5_000);
    return () => clearInterval(id);
  }, []);

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
      <span
        style={{
          color: "var(--color-accent)", fontWeight: 700,
          whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        ▶ LIVE
      </span>
      <div
        style={{
          display: "flex", gap: "2.5rem",
          overflow: "hidden", whiteSpace: "nowrap", flex: 1,
        }}
      >
        {events.length === 0 ? (
          <span style={{ color: "var(--color-muted)" }}>이벤트 로딩 중...</span>
        ) : (
          events.map((evt) => (
            <span key={evt.id} style={{ color: LEVEL_COLOR[evt.level], flexShrink: 0 }}>
              [{evt.ts}] {evt.text}
            </span>
          ))
        )}
      </div>
    </footer>
  );
}
