import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const DEMO_STATE_PATH = path.resolve(__dirname, "../../tools/demo/reports/.current-demo.json");
const SCREENSHOTS_DIR = path.resolve(__dirname, "../../tools/demo/reports/screenshots");

interface DemoState {
  scenario: string;
  projectId: string;
  projectTitle: string;
  characters: Array<{ name: string; codeName: string }>;
  startedAt: string;
}

function loadDemoState(): DemoState | null {
  if (!existsSync(DEMO_STATE_PATH)) return null;
  return JSON.parse(readFileSync(DEMO_STATE_PATH, "utf8")) as DemoState;
}

// Playwright auth bypass: set BLOKS_AUTH_TOKEN in localStorage
async function setupAuth(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("BLOKS_AUTH_TOKEN", "dev-bypass");
  });
}

test("capture board and world screenshots during scenario", async ({ page }) => {
  const state = loadDemoState();
  if (!state) {
    console.log("No demo state found — run pnpm demo:* first");
    test.skip();
    return;
  }

  const { projectId, projectTitle, scenario } = state;
  console.log(`Capturing scenario: ${scenario} — ${projectTitle}`);

  await page.setExtraHTTPHeaders({ "x-dev-bypass-auth": "1" });
  await setupAuth(page);

  // ── 1. Board initial state ─────────────────────────────────────────────────
  await page.goto(`/board?projectId=${projectId}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/board-initial.png`,
    fullPage: false,
  });
  console.log("  ✓ board-initial.png");

  // ── 2. World canvas ────────────────────────────────────────────────────────
  await page.goto("/world");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000); // allow Phaser canvas to render
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/world-working.png`,
    fullPage: false,
  });
  console.log("  ✓ world-working.png");

  // ── 3. Board in-progress ──────────────────────────────────────────────────
  await page.goto(`/board?projectId=${projectId}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/board-in-progress.png`,
    fullPage: false,
  });
  console.log("  ✓ board-in-progress.png");

  // ── 4. Analytics ──────────────────────────────────────────────────────────
  await page.goto("/analytics");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/analytics.png`,
    fullPage: false,
  });
  console.log("  ✓ analytics.png");
});

test("capture board final state (run after scenario completes)", async ({ page }) => {
  const state = loadDemoState();
  if (!state) {
    test.skip();
    return;
  }

  await page.setExtraHTTPHeaders({ "x-dev-bypass-auth": "1" });
  await setupAuth(page);

  await page.goto(`/board?projectId=${state.projectId}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/board-done.png`,
    fullPage: false,
  });
  console.log("  ✓ board-done.png");
});
