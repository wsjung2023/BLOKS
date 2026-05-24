/**
 * W3C traceparent 파싱 + traceId 전파 미들웨어
 *
 * 형식: 00-{32hex traceId}-{16hex spanId}-{8bit flags}
 * ref: https://www.w3.org/TR/trace-context/
 *
 * OTel SDK 없이 traceId를 req → job payload → event_logs 까지 전파한다.
 */
import type { Request, Response, NextFunction } from "express";

const TRACEPARENT_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i;

export interface TracingLocals {
  traceId: string;
  spanId: string;
  traceparent: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      traceId: string;
      spanId: string;
    }
  }
}

function newSpanId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function newTraceId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function tracingMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = (req.headers["traceparent"] as string | undefined)?.trim();
  const match = header ? TRACEPARENT_RE.exec(header) : null;

  if (match) {
    req.traceId = match[1]!;
    req.spanId = newSpanId();
  } else {
    // Fall back to x-trace-id or generate new
    const existing = (req.headers["x-trace-id"] as string | undefined)?.trim();
    req.traceId = existing ?? newTraceId();
    req.spanId = newSpanId();
  }

  req.headers["x-request-id"] = req.traceId;
  next();
}
