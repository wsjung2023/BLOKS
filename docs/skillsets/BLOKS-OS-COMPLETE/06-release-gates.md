# 06. Release Gates (GA)

## Functional gates

1. End-to-end autonomous coding flow passes acceptance scenarios
2. Approval and policy flow blocks forbidden actions without exception
3. Runtime failures recover through retry/requeue without data corruption
4. Local-first mode works without mandatory external signup

## Quality gates

1. E2E scenarios >= 120
2. Security tests >= 80
3. No open critical severity defects
4. Regression suite green on release branch

## Performance gates

1. p95 dispatch latency <= 2s
2. Queue backlog recovery within defined SLO
3. Stable operation under expected concurrency profile

## Reliability gates

1. Backup/restore drill succeeds
2. Redis/DB partial outage recovery tested
3. Outbox relay and idempotency replay validated
4. Offline/local-mode resilience verified

## Operations gates

1. Install/upgrade/doctor commands verified on Windows/macOS/Linux
2. Incident runbook tested by on-call simulation
3. Monitoring/alerting dashboards complete
4. Fresh-machine install test pass rate >= 95%
5. Time-to-first-task <= 10 minutes median in usability run

## Measurable progress (Wave 0–7 completion status)

| Gate | Status | Evidence |
|------|--------|---------|
| RuntimeEngine pipeline | ✅ DONE | `packages/agent-runtime` — policy→approve→execute→audit |
| Tool risk tiers (L0–L3) | ✅ DONE | L0/L1 auto-exec, L2 approval, L3 deny (`packages/policy-engine`) |
| Runtime daemon (local tools) | ✅ DONE | `apps/runtime-daemon` — file.read/write, git.*, shell.exec wired to RuntimeEngine |
| Local-first profile (no crash) | ⚠️ PARTIAL | API/Worker start without Supabase/Redis. In-memory seed data (5 characters + runtime states) served to tick-engine via `LocalQueryBuilder`. Full task persistence requires connected profile. See `docs/runbooks/local-profile-quickstart.md` |
| Durable audit log | ✅ DONE | JSONL append-only at `$BLOKS_AUDIT_DIR/audit.jsonl`, loaded on restart |
| Audit tamper-evidence chain | ✅ DONE | SHA-256 prevHash chain in `packages/audit/src/audit-writer.ts` |
| Audit compliance export | ✅ DONE | `GET /api/v1/runtime/audit/export?format=jsonl|csv` |
| Audit chain verification | ✅ DONE | `GET /api/v1/runtime/audit/verify` — `verifyAuditChain()` |
| Audit execution replay | ✅ DONE | `GET /api/v1/runtime/audit/replay/:traceId` + `/audit` page |
| Emergency kill switch | ✅ DONE | `POST /api/v1/runtime/execution/pause|resume` + UI button in `/audit` |
| Secret masking | ✅ DONE | `maskSecretsInObject()` applied to audit input/output/error |
| SSE real-time tool events | ✅ DONE (connected mode) | worker → Redis → API stream → browser. Local mode: no SSE relay |
| Approval UI | ✅ DONE | `/approvals` — risk-context UX with L0-L3 explanations |
| CLI (init/start/doctor/upgrade) | ✅ DONE | `tools/cli` — `pnpm bloks-os` |
| CLI browser auto-open | ✅ DONE | `bloks-os start` polls web readiness then opens browser |
| Diagnostics export bundle | ✅ DONE | `bloks-os doctor --export` writes JSON bundle with secrets redacted |
| Worker RuntimeEngine integration | ✅ DONE | `ai.task.execute` goes through full pipeline |
| Unit tests — worker handlers | ✅ DONE | `apps/worker/src/handlers.test.ts` |
| Unit tests — API runtime routes | ✅ DONE | `runtime.test.ts` (11), `runtime-audit.test.ts` (13), `security.test.ts` (13) — 37 route tests |
| CI GitHub Actions — verify pipeline | ✅ DONE | `.github/workflows/verify.yml` — all 9 packages linted, all apps tested |
| Auth middleware — lazy env-var | ✅ DONE | `auth.ts` reads JWT_SECRET/NODE_ENV inside the function for testability and correctness |
| Incident runbook — runtime sections | ✅ DONE | `docs/runbooks/backup-restore.md`, `docs/runbooks/release-checklist.md` |
| First-run onboarding guide | ✅ DONE | `/projects` empty state — 3-step wizard |
| AI review loop (multi-agent) | ✅ DONE | `processAgentMessages` — APPROVE/REJECT cycle, max 3 revisions |
| Task ownership lock | ✅ DONE | Redis NX lock, 600s TTL in orchestrator |
| Helm deployment templates | ✅ DONE | `deploy/helm/bloks-os/` — api/web/worker + ingress |
| Backup/restore runbook | ✅ DONE | `docs/runbooks/backup-restore.md` |
| Local-first quickstart doc | ✅ DONE | `docs/runbooks/local-profile-quickstart.md` |
| E2E scenarios >= 120 | ❌ OPEN | No E2E test suite exists yet |
| Security tests >= 80 | ⚠️ PARTIAL | 27 security-related tests implemented (auth bypass, input validation, kill switch, secret masking, policy deny, audit export/verify/replay). Target: 80. Gap: ~53 tests (E2E-level, rate-limit, penetration scenarios). |
| p95 dispatch latency <= 2s | ❌ OPEN | Not measured |
| Backup/restore drill (actual run) | ❌ OPEN | Runbook exists but not run on real system |
| Windows/macOS/Linux clean-machine pass | ❌ OPEN | Not tested |
| Time-to-first-task <= 10 min | ❌ OPEN | Not measured |
| 30-day beta | ❌ OPEN | Not started |

## Launch gate

1. 30-day beta completes with no unresolved critical incident — ❌ OPEN
2. Product, engineering, and operations sign-off — ❌ OPEN
3. General-user onboarding sign-off — ❌ OPEN

## Summary (2026-05-21)

**Implemented (✅):** 23 gates  
**Partial (⚠️):** 2 gates (local-first full task automation, security tests count)  
**Open (❌):** 7 gates (E2E tests, performance measurement, OS matrix, backup drill, time-to-first-task, beta)

Phase F (Hardening & GA) remains BLOCKED until ❌ gates are resolved.
