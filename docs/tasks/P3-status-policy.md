---
title: P3 Status Policy (Evidence-First)
priority: HIGH
owner: TBD
status: ACTIVE
---

## Purpose

Prevent false completion claims and force evidence-based progress reporting.

## Allowed Status Values

1. `NOT_STARTED`: no meaningful implementation work exists.
2. `IN_PROGRESS`: implementation started but core DoD is not met.
3. `PARTIAL`: substantial implementation exists, but one or more release-critical DoD items are not met.
4. `BLOCKED`: cannot proceed due to unmet dependency or critical unresolved risk.
5. `DONE`: all DoD items are satisfied with verifiable evidence.

## Non-Negotiable Rules

1. `DONE` is forbidden without explicit evidence links in the same ticket.
2. "Code exists" is not enough for `DONE`; behavior must be proven by tests or reproducible run logs.
3. If any gate in `docs/skillsets/BLOKS-OS-COMPLETE/06-release-gates.md` is open, related phase cannot be `DONE`.
4. "Deferred", "Untested", or "Pending sign-off" means the relevant phase is not `DONE`.
5. Any ambiguity defaults to `PARTIAL`, not `DONE`.

## Required Evidence Block Template (for DONE transition)

Add this section before changing status to `DONE`:

1. `Date`: YYYY-MM-DD
2. `Owner`: person/agent
3. `Evidence`:
4. command output summary (test/build/doctor/install)
5. clean-machine verification notes (OS matrix if required)
6. file references to changed implementation paths
7. known risks: explicitly `none` or listed with reason why non-blocking

## Escalation Rule

If a ticket is marked `DONE` without evidence, immediately downgrade to `PARTIAL` and log missing proof in the ticket.
