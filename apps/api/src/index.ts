// API server entry — Express with CORS, JSON body, auth middleware, and route registration
import express from "express";
import cors from "cors";
import { authenticateRequest } from "./middleware/auth.js";
import { charactersRouter } from "./routes/characters.js";
import { tasksRouter } from "./routes/tasks.js";
import { projectsRouter } from "./routes/projects.js";
import { approvalsRouter } from "./routes/approvals.js";

const PORT = process.env["PORT"] ?? "4000";
const ALLOWED_ORIGINS = (process.env["ALLOWED_ORIGINS"] ?? "http://localhost:3000").split(",");

const app = express();

// ── Global middleware ─────────────────────────────────────────────────────────

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

app.use((req, _res, next) => {
  const reqId = (req.headers["x-request-id"] as string | undefined) ?? crypto.randomUUID();
  req.headers["x-request-id"] = reqId;
  next();
});

// ── Health endpoint (no auth) ─────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    data: {
      status: "healthy",
      service: "bloks-api",
      version: process.env["npm_package_version"] ?? "0.1.0",
      ts: new Date().toISOString(),
    },
  });
});

// ── Protected routes ──────────────────────────────────────────────────────────

app.use("/characters", authenticateRequest, charactersRouter);
app.use("/tasks",      authenticateRequest, tasksRouter);
app.use("/projects",   authenticateRequest, projectsRouter);
app.use("/approvals",  authenticateRequest, approvalsRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    error: { code: "NOT_FOUND", message: "요청한 리소스를 찾을 수 없습니다." },
  });
});

// ── Error handler ─────────────────────────────────────────────────────────────

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

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(Number(PORT), () => {
  console.log(`[BLOKS API] http://localhost:${PORT} (${process.env["NODE_ENV"] ?? "development"})`);
});

export default app;
