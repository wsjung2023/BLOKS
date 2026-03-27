import { QUEUE_NAMES } from "@bloks/shared";

console.log("[worker] bootstrap", {
  queues: Object.values(QUEUE_NAMES),
  now: new Date().toISOString(),
});
