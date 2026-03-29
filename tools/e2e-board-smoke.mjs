#!/usr/bin/env node
import { readFileSync } from "node:fs";

const API_BASE = process.env.BLOKS_API_BASE_URL || "http://localhost:4000";
const MODE = process.env.BLOKS_BOARD_SMOKE_MODE || "fixture"; // fixture | api
const FIXTURE_PATH = process.env.BLOKS_BOARD_SMOKE_FIXTURE || "tools/fixtures/board-smoke-tasks.json";

const VALID_STATES = new Set(["Created", "Assigned", "InProgress", "PendingReview", "Blocked", "Done"]);
const VALID_PRIORITIES = new Set(["P0", "P1", "P2", "P3", "P4"]);

async function loadFromApi() {
  const res = await fetch(`${API_BASE}/api/v1/tasks?pageSize=10`, {
    headers: {
      Accept: "application/json",
      Authorization: "Bearer dev-local-smoke",
      "x-dev-bypass-auth": "1",
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`API ${res.status}`);
  return body;
}

function loadFromFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("payload is not an object");
  const items = payload?.data?.items;
  if (!Array.isArray(items) || items.length === 0) throw new Error("items is empty");

  for (const item of items) {
    if (!item?.id || !item?.title) throw new Error("item id/title missing");
    if (!VALID_STATES.has(item.state)) throw new Error(`invalid state: ${item.state}`);
    if (!VALID_PRIORITIES.has(item.priority)) throw new Error(`invalid priority: ${item.priority}`);
  }

  return {
    count: items.length,
    states: [...new Set(items.map((i) => i.state))],
  };
}

async function main() {
  const payload = MODE === "api" ? await loadFromApi() : loadFromFixture();
  const result = validatePayload(payload);
  console.log("# Board e2e smoke");
  console.log(`- mode: ${MODE}`);
  console.log(`- items: ${result.count}`);
  console.log(`- states: ${result.states.join(", ")}`);
}

main().catch((error) => {
  console.error("[board-smoke] failed", error.message);
  process.exit(1);
});
