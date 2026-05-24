# SKILLSET: BLOKS OS Complete

## Objective

Build BLOKS as a complete product (not MVP):

1. Visual agent company interface like DeskRPG
2. Embedded OpenClaw-class runtime (no external OpenClaw dependency)
3. Local-first distribution model that general users can run immediately

## User requirement lock

1. No mandatory new paid tools beyond optional model APIs.
2. No mandatory external signup for baseline local mode.
3. One-command install plus setup wizard must be the default path.

## Operating rules

1. No phase can start without defined exit criteria.
2. Runtime execution and policy engine are release blockers.
3. All privileged actions must pass `policy -> approval -> execute -> audit`.
4. UI state must be fed from a single execution event bus.
5. No hidden/manual ops in release flow.
6. Every major decision must answer: "Can a non-technical user install this in 10 minutes?"

## Required completion definition

1. Autonomous coding workflow works end-to-end (plan, edit, test, commit, PR prep).
2. File/shell/git/process/browser operations are policy-controlled.
3. Full audit trace exists for every tool action.
4. Installer/doctor/upgrade CLI works on Windows, macOS, Linux.
5. Local-first mode runs without mandatory Supabase/Redis setup by user.
6. 30-day beta run with zero unresolved critical incidents.

## Reality lock

1. Planning docs are not evidence of completion by themselves.
2. Progress status must follow `docs/tasks/P3-status-policy.md`.
3. Actual implementation state is tracked in `docs/tasks/P3-implementation-truth-board.md`.

## Execution sequence

1. [01-product-charter.md](./01-product-charter.md)
2. [02-system-architecture.md](./02-system-architecture.md)
3. [03-runtime-and-tools.md](./03-runtime-and-tools.md)
4. [04-delivery-roadmap.md](./04-delivery-roadmap.md)
5. [05-security-and-governance.md](./05-security-and-governance.md)
6. [06-release-gates.md](./06-release-gates.md)
7. [07-deployment-and-distribution.md](./07-deployment-and-distribution.md)
8. [08-workboard-template.md](./08-workboard-template.md)
9. [09-local-first-methodology.md](./09-local-first-methodology.md)
10. [10-onboarding-playbook.md](./10-onboarding-playbook.md)
