# 03. Runtime And Tools

## Runtime mission

Execute real actions safely under policy control while keeping full traceability.

## Agent loop contract

1. `Plan`: derive actionable steps
2. `Act`: call tool with scoped args
3. `Observe`: parse result and side effects
4. `Replan`: continue or stop with summary

## Tool categories

1. File tools: read, write, patch, move, search
2. Shell tools: command execution with risk classification
3. Git tools: status, diff, branch, commit, push (policy-bound)
4. Process tools: start/stop/inspect local services
5. Browser/app tools: optional controlled desktop interactions

## Methodology: progressive enablement

1. Stage 1: read-only tools enabled by default.
2. Stage 2: scoped write tools enabled after workspace confirmation.
3. Stage 3: system-level actions enabled via explicit user policy profile.
4. Stage 4: autonomous multi-step execution enabled after trust calibration.

## Mandatory execution pipeline

1. Validate input schema
2. Evaluate policy and risk level
3. Request approval if required
4. Execute in scoped environment
5. Persist output and side effects
6. Emit audit event chain

## Runtime safety defaults

1. Deny unknown tools
2. Deny unknown paths
3. Deny destructive shell patterns unless explicit approval
4. Force timeout and output truncation guard
5. Attach idempotency and trace id to every call

## Methodology: human trust calibration

1. Initial mode: all write/system actions require approval.
2. Learning mode: repeated safe patterns become scoped pre-approvals.
3. Mature mode: policy templates apply per workspace and task type.
4. Emergency mode: one-click "pause all execution" switch.

## Integration points in current codebase

1. Extend `apps/worker/src/handlers.ts` `ai-actions` path to call runtime
2. Add API endpoints in `apps/api/src/routes` for runtime/approvals/audit
3. Emit world stream events for each execution state
