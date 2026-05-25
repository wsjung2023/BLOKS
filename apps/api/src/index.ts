// API server entry — Express /api/v1 router with CORS, logging, DB init
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { authenticateRequest } from "./middleware/auth.js";
import { tracingMiddleware } from "./middleware/tracing.js";
import { charactersRouter } from "./routes/characters.js";
import { tasksRouter } from "./routes/tasks.js";
import { projectsRouter } from "./routes/projects.js";
import { approvalsRouter } from "./routes/approvals.js";
import { artifactsRouter } from "./routes/artifacts.js";
import { eventsRouter } from "./routes/events.js";
import { jobsRouter } from "./routes/jobs.js";
import { promptsRouter } from "./routes/prompts.js";
import { memoriesRouter } from "./routes/memories.js";
import { authRouter } from "./routes/auth.js";
import { streamRouter } from "./routes/stream.js";
import { agentMessagesRouter } from "./routes/agent-messages.js";
import { worldRouter } from "./routes/world.js";
import { metricsRouter } from "./routes/metrics.js";
import { runtimeRouter } from "./routes/runtime.js";
import { runtimeApprovalsRouter } from "./routes/runtime-approvals.js";
import { runtimeAuditRouter } from "./routes/runtime-audit.js";
import { getDb } from "@bloks/db";
import { startWorldTicker } from "./world-ticker.js";

// Load .env from repo root if present — works without --env-file flag
{
  const __dir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dir, "../../../.env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
      const m = line.match(/^([^#\s][^=]*)=(.*)/);
      if (m) process.env[m[1]!.trim()] ??= m[2]!.trim();
    }
  }
}

const PORT = process.env["PORT"] ?? process.env["API_PORT"] ?? "4000";
const ALLOWED_ORIGINS = (process.env["ALLOWED_ORIGINS"] ?? "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003").split(",");

const app = express();

// Global middleware

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

// W3C traceparent → traceId 전파
app.use(tracingMiddleware);

// Request logging — method + path + ms; 10% sample written to DB
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const path = req.route?.path ?? req.path;
    console.log(`[API] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    if (Math.random() < 0.1) {
      try {
        void getDb()
          .from("request_metrics")
          .insert({ method: req.method, path, status_code: res.statusCode, duration_ms: ms });
      } catch { /* non-fatal */ }
    }
  });
  next();
});

// Health endpoint (no auth)

app.get("/health", (_req, res) => {
  let dbStatus = "unknown";
  try {
    getDb();
    dbStatus = "up";
  } catch {
    dbStatus = "error";
  }

  res.json({
    ok: true,
    data: {
      api: "up",
      db: dbStatus,
      service: "bloks-api",
      version: process.env["npm_package_version"] ?? "0.1.0",
      timestamp: new Date().toISOString(),
    },
  });
});

app.get("/api/health", (_req, res) => {
  res.redirect("/health");
});

// Kubernetes liveness/readiness probe alias
app.get("/healthz", (_req, res) => {
  res.redirect("/health");
});

// Public routes (no auth)
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/stream", streamRouter);

// Protected /api/v1 routes

const v1 = express.Router();
v1.use(authenticateRequest);

v1.use("/characters", charactersRouter);
v1.use("/tasks", tasksRouter);
v1.use("/projects", projectsRouter);
v1.use("/approvals", approvalsRouter);
v1.use("/artifacts", artifactsRouter);
v1.use("/events", eventsRouter);
v1.use("/jobs", jobsRouter);
v1.use("/prompts", promptsRouter);
v1.use("/memories", memoriesRouter);
v1.use("/agent-messages", agentMessagesRouter);
v1.use("/world", worldRouter);
v1.use("/metrics", metricsRouter);
v1.use("/runtime", runtimeRouter);
v1.use("/runtime/approvals", runtimeApprovalsRouter);
v1.use("/runtime/audit", runtimeAuditRouter);

app.use("/api/v1", v1);

// 404 handler

app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    error: { code: "NOT_FOUND", message: "요청한 리소스를 찾을 수 없습니다." },
  });
});

// Global error handler

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const isDev = process.env["NODE_ENV"] !== "production";
    console.error("[API Error]", err.message);
    res.status(500).json({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 오류가 발생했습니다.",
        ...(isDev ? { details: { message: err.message } } : {}),
      },
    });
  }
);

// Start

app.listen(Number(PORT), () => {
  console.log(`[BLOKS API] http://localhost:${PORT} (${process.env["NODE_ENV"] ?? "development"})`);
  // Eagerly initialize DB client
  try {
    getDb();
    console.log("[BLOKS API] DB client initialized");
  } catch (err) {
    console.error("[BLOKS API] DB init failed:", err);
  }
  startWorldTicker();
});

export default app;
