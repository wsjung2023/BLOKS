---
title: P3 BLOKS OS Program Index (Complete Product, Local-First)
priority: HIGH
owner: TBD
status: IN_PROGRESS
---

## Objective

Track the execution program for a complete "Company RPG + OpenClerk" product with local-first constraints:

1. No mandatory new paid tool
2. No mandatory external signup for baseline mode
3. One-command install and setup wizard for general users

## Active Source Documents (Only These 5)

1. [P3 Company RPG + OpenClerk Master Plan](./P3-company-rpg-openclerk-master-plan-2026-05-25.md)
2. [P3 Implementation Truth Board](./P3-implementation-truth-board.md)
3. [P3 Status Policy](./P3-status-policy.md)
4. [P3 Claude Handoff Prompt](./P3-claude-handoff-prompt.md)
5. [P3 BLOKS OS Program Index](./P3-bloks-os-program-index.md)

## Program Tracks

1. Track A: Reality audit and truthful status control
2. Track B: Local-first runtime completion (first task end-to-end)
3. Track C: World UX completion as operational command center
4. Track D: Capability packs (research/marketing/dev/pc/media/erp/abap)
5. Track E: Distribution and clean-machine install proof
6. Track F: Security hardening and GA gate closeout

## Global Program Gates

1. Local-first profile runs without mandatory Supabase/Redis user setup
2. Installer flow works on Windows/macOS/Linux
3. First install to first task completion <= 10 minutes (median)
4. Full tool action audit trail is queryable and exportable
5. 30-day beta with zero unresolved critical incidents

## Reality Status (2026-05-21)

1. Declared `DONE` values across P3 tickets were reset to evidence-based statuses.
2. Current state is not GA complete; core runtime exists, but local-first and release gates are incomplete.
3. Canonical execution board: [P3 Implementation Truth Board](./P3-implementation-truth-board.md).
4. Status governance rule: [P3 Status Policy](./P3-status-policy.md).

## Execution Update (2026-05-25)

1. Track B: local-first first-task acceptance automated and passing (`pnpm acceptance:local-first`).
2. Track C: runtime-daemon audit persistence + replay/export/verify endpoints implemented and acceptance passing (`pnpm acceptance:runtime-daemon-audit`).
3. Track D: required capability-pack contract registry added with acceptance checks (`pnpm acceptance:capability-packs`).
4. Track D: runnable capability-pack generators added and executable (`pnpm capability-packs:run-all`), with demo-report-backed artifact generation.
5. Track E: clean-install checker implemented (`tools/clean-install-check.mjs`) and passing in workspace mode (`--no-clone`).
6. Track E: cross-OS clean-machine CI workflow added (`.github/workflows/clean-install-matrix.yml`) — run artifacts pending.
7. Track E: CLI distribution smoke added (`pnpm distribution:cli-smoke`) and passing in current workspace.
8. Track F: GA gate automation added (`pnpm gate:ga`, `.github/workflows/ga-gate.yml`) and passing in current workspace.

## Control Rule

1. If a document/link is missing, do not reference it as mandatory.
2. If evidence is missing, status must remain `PARTIAL` or `BLOCKED`.
