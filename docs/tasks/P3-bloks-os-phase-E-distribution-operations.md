---
title: P3 Phase E - Distribution And Operations (Weeks 19-22)
priority: HIGH
owner: TBD
status: PARTIAL
---

## Objective

Ship a real installable product and production-ready operational stack.

## Current Reality Status (2026-05-21)

1. Completed: CLI command skeleton exists (`init/start/doctor/upgrade`), Helm templates and runbooks exist.
2. Remaining gap: `npx bloks-os ...` product promise is not yet fully validated as public distribution path.
3. Remaining gap: clean-machine pass evidence across Windows/macOS/Linux is incomplete.
4. Remaining gap: upgrade/rollback flow evidence is partial and not fully automated.
5. Exit evidence required before `DONE`: reproducible install/distribution test matrix with pass logs.
6. Master tracker: [P3 Implementation Truth Board](./P3-implementation-truth-board.md).

## Scope

1. CLI install/start/doctor/upgrade flow
2. Cross-platform packaging
3. Local-first auto-provision and diagnostics
4. Optional team/cloud deployment templates

## Work Steps

1. Implement `npx bloks-os init/start/doctor/upgrade` workflows.
2. Build local dependency auto-provisioning and environment checks.
3. Implement diagnostics bundle export and guided repair actions.
4. Provide Docker Compose and Helm templates for optional deployment.
5. Finalize backup/restore, migration, and runbook docs.

## Deliverables

1. End-user install and lifecycle CLI.
2. Stable local-first default distribution.
3. Operations runbooks and deployment templates.

## Definition of Done (DoD)

1. Clean-machine install pass on Windows/macOS/Linux.
2. Local-first mode works without mandatory external services.
3. Upgrade and rollback flows are tested and documented.

## Dependencies

1. Runtime and UX completion from prior phases
2. Release gate definitions and metrics instrumentation

## Risks And Mitigation

1. Risk: install friction and environment drift.
2. Mitigation: doctor command, auto-fix paths, compatibility checks.
