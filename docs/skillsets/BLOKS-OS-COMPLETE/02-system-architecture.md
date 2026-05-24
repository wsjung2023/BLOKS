# 02. System Architecture

## High-level topology

1. `apps/web`: world UI, approval center, execution timeline
2. `apps/api`: auth, policy APIs, runtime control APIs, audit query APIs
3. `apps/worker`: queue handlers, orchestration, state transitions
4. `apps/runtime-daemon` (new): local machine control runtime
5. `packages/agent-runtime` (new): agent loop and tool execution contract
6. `packages/policy-engine` (new): risk and permission decisions
7. `packages/audit` (new): append-only action trail and hash chain

## Runtime profiles

1. `Local-first profile` (default): bundled local DB, bundled local queue, local runtime daemon.
2. `Connected profile` (optional): Supabase/Redis/API providers for team scale.
3. `Hybrid profile` (optional): local execution with remote coordination.

## Critical design rules

1. Single event source for UI and logs: `Execution Bus`
2. Runtime is producer, UI is consumer
3. Every tool call has deterministic lifecycle states
4. Every action has idempotency key
5. Every profile must implement identical tool lifecycle events

## Core event model

1. `ToolRequested`
2. `ToolPolicyEvaluated`
3. `ToolApprovalRequested`
4. `ToolApproved` or `ToolDenied`
5. `ToolExecuted` or `ToolFailed`
6. `ToolAuditPersisted`

## Data boundaries

1. Local profile storage: `SQLite (or local Postgres bundle)` + local audit append log.
2. Connected profile storage: Supabase/Postgres for domain and audits.
3. Queue/event layer: embedded queue in local profile, Redis/BullMQ in connected profile.
4. Runtime local store: ephemeral session cache only.

## Failure model

1. Queue replay via outbox relay
2. Idempotent handler execution
3. Retry with capped backoff
4. Dead-letter classification by error type
5. Local profile fallback when remote dependencies are unavailable
