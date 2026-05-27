// Metrics routes — P95 latency, failure rate, cost summary, queue depth
import { Router, type Request, type Response } from "express";
import { getDb } from "@bloks/db";

export const metricsRouter = Router();

// ── GET /api/v1/metrics/p95 ───────────────────────────────────────────────────
// Returns per-path P95 latency and failure rate for the last N hours.

metricsRouter.get("/p95", async (req: Request, res: Response) => {
  const hours = Math.min(parseInt((req.query["hours"] as string) ?? "24", 10) || 24, 168);
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  try {
    const sb = getDb();
    const { data, error } = await sb
      .from("request_metrics")
      .select("path, status_code, duration_ms")
      .gte("created_at", cutoff);

    if (error) {
      return res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: error.message } });
    }

    const byPath: Record<string, { durations: number[]; total: number; failures: number }> = {};
    for (const row of data ?? []) {
      const key = row.path as string;
      if (!byPath[key]) byPath[key] = { durations: [], total: 0, failures: 0 };
      const entry = byPath[key]!;
      entry.durations.push(row.duration_ms as number);
      entry.total++;
      if ((row.status_code as number) >= 400) entry.failures++;
    }

    const results = Object.entries(byPath).map(([path, { durations, total, failures }]) => {
      durations.sort((a, b) => a - b);
      const idx = Math.ceil(durations.length * 0.95) - 1;
      return {
        path,
        p95_ms: durations[Math.max(0, idx)] ?? 0,
        failure_rate_pct: total > 0 ? Math.round((failures / total) * 100 * 10) / 10 : 0,
        total_requests: total,
      };
    });

    results.sort((a, b) => b.p95_ms - a.p95_ms);

    return res.json({ ok: true, data: { hours, results } });
  } catch (err) {
    console.error("[metrics/p95] error:", err);
    return res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR" } });
  }
});

// ── GET /api/v1/metrics/costs ─────────────────────────────────────────────────
// Returns per-project accumulated AI cost and monthly total.

metricsRouter.get("/costs", async (_req: Request, res: Response) => {
  try {
    const sb = getDb();
    const { data, error } = await sb
      .from("projects")
      .select("id, title, api_cost_accumulated, virtual_budget_allocated, state")
      .order("api_cost_accumulated", { ascending: false });

    if (error) {
      return res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: error.message } });
    }

    const projects = (data ?? []) as Array<Record<string, unknown>>;
    const totalCost = projects.reduce((sum, p) => sum + ((p["api_cost_accumulated"] as number) ?? 0), 0);

    return res.json({
      ok: true,
      data: {
        totalCostUsd: Math.round(totalCost * 10000) / 10000,
        byProject: projects.map((p) => ({
          id: p["id"],
          title: p["title"],
          costUsd: p["api_cost_accumulated"] ?? 0,
          budgetUsd: p["virtual_budget_allocated"] ?? 0,
          state: p["state"],
        })),
      },
    });
  } catch (err) {
    console.error("[metrics/costs] error:", err);
    return res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR" } });
  }
});

// ── GET /api/v1/metrics/queues ────────────────────────────────────────────────

metricsRouter.get("/queues", (_req: Request, res: Response) => {
  const QUEUE_NAMES_LIST = [
    "workflowTransitions", "aiActions", "approvals", "artifactPostprocess",
    "analyticsRollups", "notifications", "founderMessage", "orchestrate",
  ];
  const queues = QUEUE_NAMES_LIST.map((name) => ({ name, depth: 0 }));
  return res.json({ ok: true, data: { queues } });
});

// ── GET /api/v1/metrics/costs/daily ──────────────────────────────────────────
// 일별 AI 비용 집계 — event_logs의 ai.span.completed 이벤트에서 추출
// query: ?days=N (기본 30), ?projectId=...

metricsRouter.get("/costs/daily", async (req: Request, res: Response) => {
  const days = Math.min(parseInt((req.query["days"] as string) ?? "30", 10) || 30, 90);
  const projectId = (req.query["projectId"] as string | undefined) ?? null;
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();

  try {
    const sb = getDb();
    let query = sb
      .from("event_logs")
      .select("created_at, comment, related_project_id")
      .eq("event_type", "ai.span.completed")
      .gte("created_at", cutoff);

    if (projectId) query = query.eq("related_project_id", projectId);

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: error.message } });
    }

    const byDay: Record<string, { costUsd: number; tokensUsed: number; calls: number }> = {};
    for (const row of data ?? []) {
      const day = (row.created_at as string).slice(0, 10);
      if (!byDay[day]) byDay[day] = { costUsd: 0, tokensUsed: 0, calls: 0 };
      const entry = byDay[day]!;
      try {
        const span = JSON.parse((row.comment as string) ?? "{}") as Record<string, number>;
        entry.costUsd += span["costUsd"] ?? 0;
        entry.tokensUsed += span["tokensUsed"] ?? 0;
        entry.calls++;
      } catch { /* ignore malformed rows */ }
    }

    const sorted = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v, costUsd: Math.round(v.costUsd * 100000) / 100000 }));

    const todayKey = new Date().toISOString().slice(0, 10);
    const todayCost = byDay[todayKey]?.costUsd ?? 0;
    const dailyLimitUsd = parseFloat(process.env["AI_MAX_DAILY_COST_USD"] ?? "5");

    return res.json({
      ok: true,
      data: {
        days: sorted,
        today: { costUsd: todayCost, limitUsd: dailyLimitUsd, exceeded: todayCost >= dailyLimitUsd },
      },
    });
  } catch (err) {
    console.error("[metrics/costs/daily] error:", err);
    return res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR" } });
  }
});

// ── GET /api/v1/metrics/costs/characters ─────────────────────────────────────
// 캐릭터별 AI 비용 TOP-N

metricsRouter.get("/costs/characters", async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query["limit"] as string) ?? "10", 10) || 10, 50);
  const days = Math.min(parseInt((req.query["days"] as string) ?? "30", 10) || 30, 90);
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();

  try {
    const sb = getDb();
    const { data, error } = await sb
      .from("event_logs")
      .select("changed_by, comment")
      .eq("event_type", "ai.span.completed")
      .gte("created_at", cutoff);

    if (error) {
      return res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: error.message } });
    }

    const byChar: Record<string, { costUsd: number; tokensUsed: number; calls: number }> = {};
    for (const row of data ?? []) {
      const charId = (row.changed_by as string)?.replace("worker:ai-actions:", "") ?? "unknown";
      if (!byChar[charId]) byChar[charId] = { costUsd: 0, tokensUsed: 0, calls: 0 };
      const entry = byChar[charId]!;
      try {
        const span = JSON.parse((row.comment as string) ?? "{}") as Record<string, number>;
        entry.costUsd += span["costUsd"] ?? 0;
        entry.tokensUsed += span["tokensUsed"] ?? 0;
        entry.calls++;
      } catch { /* ignore malformed rows */ }
    }

    const sorted = Object.entries(byChar)
      .map(([characterId, v]) => ({ characterId, ...v, costUsd: Math.round(v.costUsd * 100000) / 100000 }))
      .sort((a, b) => b.costUsd - a.costUsd)
      .slice(0, limit);

    return res.json({ ok: true, data: { characters: sorted, periodDays: days } });
  } catch (err) {
    console.error("[metrics/costs/characters] error:", err);
    return res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR" } });
  }
});

// ── POST /api/v1/metrics/report/trigger ──────────────────────────────────────
// Manually trigger monthly report generation for a given year/month.

metricsRouter.post("/report/trigger", async (req: Request, res: Response) => {
  const now = new Date();
  const year = parseInt((req.body as Record<string, string>)["year"] ?? String(now.getUTCFullYear()), 10);
  const month = parseInt((req.body as Record<string, string>)["month"] ?? String(now.getUTCMonth() + 1), 10);

  if (year < 2024 || year > 2100 || month < 1 || month > 12) {
    return res.status(400).json({ ok: false, error: { code: "INVALID_PARAMS", message: "year/month 범위 오류" } });
  }

  try {
    const { enqueueJob } = await import("../queues/registry.js");
    const { QUEUE_NAMES } = await import("@bloks/shared");
    await enqueueJob({
      queueName: QUEUE_NAMES.monthlyReport,
      payload: { input: { year, month } },
      idempotencyKey: `monthly-report-${year}-${month}`,
    });
    return res.json({ ok: true, data: { queued: true, year, month } });
  } catch (err) {
    console.error("[metrics/report/trigger] error:", err);
    return res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR" } });
  }
});
