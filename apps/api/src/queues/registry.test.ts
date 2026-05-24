import { describe, expect, it } from "vitest";
import { ID_PREFIX, QUEUE_NAMES } from "@bloks/shared";
import { buildQueueJobData, createJobId } from "./registry.js";

describe("queue registry helpers", () => {
  it("creates canonical job id with job_ prefix", () => {
    const jobId = createJobId(1711711711711, "abc123");
    expect(jobId).toBe(`${ID_PREFIX.job}1711711711711_abc123`);
  });

  it("normalizes queue payload data", () => {
    const queuedAt = "2026-03-29T00:00:00.000Z";

    const data = buildQueueJobData(
      {
        queueName: QUEUE_NAMES.aiActions,
        payload: { companyId: "company_1", input: { taskId: "task_1" } },
      },
      queuedAt,
    );

    expect(data).toEqual({
      queueName: QUEUE_NAMES.aiActions,
      payload: { companyId: "company_1", input: { taskId: "task_1" } },
      requestedByCharacterId: null,
      queuedAt,
      traceId: null,
      idempotencyKey: null,
    });
  });
});
