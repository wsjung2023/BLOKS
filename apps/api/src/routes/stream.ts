// SSE stream — broadcasts world events to all connected clients
import { Router, type Request, type Response } from "express";
import { getRuntimeProfile } from "@bloks/db";

export const WORLD_EVENTS_CHANNEL = "world:events";

export const streamRouter = Router();

// ── Client registry ────────────────────────────────────────────────────────────

const clients = new Set<Response>();

export interface WorldEvent {
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
    | "character_flags_updated"
    | "character_message"
    | "founder_override"
    | "world_tick"
    | "agent_message"
    | "workflow_stage"
    | "character_levelup"
    // ── Tool execution lifecycle (BLOKS OS runtime) ──────────────────────────
    | "tool_requested"
    | "tool_policy_evaluated"
    | "tool_approval_requested"
    | "tool_approved"
    | "tool_denied"
    | "tool_executed"
    | "tool_failed"
    | "tool_audit_persisted";
  payload: Record<string, unknown>;
  timestamp: string;
}

export function emitWorldEvent(
  type: WorldEvent["type"],
  payload: WorldEvent["payload"],
) {
  if (clients.size === 0) return;
  const data = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  const dead: Response[] = [];
  for (const res of clients) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {
      dead.push(res);
    }
  }
  for (const res of dead) clients.delete(res);
}

// Heartbeat every 25s to prevent proxy timeouts
const heartbeatInterval = setInterval(
  () => emitWorldEvent("heartbeat", { clients: clients.size }),
  25_000,
);
heartbeatInterval.unref();

// ── Redis subscriber (connected mode only) ────────────────────────────────────
// In local mode SSE still works for in-process emits; no Redis needed.

if (getRuntimeProfile() === "connected") {
  import("ioredis").then(({ default: Redis }) => {
    const redisSub = new Redis({
      host: process.env["REDIS_HOST"] ?? "127.0.0.1",
      port: Number(process.env["REDIS_PORT"] ?? 6379),
      password: process.env["REDIS_PASSWORD"] || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    redisSub.connect().catch(() => {});
    redisSub.subscribe(WORLD_EVENTS_CHANNEL).catch((err: Error) => {
      console.warn("[stream] Redis subscribe failed:", err.message);
    });
    redisSub.on("message", (_channel: string, message: string) => {
      try {
        const { type, payload } = JSON.parse(message) as WorldEvent;
        emitWorldEvent(type, payload);
      } catch { /* ignore malformed frames */ }
    });
  }).catch(() => {});
}

// ── GET /api/v1/stream ─────────────────────────────────────────────────────────

streamRouter.get("/", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering
  res.flushHeaders();

  clients.add(res);

  // Send immediate connection confirmation
  const hello: WorldEvent = {
    type: "connected",
    payload: { clientCount: clients.size },
    timestamp: new Date().toISOString(),
  };
  res.write(`data: ${JSON.stringify(hello)}\n\n`);

  req.on("close", () => {
    clients.delete(res);
  });
});

// ── GET /api/v1/stream/status (debug) ─────────────────────────────────────────

streamRouter.get("/status", (_req: Request, res: Response) => {
  res.json({ ok: true, data: { connectedClients: clients.size } });
});
