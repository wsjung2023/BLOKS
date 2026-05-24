import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@bloks/simulation": resolve(root, "packages/simulation/src/index.ts"),
      "@bloks/shared": resolve(root, "packages/shared/src/index.ts"),
      "@bloks/db": resolve(root, "packages/db/src/index.ts"),
      "@bloks/ai-router": resolve(root, "packages/ai-router/src/index.ts"),
      "@bloks/agent-runtime": resolve(root, "packages/agent-runtime/src/index.ts"),
      "@bloks/policy-engine": resolve(root, "packages/policy-engine/src/index.ts"),
      "@bloks/audit": resolve(root, "packages/audit/src/index.ts"),
      "@bloks/memory": resolve(root, "packages/memory/src/index.ts"),
    },
  },
  test: {
    passWithNoTests: true,
  },
});
