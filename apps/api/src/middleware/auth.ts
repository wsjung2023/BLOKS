// JWT auth middleware stub — verifies Bearer token, attaches requester to request
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthPayload {
  sub: string;
  role: "founder" | "system";
  iat?: number;
  exp?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEV_BYPASS_TOKEN = "dev-bypass";
const JWT_SECRET = process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"] ?? "";

// ── Middleware ────────────────────────────────────────────────────────────────

export function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "인증 토큰이 필요합니다." },
    });
    return;
  }

  const token = authHeader.slice(7);

  // Dev bypass — only in non-production
  if (token === DEV_BYPASS_TOKEN && process.env["NODE_ENV"] !== "production") {
    req.auth = { sub: "founder-dev", role: "founder" };
    next();
    return;
  }

  if (!JWT_SECRET) {
    console.warn("[Auth] JWT_SECRET / SESSION_SECRET env var is not set — all requests will fail auth.");
    res.status(500).json({
      ok: false,
      error: { code: "SERVER_CONFIG_ERROR", message: "인증 설정이 올바르지 않습니다." },
    });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.auth = payload;
    next();
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    res.status(401).json({
      ok: false,
      error: {
        code: isExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
        message: isExpired ? "토큰이 만료되었습니다." : "유효하지 않은 토큰입니다.",
      },
    });
  }
}
