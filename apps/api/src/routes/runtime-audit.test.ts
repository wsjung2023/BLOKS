import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetAuditLog = vi.fn();
const mockVerifyChain = vi.fn();

vi.mock("../runtime-store.js", () => ({
  getAuditLog: mockGetAuditLog,
}));

vi.mock("@bloks/audit", () => ({
  verifyAuditChain: mockVerifyChain,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function createRes() {
  const state = { statusCode: 200, body: undefined as unknown, headers: {} as Record<string, string>, sent: "" };
  return {
    status(code: number) { state.statusCode = code; return this; },
    json(payload: unknown) { state.body = payload; return this; },
    setHeader(k: string, v: string) { state.headers[k] = v; return this; },
    send(data: string) { state.sent = data; return this; },
    _code: () => state.statusCode,
    _body: () => state.body,
    _header: (k: string) => state.headers[k],
    _sent: () => state.sent,
  } as any;
}

function findHandler(router: any, path: string, method: "get" | "post") {
  const layer = router.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method],
  );
  if (!layer) throw new Error(`route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle as (req: any, res: any, next: any) => void;
}

function makeEntry(id: string, toolName: string, traceId?: string, hash?: string, prevHash?: string) {
  return {
    id,
    eventType: "tool.executed",
    recordedAt: new Date().toISOString(),
    hash: hash ?? `hash-${id}`,
    prevHash: prevHash ?? "genesis",
    execution: {
      id,
      tool_name: toolName,
      requested_by_character_id: "char_1",
      status: "executed",
      risk_level: "L0",
      trace_id: traceId ?? `trace-${id}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /runtime/audit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("반환: 감사 로그 전체", async () => {
    mockGetAuditLog.mockReturnValue([makeEntry("a1", "file.read")]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/", "get");
    const res = createRes();
    handler({ query: {} }, res, vi.fn());
    expect(res._code()).toBe(200);
    expect((res._body() as any).ok).toBe(true);
    expect((res._body() as any).data).toHaveLength(1);
  });

  it("toolName 쿼리로 필터링", async () => {
    mockGetAuditLog.mockReturnValue([
      makeEntry("a1", "file.read"),
      makeEntry("a2", "shell.exec"),
    ]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/", "get");
    const res = createRes();
    handler({ query: { toolName: "file.read" } }, res, vi.fn());
    const items = (res._body() as any).data as any[];
    expect(items).toHaveLength(1);
    expect(items[0].execution.tool_name).toBe("file.read");
  });

  it("characterId 쿼리로 필터링", async () => {
    const e1 = makeEntry("a1", "file.read");
    e1.execution.requested_by_character_id = "char_x";
    const e2 = makeEntry("a2", "file.read");
    e2.execution.requested_by_character_id = "char_y";
    mockGetAuditLog.mockReturnValue([e1, e2]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/", "get");
    const res = createRes();
    handler({ query: { characterId: "char_x" } }, res, vi.fn());
    expect((res._body() as any).data).toHaveLength(1);
    expect((res._body() as any).data[0].execution.requested_by_character_id).toBe("char_x");
  });

  it("limit 쿼리 적용 (최대 200)", async () => {
    const entries = Array.from({ length: 10 }, (_, i) => makeEntry(`a${i}`, "file.read"));
    mockGetAuditLog.mockReturnValue(entries);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/", "get");
    const res = createRes();
    handler({ query: { limit: "3" } }, res, vi.fn());
    expect((res._body() as any).data).toHaveLength(3);
  });
});

describe("GET /runtime/audit/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("JSONL 형식으로 내보내기 (기본값)", async () => {
    mockGetAuditLog.mockReturnValue([makeEntry("a1", "file.read")]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/export", "get");
    const res = createRes();
    handler({ query: {} }, res, vi.fn());
    expect(res._header("Content-Type")).toContain("ndjson");
    expect(res._sent()).toContain('"file.read"');
  });

  it("CSV 형식으로 내보내기", async () => {
    mockGetAuditLog.mockReturnValue([makeEntry("a1", "file.read")]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/export", "get");
    const res = createRes();
    handler({ query: { format: "csv" } }, res, vi.fn());
    expect(res._header("Content-Type")).toContain("csv");
    const csv = res._sent();
    expect(csv).toContain("id,eventType");
    expect(csv).toContain("file.read");
  });

  it("CSV 헤더에 콤마 구분 컬럼 포함", async () => {
    mockGetAuditLog.mockReturnValue([]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/export", "get");
    const res = createRes();
    handler({ query: { format: "csv" } }, res, vi.fn());
    const firstLine = res._sent().split("\n")[0];
    expect(firstLine).toContain("toolName");
    expect(firstLine).toContain("hash");
    expect(firstLine).toContain("prevHash");
  });
});

describe("GET /runtime/audit/verify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("체인 정상일 때 valid: true 반환", async () => {
    mockGetAuditLog.mockReturnValue([makeEntry("a1", "file.read")]);
    mockVerifyChain.mockReturnValue({ valid: true });
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/verify", "get");
    const res = createRes();
    handler({}, res, vi.fn());
    expect(res._code()).toBe(200);
    expect((res._body() as any).data.valid).toBe(true);
    expect((res._body() as any).data.entryCount).toBe(1);
  });

  it("체인 손상 시 valid: false + firstBrokenIndex 반환", async () => {
    mockGetAuditLog.mockReturnValue([
      makeEntry("a1", "file.read"),
      makeEntry("a2", "shell.exec"),
    ]);
    mockVerifyChain.mockReturnValue({ valid: false, firstBrokenIndex: 1 });
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/verify", "get");
    const res = createRes();
    handler({}, res, vi.fn());
    expect((res._body() as any).data.valid).toBe(false);
    expect((res._body() as any).data.firstBrokenIndex).toBe(1);
  });

  it("로그 비어있을 때 entryCount: 0", async () => {
    mockGetAuditLog.mockReturnValue([]);
    mockVerifyChain.mockReturnValue({ valid: true });
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/verify", "get");
    const res = createRes();
    handler({}, res, vi.fn());
    expect((res._body() as any).data.entryCount).toBe(0);
  });
});

describe("GET /runtime/audit/replay/:traceId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("traceId 일치 이벤트 반환", async () => {
    mockGetAuditLog.mockReturnValue([
      makeEntry("a1", "file.read", "trace-abc"),
      makeEntry("a2", "shell.exec", "trace-xyz"),
    ]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/replay/:traceId", "get");
    const res = createRes();
    handler({ params: { traceId: "trace-abc" } }, res, vi.fn());
    expect(res._code()).toBe(200);
    expect((res._body() as any).data.traceId).toBe("trace-abc");
    expect((res._body() as any).data.events).toHaveLength(1);
    expect((res._body() as any).data.toolName).toBe("file.read");
  });

  it("존재하지 않는 traceId → 404 반환", async () => {
    mockGetAuditLog.mockReturnValue([makeEntry("a1", "file.read", "trace-abc")]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/replay/:traceId", "get");
    const res = createRes();
    handler({ params: { traceId: "trace-no-exist" } }, res, vi.fn());
    expect(res._code()).toBe(404);
    expect((res._body() as any).error.code).toBe("NOT_FOUND");
  });

  it("finalStatus는 마지막 이벤트 status", async () => {
    const e1 = makeEntry("a1", "file.read", "trace-abc");
    e1.execution.status = "pending";
    const e2 = makeEntry("a2", "file.read", "trace-abc");
    e2.execution.status = "executed";
    // 시간순 정렬 보장
    e1.recordedAt = "2026-01-01T00:00:00.000Z";
    e2.recordedAt = "2026-01-01T00:00:01.000Z";
    mockGetAuditLog.mockReturnValue([e2, e1]); // 섞어서 전달
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/replay/:traceId", "get");
    const res = createRes();
    handler({ params: { traceId: "trace-abc" } }, res, vi.fn());
    expect((res._body() as any).data.finalStatus).toBe("executed");
  });
});

describe("GET /runtime/audit — filter 입력 보안", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toolName에 정규식 특수문자 포함해도 크래시 없음", async () => {
    mockGetAuditLog.mockReturnValue([makeEntry("a1", "file.read"), makeEntry("a2", "shell.exec")]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/", "get");
    const res = createRes();
    handler({ query: { toolName: "file.*[read]+" } }, res, vi.fn());
    expect(res._code()).toBe(200);
    expect((res._body() as any).data).toHaveLength(0); // exact match → no hit, no crash
  });

  it("limit가 음수여도 크래시 없음", async () => {
    mockGetAuditLog.mockReturnValue([makeEntry("a1", "file.read")]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/", "get");
    const res = createRes();
    handler({ query: { limit: "-1" } }, res, vi.fn());
    expect(res._code()).toBe(200);
    expect(Array.isArray((res._body() as any).data)).toBe(true);
  });

  it("limit가 숫자가 아니어도 크래시 없음", async () => {
    mockGetAuditLog.mockReturnValue([makeEntry("a1", "file.read")]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/", "get");
    const res = createRes();
    handler({ query: { limit: "not-a-number" } }, res, vi.fn());
    expect(res._code()).toBe(200);
    expect(Array.isArray((res._body() as any).data)).toBe(true);
  });

  it("characterId가 빈 문자열이면 필터 미적용 후 전체 반환", async () => {
    mockGetAuditLog.mockReturnValue([makeEntry("a1", "file.read"), makeEntry("a2", "shell.exec")]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/", "get");
    const res = createRes();
    handler({ query: { characterId: "" } }, res, vi.fn());
    expect(res._code()).toBe(200);
    expect((res._body() as any).data).toHaveLength(2);
  });
});

describe("GET /runtime/audit/export — 출력 보안", () => {
  beforeEach(() => vi.clearAllMocks());

  it("JSONL 출력: 각 줄이 파싱 가능한 JSON", async () => {
    mockGetAuditLog.mockReturnValue([makeEntry("a1", "file.read"), makeEntry("a2", "shell.exec")]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/export", "get");
    const res = createRes();
    handler({ query: {} }, res, vi.fn());
    const lines = res._sent().split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("CSV 출력: toolName에 콤마가 있으면 따옴표로 이스케이프", async () => {
    const entry = makeEntry("a1", "tool,with,commas");
    mockGetAuditLog.mockReturnValue([entry]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/export", "get");
    const res = createRes();
    handler({ query: { format: "csv" } }, res, vi.fn());
    const csv = res._sent();
    expect(csv).toContain('"tool,with,commas"');
  });

  it("알 수 없는 format은 JSONL로 폴백", async () => {
    mockGetAuditLog.mockReturnValue([makeEntry("a1", "file.read")]);
    const { runtimeAuditRouter } = await import("./runtime-audit.js");
    const handler = findHandler(runtimeAuditRouter, "/export", "get");
    const res = createRes();
    handler({ query: { format: "xml" } }, res, vi.fn());
    expect(res._header("Content-Type")).toContain("ndjson");
  });
});
