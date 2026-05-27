import { describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
const { writeEventLogMock } = vi.hoisted(() => ({ writeEventLogMock: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@bloks/db", () => ({ getDb: getDbMock }));
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
            // First call: fetch the approval record for validation
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "approval_1",
                      state: "Pending",         // current DB state value
                      target_type: "task",       // actual column name
                      target_id: "task_1",       // actual column name
                      required_level: "L1",      // actual column name
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          // Second call: update the approval to Approved
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
          // Handles both select (for chain logic) and update (mark Done)
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { priority: "P4", ai_output: null, assignee_character_id: "char_1" },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ data: null, error: null }),
            }),
          };
        }

        throw new Error(`unexpected table: ${table}`);
      }),
    };

    getDbMock.mockReturnValue(sb);

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
