import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));

vi.mock("@bloks/db", () => ({ getDb: getDbMock }));

import { worldRouter } from "./world.js";

function makeChain<T extends object>(result: T) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
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

function findGetHandler(path: string) {
  const layer = (worldRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.get
  );
  if (!layer) throw new Error(`GET ${path} not found`);
  return layer.route.stack[0].handle as (req: any, res: any) => Promise<void>;
}

describe("GET /world/snapshot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok + characters array + total + generatedAt", async () => {
    const charData = [
      {
        id: "char_1",
        name: "Nova",
        code_name: "nova",
        active_mode: "Work",
        active_flag: true,
        division_id: "div_1",
        divisions: { division_type: "Engineering" },
        character_runtime_states: [
          {
            activity_status: "Working",
            workload_score: 75,
            fatigue_score: 30,
            burnout_triggered: false,
            updated_at: new Date().toISOString(),
          },
        ],
      },
    ];

    const chain = makeChain({ data: charData, error: null });
    getDbMock.mockReturnValue({ from: vi.fn(() => chain) });

    const handler = findGetHandler("/snapshot");
    const res = createRes();
    await handler({}, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as any;
    expect(body.ok).toBe(true);
    expect(body.data.total).toBe(1);
    expect(typeof body.data.generatedAt).toBe("string");

    const char = body.data.characters[0];
    expect(char).toMatchObject({
      id: "char_1",
      name: "Nova",
      code_name: "nova",
      active_mode: "Work",
      activity_status: "Working",
      workload_score: 75,
      fatigue_score: 30,
      burnout_triggered: false,
    });
  });

  it("returns empty array when no characters", async () => {
    const chain = makeChain({ data: [], error: null });
    getDbMock.mockReturnValue({ from: vi.fn(() => chain) });

    const handler = findGetHandler("/snapshot");
    const res = createRes();
    await handler({}, res);

    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.total).toBe(0);
    expect((res.body as any).data.characters).toEqual([]);
  });

  it("returns 500 with DB_ERROR when DB returns error", async () => {
    const chain = makeChain({ data: null, error: { message: "connection refused" } });
    getDbMock.mockReturnValue({ from: vi.fn(() => chain) });

    const handler = findGetHandler("/snapshot");
    const res = createRes();
    await handler({}, res);

    expect(res.statusCode).toBe(500);
    const body = res.body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DB_ERROR");
  });
});
