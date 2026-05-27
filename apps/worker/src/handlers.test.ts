import { describe, expect, it, vi, beforeEach } from "vitest";
import { QUEUE_NAMES } from "@bloks/shared";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("ioredis", () => {
  const Redis = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    disconnect: vi.fn(),
  }));
  return { default: Redis };
});

const mockDb = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
  then: undefined as unknown,
};

vi.mock("@bloks/db", () => ({
  getDb: vi.fn(() => mockDb),
  getRuntimeProfile: vi.fn(() => "local"),
}));

vi.mock("@bloks/memory", () => ({
  buildMemoryContext: vi.fn().mockResolvedValue({ contextBlock: "", memoryCount: 0, tokenEstimate: 0 }),
  createMemory: vi.fn().mockResolvedValue(undefined),
  deriveMemorySummary: vi.fn().mockResolvedValue(""),
}));

const mockRuntimeExecute = vi.fn();
vi.mock("@bloks/agent-runtime", () => ({
  globalRuntimeEngine: { execute: mockRuntimeExecute },
  globalExecutionBus: { subscribe: vi.fn(), publish: vi.fn() },
  AuditWriter: vi.fn().mockImplementation(() => ({})),
  RuntimeEngine: vi.fn().mockImplementation(() => ({ execute: mockRuntimeExecute })),
}));

vi.mock("@bloks/ai-router", () => ({
  routeAI: vi.fn().mockResolvedValue({ output: "test output", modelUsed: "gpt-4o-mini", tokensUsed: 100, costUsd: 0.001 }),
  TASK_TEMPLATES: {},
}));

vi.mock("./tools.js", () => ({}));

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("runQueueHandler dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: task not found → handler throws early (but dispatch still routes correctly)
    mockDb.single.mockResolvedValue({ data: null, error: { message: "not found" } });
  });

  it("routes ai-actions to processAiActions (throws when task not found)", async () => {
    const { runQueueHandler } = await import("./handlers.js");

    await expect(
      runQueueHandler(QUEUE_NAMES.aiActions, {
        queueName: QUEUE_NAMES.aiActions,
        payload: { input: { taskId: "task_missing" } },
      }),
    ).rejects.toThrow("ai-actions: task task_missing not found");
  });

  it("routes ai-actions: throws when taskId is missing", async () => {
    const { runQueueHandler } = await import("./handlers.js");

    await expect(
      runQueueHandler(QUEUE_NAMES.aiActions, {
        queueName: QUEUE_NAMES.aiActions,
        payload: { input: {} },
      }),
    ).rejects.toThrow("ai-actions: taskId is required");
  });

  it("routes approvals to processApprovals (throws when approvalId missing)", async () => {
    const { runQueueHandler } = await import("./handlers.js");

    await expect(
      runQueueHandler(QUEUE_NAMES.approvals, {
        queueName: QUEUE_NAMES.approvals,
        payload: { input: {} },
      }),
    ).rejects.toThrow();
  });

  it("returns ok when task found and runtime allows", async () => {
    mockDb.single
      .mockResolvedValueOnce({ data: { id: "task_1", title: "Test Task", description: "", task_type: "document", state: "InProgress", assignee_character_id: "char_1", project_id: "proj_1", reviewer_character_id: null, feedback_history: null, revision_count: 0 }, error: null })
      .mockResolvedValueOnce({ data: { name: "Arch", code_name: "ARCH", persona_summary: "A tech architect" }, error: null })
      .mockResolvedValueOnce({ data: { workload_score: 50, fatigue_score: 30, burnout_triggered: false, activity_status: "Working" }, error: null })
      .mockResolvedValue({ data: null, error: null });

    mockRuntimeExecute.mockResolvedValue({
      status: "executed",
      output: { output: "Generated content", modelUsed: "gpt-4o-mini", tokensUsed: 200, costUsd: 0.002 },
    });

    const { runQueueHandler } = await import("./handlers.js");

    const result = await runQueueHandler(QUEUE_NAMES.aiActions, {
      queueName: QUEUE_NAMES.aiActions,
      payload: { input: { taskId: "task_1", characterId: "char_1" } },
    });

    expect(result.ok).toBe(true);
    expect(result.handler).toBe(QUEUE_NAMES.aiActions);
    expect(result.summary).toMatch(/AI task done/);
    expect(mockRuntimeExecute).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: "ai.task.execute" }),
    );
  });

  it("throws when runtime engine denies execution", async () => {
    mockDb.single
      .mockResolvedValueOnce({ data: { id: "task_1", title: "Test", description: "", task_type: "document", state: "InProgress", assignee_character_id: "char_1", project_id: "proj_1", reviewer_character_id: null, feedback_history: null, revision_count: 0 }, error: null })
      .mockResolvedValueOnce({ data: { name: "Arch", code_name: "ARCH", persona_summary: "" }, error: null })
      .mockResolvedValue({ data: null, error: null });

    mockRuntimeExecute.mockResolvedValue({
      status: "denied",
      errorMessage: "policy: L3 tool is denied",
    });

    const { runQueueHandler } = await import("./handlers.js");

    await expect(
      runQueueHandler(QUEUE_NAMES.aiActions, {
        queueName: QUEUE_NAMES.aiActions,
        payload: { input: { taskId: "task_1", characterId: "char_1" } },
      }),
    ).rejects.toThrow("ai-actions: runtime denied or failed");
  });
});
