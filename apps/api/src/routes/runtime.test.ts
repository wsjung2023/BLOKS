import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRuntimeExecute = vi.fn();
const mockApproveExecution = vi.fn();
const mockGetAuditLog = vi.fn();
const mockIsExecutionPaused = vi.fn().mockReturnValue(false);
const mockGetExecutionPauseState = vi.fn().mockReturnValue({ paused: false, pausedAt: null, reason: null });
const mockPauseExecution = vi.fn();
const mockResumeExecution = vi.fn();

vi.mock("../runtime-store.js", () => ({
  apiRuntimeEngine: {
    execute: mockRuntimeExecute,
    approveExecution: mockApproveExecution,
  },
  pendingExecutions: new Map(),
  getAuditLog: mockGetAuditLog,
  isExecutionPaused: mockIsExecutionPaused,
  getExecutionPauseState: mockGetExecutionPauseState,
  pauseExecution: mockPauseExecution,
  resumeExecution: mockResumeExecution,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
  return res;
}

function findHandler(router: any, path: string, method: "get" | "post") {
  const layer = router.stack.find((l: any) => l.route?.path === path && l.route?.methods?.[method]);
  if (!layer) throw new Error(`route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle as (req: any, res: any, next: any) => Promise<void>;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /runtime/execute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when toolName is missing", async () => {
    const { runtimeRouter } = await import("./runtime.js");
    const handler = findHandler(runtimeRouter, "/execute", "post");
    const req = { body: { characterId: "char_1" } };
    const res = createRes();

    await handler(req, res, vi.fn());

    expect(res.statusCode).toBe(400);
    expect((res.body as any).ok).toBe(false);
  });

  it("returns 400 when characterId is missing", async () => {
    const { runtimeRouter } = await import("./runtime.js");
    const handler = findHandler(runtimeRouter, "/execute", "post");
    const req = { body: { toolName: "file.read" } };
    const res = createRes();

    await handler(req, res, vi.fn());

    expect(res.statusCode).toBe(400);
  });

  it("returns execute result when runtime allows", async () => {
    mockRuntimeExecute.mockResolvedValue({ status: "executed", output: { content: "hello" } });

    const { runtimeRouter } = await import("./runtime.js");
    const handler = findHandler(runtimeRouter, "/execute", "post");
    const req = { body: { toolName: "file.read", characterId: "char_1", input: { path: "/tmp/test.txt" } } };
    const res = createRes();

    await handler(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect((res.body as any).ok).toBe(true);
    expect((res.body as any).data.status).toBe("executed");
    expect(mockRuntimeExecute).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: "file.read", requestedByCharacterId: "char_1" }),
    );
  });

  it("returns approval_required status without throwing", async () => {
    mockRuntimeExecute.mockResolvedValue({ status: "approval_required", executionId: "exec_123" });

    const { runtimeRouter } = await import("./runtime.js");
    const handler = findHandler(runtimeRouter, "/execute", "post");
    const req = { body: { toolName: "shell.exec", characterId: "char_1", input: { command: "ls" } } };
    const res = createRes();

    await handler(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.status).toBe("approval_required");
  });
});

describe("GET /runtime/audit", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeAuditEntry(id: string, toolName: string) {
    return {
      id,
      eventType: "tool.executed",
      recordedAt: new Date().toISOString(),
      execution: {
        id,
        tool_name: toolName,
        requested_by_character_id: "char_1",
        status: "executed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
  }

  it("returns audit log entries", async () => {
    mockGetAuditLog.mockReturnValue([makeAuditEntry("audit_1", "file.read")]);

    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/", "get");
    const req = { query: {} };
    const res = createRes();

    await handler(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect((res.body as any).ok).toBe(true);
    expect((res.body as any).data).toHaveLength(1);
  });

  it("filters by toolName query param", async () => {
    mockGetAuditLog.mockReturnValue([
      makeAuditEntry("audit_1", "file.read"),
      makeAuditEntry("audit_2", "shell.exec"),
    ]);

    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/", "get");
    const req = { query: { toolName: "file.read" } };
    const res = createRes();

    await handler(req, res, vi.fn());

    const items = (res.body as any).data as any[];
    expect(items).toHaveLength(1);
    expect(items[0].execution.tool_name).toBe("file.read");
  });
});

// ── Kill switch toggle ─────────────────────────────────────────────────────────

describe("Kill switch — pause / status / resume", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /execution/status — 정지 해제 상태 반환", async () => {
    mockGetExecutionPauseState.mockReturnValue({ paused: false, pausedAt: null, reason: null });
    const { runtimeRouter } = await import("./runtime.js");
    const handler = findHandler(runtimeRouter, "/execution/status", "get");
    const res = createRes();
    await handler({}, res, vi.fn());
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.paused).toBe(false);
  });

  it("POST /execution/pause — pauseExecution 호출 후 paused:true 반환", async () => {
    const pausedAt = new Date().toISOString();
    mockGetExecutionPauseState.mockReturnValue({ paused: true, pausedAt, reason: "보안 점검" });
    const { runtimeRouter } = await import("./runtime.js");
    const layer = runtimeRouter.stack.find(
      (l: any) => l.route?.path === "/execution/pause" && l.route?.methods?.post,
    );
    if (!layer) throw new Error("route not found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const route = (layer as any).route;
    const handler = route.stack[route.stack.length - 1].handle;
    const res = createRes();
    await handler({ body: { reason: "보안 점검" } } as any, res, vi.fn());
    expect(mockPauseExecution).toHaveBeenCalledWith("보안 점검");
    expect((res.body as any).data.paused).toBe(true);
    expect((res.body as any).data.reason).toBe("보안 점검");
  });

  it("POST /execution/pause — reason 생략 시 기본값 사용", async () => {
    mockGetExecutionPauseState.mockReturnValue({ paused: true, pausedAt: new Date().toISOString(), reason: "관리자 긴급 정지" });
    const { runtimeRouter } = await import("./runtime.js");
    const layer = runtimeRouter.stack.find(
      (l: any) => l.route?.path === "/execution/pause" && l.route?.methods?.post,
    );
    if (!layer) throw new Error("route not found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const route2 = (layer as any).route;
    const handler = route2.stack[route2.stack.length - 1].handle;
    const res = createRes();
    await handler({ body: {} } as any, res, vi.fn());
    expect(mockPauseExecution).toHaveBeenCalledWith("관리자 긴급 정지");
  });

  it("POST /execution/resume — resumeExecution 호출 후 paused:false 반환", async () => {
    const { runtimeRouter } = await import("./runtime.js");
    const layer = runtimeRouter.stack.find(
      (l: any) => l.route?.path === "/execution/resume" && l.route?.methods?.post,
    );
    if (!layer) throw new Error("route not found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const route3 = (layer as any).route;
    const handler = route3.stack[route3.stack.length - 1].handle;
    const res = createRes();
    await handler({} as any, res, vi.fn());
    expect(mockResumeExecution).toHaveBeenCalled();
    expect((res.body as any).data.paused).toBe(false);
  });

  it("POST /execute — 정지 상태에서 503 반환", async () => {
    mockIsExecutionPaused.mockReturnValue(true);
    mockGetExecutionPauseState.mockReturnValue({
      paused: true,
      pausedAt: new Date().toISOString(),
      reason: "보안 인시던트",
    });
    const { runtimeRouter } = await import("./runtime.js");
    const handler = findHandler(runtimeRouter, "/execute", "post");
    const res = createRes();
    await handler({ body: { toolName: "file.read", characterId: "char_1" } }, res, vi.fn());
    expect(res.statusCode).toBe(503);
    expect((res.body as any).error.code).toBe("EXECUTION_PAUSED");
    expect(mockRuntimeExecute).not.toHaveBeenCalled();
  });
});
