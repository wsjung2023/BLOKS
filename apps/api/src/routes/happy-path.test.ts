import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseMock } = vi.hoisted(() => ({
  getSupabaseMock: vi.fn(),
}));

vi.mock("@bloks/db", () => ({
  getSupabase: getSupabaseMock,
}));

vi.mock("./tasks-helpers.js", () => ({
  writeEventLog: vi.fn().mockResolvedValue(undefined),
}));

import { approvalsRouter } from "./approvals.js";
import { charactersRouter } from "./characters.js";

function makeAwaitable<T extends object>(result: T) {
  const promise = Promise.resolve(result);
  const chain = {
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
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function findRouteHandler(router: typeof approvalsRouter | typeof charactersRouter, path: string, method: "get") {
  const layer = (router as any).stack.find((l: any) => l.route?.path === path && l.route?.methods?.[method]);
  if (!layer) throw new Error(`route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[0].handle as (req: any, res: any) => Promise<void>;
}

describe("api routes happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /approvals returns ok/data/items", async () => {
    const items = [{ id: "approval_1", state: "WaitingL1" }];
    const query = makeAwaitable({ data: items, count: 1, error: null });
    getSupabaseMock.mockReturnValue({ from: vi.fn(() => query) });

    const handler = findRouteHandler(approvalsRouter, "/", "get");
    const req = { query: { page: "1", pageSize: "20" } };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      data: { items, page: 1, pageSize: 20, total: 1 },
    });
  });

  it("GET /characters returns ok/data/items", async () => {
    const items = [{ id: "char_1", name: "Nova", code_name: "nova" }];
    const query = makeAwaitable({ data: items, count: 1, error: null });
    getSupabaseMock.mockReturnValue({ from: vi.fn(() => query) });

    const handler = findRouteHandler(charactersRouter, "/", "get");
    const req = { query: { page: "1", pageSize: "20" } };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      data: { items, page: 1, pageSize: 20, total: 1 },
    });
  });
});
