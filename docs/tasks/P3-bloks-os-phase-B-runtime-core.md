> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

---
title: P3 Phase B - Runtime Core (Weeks 4-9)
priority: HIGH
owner: TBD
status: PARTIAL
---

## Objective

Build the embedded execution kernel and local-first runtime profile.

## Current Reality Status (2026-05-21)

1. Completed: runtime/policy/audit packages and runtime API surfaces exist.
2. Completed: worker `ai-actions` path is wired to runtime execution.
3. Remaining gap (critical): local-first baseline still depends heavily on Supabase/Redis paths in API/worker.
4. Remaining gap: runtime audit persistence is still in-memory in API path.
5. Exit evidence required before `DONE`: local profile boots and executes first task without mandatory external services.
6. Master tracker: [P3 Implementation Truth Board](./P3-implementation-truth-board.md).

## Scope

1. `packages/agent-runtime` (new)
2. `packages/policy-engine` (new)
3. `packages/audit` (new)
4. `apps/runtime-daemon` (new)
5. Worker integration path for real tool execution

## Work Steps

1. Implement tool registry with schema validation and execution contracts.
2. Implement policy engine with L0-L3 risk evaluation and approval hooks.
3. Implement audit pipeline with immutable event chain output.
4. Implement tool adapters: filesystem, shell, git, process.
5. Integrate runtime calls into `apps/worker/src/handlers.ts` (`ai-actions` flow).
6. Implement local-first profile storage/queue mode for baseline operation.

## Deliverables

1. Runtime packages and daemon with tests.
2. End-to-end tool lifecycle event emission.
3. Local profile bootstrap path with no mandatory external setup.
4. API endpoints for runtime execution/approval/audit query.

## Definition of Done (DoD)

1. A task can trigger real tool execution through runtime path.
2. Policy and approval gates block unauthorized actions.
3. Audit trail records all execution states.
4. Local-first profile executes without mandatory Supabase/Redis user setup.

## Dependencies

1. Phase A frozen contracts
2. Existing queue and stream infrastructure

## Risks And Mitigation

1. Risk: unsafe command behavior.
2. Mitigation: deny-by-default, path sandboxing, timeout limits, mandatory approvals.
