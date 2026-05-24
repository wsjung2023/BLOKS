# 04. Delivery Roadmap (24 Weeks, Complete Product)

## Phase A: Architecture Freeze (Weeks 1-3)

1. Finalize runtime contracts and event schemas
2. Lock policy model and approval matrix
3. Freeze release quality gates and SRE baselines
4. Lock local-first dependency policy (no mandatory external services)

## Phase B: Runtime Core (Weeks 4-9)

1. Build `agent-runtime`, `policy-engine`, `audit` packages
2. Implement file/shell/git/process adapters
3. Integrate runtime into worker execution path
4. Build local bundled data/queue profile

## Phase C: Multi-Agent Intelligence (Weeks 10-14)

1. Role-based leader/worker/reviewer collaboration
2. Delegation protocol and conflict avoidance locks
3. Retry and self-healing orchestration behaviors
4. Confidence/approval co-pilot behavior tuning

## Phase D: World UX Completion (Weeks 15-18)

1. Execution-to-world event visualization completion
2. Approval center UX and timeline replay
3. Real-time status consistency hardening
4. Non-technical user setup wizard completion

## Phase E: Distribution And Operations (Weeks 19-22)

1. `npx` installer (`init`, `start`, `doctor`, `upgrade`)
2. Docker Compose and Helm templates
3. Backup/restore and ops runbooks finalization
4. Signed cross-platform desktop wrappers (optional installer UX)

## Phase F: Hardening And GA (Weeks 23-24)

1. Security tests and red-team style abuse tests
2. Performance and chaos validation
3. Release candidate sign-off and GA launch
4. Real-user installation validation campaign

## Milestone checkpoints

1. M1 (Week 3): design lock
2. M2 (Week 9): runtime kernel usable
3. M3 (Week 14): multi-agent production flow stable
4. M4 (Week 18): UX and governance complete
5. M5 (Week 22): install/distribution complete
6. M6 (Week 24): GA-ready

## Methodology: 3-lane execution

1. Product lane: onboarding, usability, acceptance criteria.
2. Runtime lane: tool execution, policy, audit, resilience.
3. Platform lane: installer, update path, packaging, operations.
