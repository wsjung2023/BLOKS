# 01. Product Charter

## Product vision

`BLOKS OS` is a visualized general-purpose agent operating system:

1. Game-like world UX for human control
2. Embedded autonomous runtime for real work execution
3. Enterprise-grade governance and auditability

## Non-negotiable goals

1. No external OpenClaw runtime dependency
2. Local-first mode with no mandatory third-party signup
3. Production reliability and recoverability
4. Human-in-the-loop control for risky actions
5. Reproducible deployments and deterministic operations

## User promises

1. Install and run locally with a single command
2. Let agents execute coding and operations safely
3. Observe all actions in real time through world visualization
4. Approve, block, replay, and audit every action

## Distribution promise

1. Baseline user path: `npx` install, setup wizard, launch app.
2. Baseline mode includes local storage and local queue runtime.
3. Optional mode lets user connect external model/API providers.
4. Team mode and cloud mode remain optional upgrades.

## Out-of-scope

1. Full no-code automation marketplace in v1 GA
2. Public plugin ecosystem moderation in v1 GA
3. Native mobile runtime control in v1 GA

## Success metrics

1. First install to first task completion <= 10 minutes
2. p95 tool dispatch latency <= 2s
3. Incident MTTR <= 15m
4. Approval bypass rate = 0
5. Tool execution success rate >= 97% (excluding policy-denied)
6. Weekly active projects sustained during 30-day beta
