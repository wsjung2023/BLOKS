import { describe, expect, it, vi } from "vitest";

const { getSupabaseMock } = vi.hoisted(() => ({ getSupabaseMock: vi.fn() }));
const { writeEventLogMock } = vi.hoisted(() => ({ writeEventLogMock: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@bloks/db", () => ({ getSupabase: getSupabaseMock }));
vi.mock("./tasks-helpers.js", () => ({ writeEventLog: writeEventLogMock }));

import { approvalsRouter } from "./approvals.js";

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

function findPostHandler(path: string) {
  const layer = (approvalsRouter as any).stack.find((l: any) => l.route?.path === path && l.route?.methods?.post);
  if (!layer) throw new Error(`POST ${path} not found`);
  return layer.route.stack[0].handle as (req: any, res: any) => Promise<void>;
}

describe("approvals action routes", () => {
  it("POST /:id/reject returns 422 when reason/comment missing", async () => {
    const handler = findPostHandler("/:id/reject");
    const req = { params: { id: "approval_1" }, body: {} };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect((res.body as any).ok).toBe(false);
  });

  it("POST /:id/approve returns ok true on happy path", async () => {
    let approvalsCall = 0;

    const sb = {
      from: vi.fn((table: string) => {
        if (table === "approvals") {
          approvalsCall += 1;
          if (approvalsCall === 1) {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "approval_1",
                      state: "WaitingL1",
                      entity_type: "task",
                      entity_id: "task_1",
                      approval_level: "L1",
                      project_id: "proj_1",
                      task_id: "task_1",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "approval_1", state: "Approved" }, error: null }),
                }),
              }),
            }),
          };
        }

        if (table === "tasks") {
          return {
            update: () => ({
              eq: async () => ({ data: null, error: null }),
            }),
          };
        }

        throw new Error(`unexpected table: ${table}`);
      }),
    };

    getSupabaseMock.mockReturnValue(sb);

    const handler = findPostHandler("/:id/approve");
    const req = {
      params: { id: "approval_1" },
      body: { comment: "ok" },
      auth: { sub: "char_founder" },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.body as any).ok).toBe(true);
    expect(writeEventLogMock).toHaveBeenCalled();
  });
});
