import type { Page } from "@playwright/test";

export async function setupAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("BLOKS_AUTH_TOKEN", "dev-bypass");
  });
  await page.setExtraHTTPHeaders({ "x-dev-bypass-auth": "1" });
}

export const API_BASE = "http://localhost:4000/api/v1";

export const MOCK_CHARACTERS = [
  { id: "char-1", name: "아크", code_name: "ARCH", department: "engineering", active_flag: true, location_zone: "desk", ai_enabled: false },
  { id: "char-2", name: "글리치", code_name: "GLITCH", department: "engineering", active_flag: true, location_zone: "desk", ai_enabled: false },
];

export const MOCK_PROJECTS = [
  { id: "proj-1", title: "알파 프로젝트", state: "active", priority: "high", brief: "핵심 기능 구현", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
];

export const MOCK_TASKS = [
  { id: "task-1", title: "설계 문서 작성", state: "Todo", priority: "high", project_id: "proj-1", assignee_character_id: "char-1" },
  { id: "task-2", title: "API 구현", state: "InProgress", priority: "medium", project_id: "proj-1", assignee_character_id: "char-2" },
  { id: "task-3", title: "테스트 완료", state: "Done", priority: "low", project_id: "proj-1" },
];

export const MOCK_APPROVALS = [
  { id: "exec-1", tool_name: "file.write", risk_level: "L2", status: "pending_approval", input: { path: "/src/index.ts" }, requested_by_character_id: "char-1", requested_at: "2026-01-01T00:00:00Z" },
  { id: "exec-2", tool_name: "shell.exec", risk_level: "L3", status: "denied", input: { command: "rm -rf" }, requested_by_character_id: "char-2", requested_at: "2026-01-01T00:00:00Z" },
];

export const MOCK_AUDIT = [
  { id: "audit-1", eventType: "tool.executed", recordedAt: "2026-01-01T00:00:00Z", hash: "abc123", prevHash: "genesis", execution: { id: "exec-1", tool_name: "file.read", requested_by_character_id: "char-1", status: "executed", risk_level: "L0", trace_id: "trace-1", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } },
];
