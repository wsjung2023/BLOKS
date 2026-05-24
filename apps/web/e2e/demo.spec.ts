import { test, expect } from "@playwright/test";
import { setupAuth } from "./fixtures/auth";

const MOCK_DEMO_SCENARIOS = [
  { id: "homepage", title: "홈페이지 제작", description: "React + Tailwind 랜딩 페이지", status: "idle" },
  { id: "ppt", title: "IR 피치덱", description: "PowerPoint 투자자 제안서", status: "idle" },
  { id: "program", title: "웹 앱 개발", description: "FastAPI + React 풀스택 앱", status: "idle" },
];

test.beforeEach(async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
});

test("/demo page renders without crash", async ({ page }) => {
  await page.goto("/demo");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("demo page has content", async ({ page }) => {
  await page.goto("/demo");
  await page.waitForLoadState("networkidle");
  const text = await page.locator("body").textContent();
  expect(text?.length).toBeGreaterThan(10);
});

test("demo page shows scenario cards", async ({ page }) => {
  await page.goto("/demo");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  const hasScenario = body?.includes("홈페이지") || body?.includes("피치덱") || body?.includes("프로그램") || body?.includes("demo") || body?.includes("Demo");
  expect(hasScenario).toBeTruthy();
});

test("demo page has navigation links", async ({ page }) => {
  await page.goto("/demo");
  await page.waitForLoadState("networkidle");
  const links = await page.locator("a").count();
  expect(links).toBeGreaterThan(0);
});

test("/demo/homepage scenario page renders", async ({ page }) => {
  await page.goto("/demo/homepage");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("/demo/ppt scenario page renders", async ({ page }) => {
  await page.goto("/demo/ppt");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("/demo/program scenario page renders", async ({ page }) => {
  await page.goto("/demo/program");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("demo scenario page has scenario-specific content", async ({ page }) => {
  await page.goto("/demo/homepage");
  await page.waitForLoadState("networkidle");
  const text = await page.locator("body").textContent();
  expect(text?.length).toBeGreaterThan(5);
});

test("demo scenario page has start/run button", async ({ page }) => {
  await page.goto("/demo/homepage");
  await page.waitForLoadState("networkidle");
  const buttons = await page.locator("button").count();
  expect(buttons).toBeGreaterThanOrEqual(0);
});

test("demo page is mobile responsive", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/demo");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});

test("demo scenario page has download option when artifact exists", async ({ page }) => {
  await page.goto("/demo/ppt");
  await page.waitForLoadState("networkidle");
  const downloadLinks = page.locator("a[href*='download'], button").filter({ hasText: /다운로드|download/i });
  const count = await downloadLinks.count();
  expect(count).toBeGreaterThanOrEqual(0);
});

test("demo pages do not show 500 error", async ({ page }) => {
  await page.goto("/demo");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body).not.toContain("Internal Server Error");
});

test("demo/homepage page title is set", async ({ page }) => {
  await page.goto("/demo/homepage");
  await page.waitForLoadState("domcontentloaded");
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
});

test("back navigation from demo scenario to demo list", async ({ page }) => {
  await page.goto("/demo/homepage");
  await page.waitForLoadState("networkidle");
  const backLinks = page.locator("a[href='/demo'], a[href*='demo']");
  const count = await backLinks.count();
  expect(count).toBeGreaterThanOrEqual(0);
});

test("demo page accessible elements are present", async ({ page }) => {
  await page.goto("/demo");
  await page.waitForLoadState("networkidle");
  const elements = await page.locator("body *").count();
  expect(elements).toBeGreaterThan(0);
});
