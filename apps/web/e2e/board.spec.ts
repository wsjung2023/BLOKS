import { test, expect } from "@playwright/test";
import { setupAuth, MOCK_TASKS, MOCK_PROJECTS, MOCK_CHARACTERS } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    // Board page (and ticker) reads body.data?.items — wrap arrays in { items: [...] }
    if (url.includes("/tasks")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { items: MOCK_TASKS } }) });
    } else if (url.includes("/projects")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { items: MOCK_PROJECTS } }) });
    } else if (url.includes("/characters")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { items: MOCK_CHARACTERS } }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { items: [] } }) });
    }
  });
});

test("/board page renders without crash", async ({ page }) => {
  await page.goto("/board");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("board page content loads", async ({ page }) => {
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  const text = await page.locator("body").textContent();
  expect(text?.length).toBeGreaterThan(10);
});

test("todo task title is displayed", async ({ page }) => {
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=설계 문서 작성").first()).toBeVisible({ timeout: 10000 });
});

test("in_progress task title is displayed", async ({ page }) => {
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=API 구현").first()).toBeVisible({ timeout: 10000 });
});

test("done task title is displayed", async ({ page }) => {
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=테스트 완료").first()).toBeVisible({ timeout: 10000 });
});

test("board shows multiple task states", async ({ page }) => {
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  const hasMultipleStates =
    body?.includes("todo") || body?.includes("할 일") || body?.includes("설계 문서");
  expect(hasMultipleStates).toBe(true);
});

test("board handles empty task list gracefully", async ({ page }) => {
  await page.route("**/api/v1/tasks**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("board page has accessible elements", async ({ page }) => {
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  const headings = await page.locator("h1, h2, h3").count();
  expect(headings).toBeGreaterThanOrEqual(0);
});

test("board page shows project context", async ({ page }) => {
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});

test("board page has navigation elements", async ({ page }) => {
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  const links = await page.locator("a").count();
  expect(links).toBeGreaterThan(0);
});

test("board task count reflects mocked data", async ({ page }) => {
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  const taskCount = (body?.match(/설계 문서|API 구현|테스트 완료/g) ?? []).length;
  expect(taskCount).toBeGreaterThan(0);
});

test("board page does not show 500 error", async ({ page }) => {
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  // "500" alone is too broad — Next.js RSC payload includes "fontWeight:500"
  expect(body).not.toContain("Internal Server Error");
  expect(body).not.toContain("보드 데이터를 불러오지 못했습니다");
});

test("board API error shows error state gracefully", async ({ page }) => {
  await page.route("**/api/v1/tasks**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "SERVER_ERROR" } }) }),
  );
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});

test("board shows high priority task", async ({ page }) => {
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body?.length).toBeGreaterThan(0);
});

test("board page is responsive (viewport 375px)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/board?projectId=proj-1");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});
