import { describe, expect, it } from "vitest";
import { QUEUE_NAMES } from "@bloks/shared";
import { runQueueHandler } from "./handlers.js";

describe("runQueueHandler", () => {
  it("dispatches ai-actions queue handler", async () => {
    const result = await runQueueHandler(QUEUE_NAMES.aiActions, {
      queueName: QUEUE_NAMES.aiActions,
      payload: { input: { taskId: "task_1" } },
    });

    expect(result.ok).toBe(true);
    expect(result.handler).toBe(QUEUE_NAMES.aiActions);
    expect(result.summary).toBe("ai action processed");
  });

  it("dispatches approvals queue handler", async () => {
    const result = await runQueueHandler(QUEUE_NAMES.approvals, {
      queueName: QUEUE_NAMES.approvals,
      payload: { input: { approvalId: "appr_1" } },
    });

    expect(result.ok).toBe(true);
    expect(result.handler).toBe(QUEUE_NAMES.approvals);
    expect(result.summary).toBe("approval pipeline processed");
  });
});
