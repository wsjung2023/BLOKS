import { QUEUE_NAMES } from "@bloks/shared";

export const queueRegistry = Object.freeze([
  QUEUE_NAMES.workflowTransitions,
  QUEUE_NAMES.aiActions,
  QUEUE_NAMES.approvals,
  QUEUE_NAMES.artifactPostprocess,
  QUEUE_NAMES.analyticsRollups,
  QUEUE_NAMES.notifications,
]);

export type QueueName = (typeof queueRegistry)[number];
