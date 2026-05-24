// Board contract tests — verify the API shapes the board page depends on
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseMock } = vi.hoisted(() => ({ getSupabaseMock: vi.fn() }));

vi.mock("@bloks/db", () => ({ getSupabase: getSupabaseMock, writeEventLog: vi.fn() }));
vi.mock("./tasks-helpers.js", () => ({
  writeEventLog: vi.fn(),
  isAllowedTransition: vi.fn(),
  reduceAssigneeWorkload: vi.fn(),
}));
vi.mock("./stream.js", () => ({ emitWorldEvent: vi.fn() }));
vi.mock("../queues/registry.js", () => ({ enqueueJob: vi.fn() }));

import { tasksRouter } from "./tasks.js";
import { charactersRouter } from "./characters.js";

const VALID_TASK_STATES = ["Created", "Assigned", "InProgress", "PendingReview", "Blocked", "Done"];

function makeChain<T extends object>(result: T) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    range: vi.fn(() => chain),
    order: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  return chain;
}

function createRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
}

function findGetHandler(router: any, path: string) {
  const layer = router.stack.find((l: any) => l.route?.path === path && l.route?.methods?.get);
  if (!layer) throw new Error(`GET ${path} not found`);
  return layer.route.stack[0].handle as (req: any, res: any) => Promise<void>;
}

describe("board contract — tasks endpoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /tasks returns items with board-required fields", async () => {
    const taskItems = [
      {
        id: "task_1",
        title: "Implement login",
        state: "InProgress",
        priority: "High",
        assignee_character_id: "char_1",
        project_id: "proj_1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const chain = makeChain({ data: taskItems, count: 1, error: null });
    getSupabaseMock.mockReturnValue({ from: vi.fn(() => chain) });

    const handler = findGetHandler(tasksRouter, "/");
    const req = { query: { page: "1", pageSize: "200" } };
    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);

    const task = body.data.items[0];
    expect(task).toHaveProperty("id");
    expect(task).toHaveProperty("title");
    expect(task).toHaveProperty("state");
    expect(task).toHaveProperty("priority");
    expect(VALID_TASK_STATES).toContain(task.state);
  });

  it("GET /tasks returns pagination metadata", async () => {
    const chain = makeChain({ data: [], count: 0, error: null });
    getSupabaseMock.mockReturnValue({ from: vi.fn(() => chain) });

    const handler = findGetHandler(tasksRouter, "/");
    const req = { query: { page: "1", pageSize: "200" } };
    const res = createRes();
    await handler(req, res);

    const body = res.body as any;
    expect(body.data).toMatchObject({ page: 1, pageSize: 200, total: 0 });
  });
});

describe("board contract — characters endpoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /characters returns items with runtime state fields", async () => {
    const charItems = [
      {
        id: "char_1",
        name: "Nova",
        code_name: "nova",
        active_mode: "Work",
        character_runtime_states: [
          {
            activity_status: "Working",
            workload_score: 60,
            fatigue_score: 25,
            burnout_triggered: false,
          },
        ],
      },
    ];
    const chain = makeChain({ data: charItems, count: 1, error: null });
    getSupabaseMock.mockReturnValue({ from: vi.fn(() => chain) });

    const handler = findGetHandler(charactersRouter, "/");
    const req = { query: { page: "1", pageSize: "100" } };
    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as any;
    expect(body.ok).toBe(true);
    const char = body.data.items[0];
    expect(char.character_runtime_states).toBeDefined();
  });
});
