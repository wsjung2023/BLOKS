// API server entry ??Express /api/v1 router with CORS, logging, Supabase init
import express from "express";
import cors from "cors";
import { authenticateRequest } from "./middleware/auth.js";
import { charactersRouter } from "./routes/characters.js";
import { tasksRouter } from "./routes/tasks.js";
import { projectsRouter } from "./routes/projects.js";
import { approvalsRouter } from "./routes/approvals.js";
import { artifactsRouter } from "./routes/artifacts.js";
import { eventsRouter } from "./routes/events.js";
import { jobsRouter } from "./routes/jobs.js";
import { getSupabase } from "@bloks/db";

const PORT = process.env["PORT"] ?? process.env["API_PORT"] ?? "4000";
const ALLOWED_ORIGINS = (process.env["ALLOWED_ORIGINS"] ?? "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003").split(",");

const app = express();

// ?? Global middleware ?????????????????????????????????????????????????????????

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

// Request ID injection
app.use((req, _res, next) => {
  const reqId = (req.headers["x-request-id"] as string | undefined) ?? crypto.randomUUID();
  req.headers["x-request-id"] = reqId;
  next();
});

// Request logging ??method + path + ms
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[API] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ?? Health endpoint (no auth) ?????????????????????????????????????????????????

app.get("/health", (_req, res) => {
  let dbStatus = "unknown";
  try {
    getSupabase();
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

// ?? Protected /api/v1 routes ??????????????????????????????????????????????????

const v1 = express.Router();
v1.use(authenticateRequest);

v1.use("/characters", charactersRouter);
v1.use("/tasks", tasksRouter);
v1.use("/projects", projectsRouter);
v1.use("/approvals", approvalsRouter);
v1.use("/artifacts", artifactsRouter);
v1.use("/events", eventsRouter);
v1.use("/jobs", jobsRouter);

app.use("/api/v1", v1);

// ?? 404 handler ???????????????????????????????????????????????????????????????

app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    error: { code: "NOT_FOUND", message: "?붿껌??由ъ냼?ㅻ? 李얠쓣 ???놁뒿?덈떎." },
  });
});

// ?? Global error handler ??????????????????????????????????????????????????????

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
        message: "?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.",
        ...(isDev ? { details: { message: err.message } } : {}),
      },
    });
  }
);

// ?? Start ?????????????????????????????????????????????????????????????????????

app.listen(Number(PORT), () => {
  console.log(`[BLOKS API] http://localhost:${PORT} (${process.env["NODE_ENV"] ?? "development"})`);
  // Eagerly validate Supabase connection
  try {
    getSupabase();
    console.log("[BLOKS API] Supabase client initialized");
  } catch (err) {
    console.error("[BLOKS API] Supabase init failed:", err);
  }
});

export default app;
