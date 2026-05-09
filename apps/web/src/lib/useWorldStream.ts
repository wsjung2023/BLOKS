"use client";
import { useEffect, useRef, useCallback } from "react";
import { getApiBase } from "./apiBase";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RuntimePatch {
  activity_status?: string;
  workload_score?: number;
  fatigue_score?: number;
  burnout_triggered?: boolean;
  current_task_count?: number;
}

export interface WorldStreamEvent {
  type:
    | "connected"
    | "heartbeat"
    | "runtime_update"
    | "task_assigned"
    | "task_state_changed"
    | "approval_resolved"
    | "character_status"
    | "character_moved"
    | "character_bubble"
    | "world_tick";
  payload: Record<string, unknown>;
  timestamp: string;
}

export type WorldStreamHandler = (event: WorldStreamEvent) => void;

// ── Hook ──────────────────────────────────────────────────────────────────────

const SSE_URL = getApiBase().replace(/\/api\/v1\/?$/, "") + "/api/v1/stream";

export function useWorldStream(onEvent: WorldStreamHandler) {
  const esRef = useRef<EventSource | null>(null);
  const retryDelayRef = useRef(1_000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the handler ref stable so reconnect doesn't trigger on every render
  const handlerRef = useRef<WorldStreamHandler>(onEvent);
  useEffect(() => { handlerRef.current = onEvent; });

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();

    const es = new EventSource(SSE_URL);
    esRef.current = es;

    es.onopen = () => {
      retryDelayRef.current = 1_000; // reset backoff on success
    };

    es.onmessage = (ev: MessageEvent<string>) => {
      try {
        const event = JSON.parse(ev.data) as WorldStreamEvent;
        if (event.type !== "heartbeat") {
          handlerRef.current(event);
        }
      } catch {
        // ignore malformed frames
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      // Exponential backoff: 1s → 2s → 4s … capped at 30s
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, 30_000);
      retryTimerRef.current = setTimeout(connect, delay);
    };
  }, []); // stable — no deps

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [connect]);
}

// ── Convenience: extract runtime patch from a runtime_update event ────────────

export function extractRuntimePatch(
  event: WorldStreamEvent,
): { characterId: string; patch: RuntimePatch } | null {
  if (event.type !== "runtime_update") return null;
  const { characterId, ...rest } = event.payload;
  if (typeof characterId !== "string") return null;
  return {
    characterId,
    patch: rest as RuntimePatch,
  };
}
