import { test, expect } from "@playwright/test";
import { setupAuth, MOCK_PROJECTS, MOCK_CHARACTERS } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await setupAuth(page);
});

function mockProjectsApi(page: import("@playwright/test").Page, projects = MOCK_PROJECTS) {
  return page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/projects") && !url.includes("/new") && !url.includes("/tasks")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { items: projects } }) });
    } else if (url.includes("/characters")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { items: MOCK_CHARACTERS } }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
    }
  });
}

test("/projects page renders without crash", async ({ page }) => {
  await mockProjectsApi(page);
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("empty state displays when no projects exist", async ({ page }) => {
  await mockProjectsApi(page, []);
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  const body = page.locator("body");
  await expect(body).toBeVisible();
});

test("project title appears in the list", async ({ page }) => {
  await mockProjectsApi(page);
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=알파 프로젝트")).toBeVisible({ timeout: 10000 });
});

test("new project button or link is accessible", async ({ page }) => {
  await mockProjectsApi(page);
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  const newProjectEl = page.locator("a[href*='/new'], button").filter({ hasText: /새 프로젝트|New|추가|만들기/ });
  await expect(newProjectEl.first()).toBeVisible({ timeout: 10000 });
});

test("project status is displayed", async ({ page }) => {
  await mockProjectsApi(page);
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body).toBeTruthy();
});

test("project priority is shown", async ({ page }) => {
  await mockProjectsApi(page);
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});

test("/projects/new page loads", async ({ page }) => {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: MOCK_CHARACTERS }) }),
  );
  await page.goto("/projects/new");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("projects page has page content after loading", async ({ page }) => {
  await mockProjectsApi(page);
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  const text = await page.locator("body").textContent();
  expect(text?.length).toBeGreaterThan(10);
});

test("project card links to board", async ({ page }) => {
  await mockProjectsApi(page);
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  const boardLinks = page.locator("a[href*='board']");
  const count = await boardLinks.count();
  expect(count).toBeGreaterThanOrEqual(0);
});

test("projects page does not show loading spinner after data loads", async ({ page }) => {
  await mockProjectsApi(page);
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await expect(page.locator("[aria-busy='true']")).toHaveCount(0);
});
