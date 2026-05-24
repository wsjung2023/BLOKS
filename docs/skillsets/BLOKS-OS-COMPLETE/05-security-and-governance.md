# 05. Security And Governance

## Policy baseline

1. `deny-by-default`
2. explicit allowlist by tool and path
3. risk-tiered approvals
4. local-first secure defaults for non-technical users

## Risk tiers

1. L0: safe read-only actions, auto-allow
2. L1: low-risk write actions, pre-approved scope
3. L2: medium-risk system actions, runtime approval required
4. L3: high-risk destructive/network-sensitive actions, two-person approval

## Enforcement controls

1. Path sandbox boundaries
2. Shell command static risk checks
3. Timeout, output cap, and process limit
4. Secret masking and no-echo handling
5. Session-level permission tokens

## Local-first default policy profile

1. First run defaults to read-heavy safe mode.
2. Workspace write access is opt-in and path-scoped.
3. Network and package-install commands are approval-gated.
4. Destructive actions are blocked unless explicit override policy is active.

## Audit requirements

1. Immutable log for requested, approved, executed, failed states
2. Hash-linked event chain for tamper evidence
3. Actor and approver identity inclusion
4. Replay support with deterministic inputs

## Governance operations

1. Policy versioning with change history
2. Emergency revoke and kill switch
3. Compliance export (`jsonl`, `csv`)
4. Monthly policy drift review

## Key and provider methodology

1. Local mode can run without external provider key where local model is available.
2. External provider keys are optional and encrypted at rest.
3. Key health checks must never expose key material in logs.
