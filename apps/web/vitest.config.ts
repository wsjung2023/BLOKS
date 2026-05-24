import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Exclude Playwright e2e specs — they run via playwright test, not vitest
    exclude: ["e2e/**", "**/node_modules/**"],
  },
});
