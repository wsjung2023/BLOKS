---
title: P3 Local-First Profile - File-Level Priority Breakdown
priority: HIGH
owner: TBD
status: IN_PROGRESS
---

## What this ticket means

This is a code-change execution map by file path.
It answers:

1. Which files must be changed first
2. Why each file is prioritized
3. What "done" means per file group

## Current Reality Status (2026-05-21)

1. Wave 0-3 foundations are implemented in large part.
2. Wave 4 local-first completion remains the top blocker.
3. Wave 5-7 have meaningful progress but still lack full release-grade evidence.
4. Canonical progress/evidence tracking moved to [P3 Implementation Truth Board](./P3-implementation-truth-board.md).

## Priority Wave 0 - Contract Lock (must start first)

### Files

1. `packages/shared/src/contracts.ts`
2. `packages/shared/src/enums/event-type.ts`
3. `apps/api/src/routes/stream.ts`

### Why first

1. Runtime, API, worker, and web must share one execution event contract.
2. Without this lock, all downstream implementation risks rework.

### Done criteria

1. `ToolRequested/ToolPolicyEvaluated/ToolApprovalRequested/ToolApproved/ToolDenied/ToolExecuted/ToolFailed/ToolAuditPersisted` event types are canonical.
2. Stream route can publish and validate these events consistently.

## Priority Wave 1 - Runtime Core Package Skeleton

### New files to add

1. `packages/agent-runtime/package.json`
2. `packages/agent-runtime/tsconfig.json`
3. `packages/agent-runtime/src/index.ts`
4. `packages/agent-runtime/src/execution-bus.ts`
5. `packages/agent-runtime/src/tool-registry.ts`
6. `packages/agent-runtime/src/runtime-engine.ts`
7. `packages/policy-engine/package.json`
8. `packages/policy-engine/src/index.ts`
9. `packages/policy-engine/src/risk-classifier.ts`
10. `packages/policy-engine/src/policy-evaluator.ts`
11. `packages/audit/package.json`
12. `packages/audit/src/index.ts`
13. `packages/audit/src/audit-writer.ts`

### Why now

1. Worker/API cannot integrate local-first runtime before these packages exist.
2. This wave creates implementation boundaries and test seams.

### Done criteria

1. Packages build in monorepo.
2. Runtime engine can accept a tool call, evaluate policy, and emit lifecycle events (mock execution allowed at this wave).

## Priority Wave 2 - Worker Integration Path

### Files

1. `apps/worker/src/handlers.ts`
2. `apps/worker/src/orchestrator.ts`
3. `apps/worker/src/tick-engine.ts`
4. `apps/worker/src/index.ts`

### Why now

1. Existing `ai-actions` path is the current action execution center.
2. Replacing text-only completion flow with runtime-backed execution starts here.

### Done criteria

1. `ai-actions` can invoke runtime engine.
2. Task state changes are driven by runtime lifecycle outcomes.
3. Worker retries/idempotency still work after integration.

## Priority Wave 3 - API Runtime/Approval Surface

### Files

1. `apps/api/src/index.ts`
2. `apps/api/src/routes/jobs.ts`
3. `apps/api/src/routes/approvals.ts`
4. `apps/api/src/routes/stream.ts`
5. `apps/api/src/queues/registry.ts`
6. `apps/api/src/routes/runtime.ts` (new)
7. `apps/api/src/routes/runtime-approvals.ts` (new)
8. `apps/api/src/routes/runtime-audit.ts` (new)

### Why now

1. User-visible control and approval requires API contracts.
2. Web and CLI cannot consume runtime controls without these routes.

### Done criteria

1. Runtime execution request endpoint works with policy/approval flow.
2. Approval decision endpoint updates execution state.
3. Audit query endpoint returns full lifecycle chain.

## Priority Wave 4 - Local-First Storage/Queue Profile

### Files

1. `packages/db/src/index.ts`
2. `packages/db/src/supabase.ts`
3. `apps/api/src/index.ts`
4. `apps/worker/src/index.ts`
5. `apps/runtime-daemon/src/index.ts` (new)
6. `apps/runtime-daemon/package.json` (new)
7. `apps/runtime-daemon/tsconfig.json` (new)

### Why now

1. This is the core requirement: run baseline mode without mandatory external setup.
2. Must introduce profile switch and local adapters.

### Done criteria

1. Local-first mode starts with bundled/local profile.
2. Connected mode still works without regression.
3. Profile switch is explicit and test-covered.

## Priority Wave 5 - Web World + Approval UX Sync

### Files

1. `apps/web/src/lib/useWorldStream.ts`
2. `apps/web/src/components/world/IsometricWorldCanvas.tsx`
3. `apps/web/src/lib/apiClient.ts`
4. `apps/web/src/app/approvals/page.tsx`
5. `apps/web/src/app/world/page.tsx`
6. `apps/web/src/components/layout/AppShell.tsx`

### Why now

1. Users must see runtime states clearly.
2. Approval decisions must be understandable to non-technical users.

### Done criteria

1. All runtime lifecycle events are visible in world/timeline.
2. Approval UX can approve/deny risky actions with context.
3. Event/audit state mismatch issues are resolved.

## Priority Wave 6 - Installer/CLI/Doctor

### Files

1. `tools/cli/package.json` (new)
2. `tools/cli/src/index.ts` (new)
3. `tools/cli/src/commands/init.ts` (new)
4. `tools/cli/src/commands/start.ts` (new)
5. `tools/cli/src/commands/doctor.ts` (new)
6. `tools/cli/src/commands/upgrade.ts` (new)
7. `package.json` (root scripts/workspace wiring)

### Why now

1. Product promise to general users depends on one-command onboarding.
2. Operations and support quality depends on diagnostics path.

### Done criteria

1. `npx ... init/start/doctor/upgrade` flow works on clean machine tests.
2. Local-first default mode can bootstrap from CLI without manual infra setup.

## Priority Wave 7 - Hardening And Test Expansion

### Files

1. `apps/worker/src/handlers.test.ts`
2. `apps/api/src/routes/*.test.ts` (existing and new runtime tests)
3. `apps/web/e2e/*.spec.ts`
4. `docs/runbooks/incident-response.md`
5. `docs/skillsets/BLOKS-OS-COMPLETE/06-release-gates.md`

### Why now

1. GA gates cannot pass without evidence.
2. Stability and security must be validated under realistic failure paths.

### Done criteria

1. Release gate metrics are measurable and passing.
2. Incident and recovery runbooks are validated.

## Execution note

Never skip earlier waves unless contracts and dependencies are already satisfied.
