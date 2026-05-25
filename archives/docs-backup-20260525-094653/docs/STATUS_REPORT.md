# BLOKS OS — 현재 상태 리포트

> 기준일: 2026-05-22  
> 이전 진행률 문서(EXECUTION_PLAN, TASK_PROGRESS, LOCKED_SCOPE)는 모두 ARCHIVED 처리됨.

---

## 전체 요약

| 구분 | 상태 |
|------|------|
| P0 ~ P2 태스크 | ✅ 전체 완료 (100%) |
| P3 Phase A — Architecture Freeze | ✅ 완료 |
| P3 Phase B — Runtime Core | ✅ 완료 |
| P3 Phase C — Multi-Agent Intelligence | ✅ 완료 |
| P3 Phase D — World UX Completion | ✅ 완료 |
| P3 Phase E — Distribution & Operations | ⚠️ 일부 미완 (OS 매트릭스 미검증) |
| P3 Phase F — Hardening & GA | ❌ BLOCKED (E2E 테스트, 보안 테스트, 베타) |

---

## 완료된 핵심 기능 ✅

- **RuntimeEngine 파이프라인**: policy → approve → execute → audit
- **Tool risk 티어 시스템**: L0(자동) ~ L3(차단), `packages/policy-engine`
- **Runtime daemon**: file.read/write, git.*, shell.exec, `apps/runtime-daemon`
- **감사 로그**: SHA-256 tamper-evident chain, JSONL/CSV export, replay, `/audit` UI
- **Emergency kill switch**: pause/resume API + UI 버튼
- **AI 멀티에이전트 리뷰 루프**: APPROVE/REJECT 사이클, 최대 3회 재시도
- **Approval UI**: `/approvals` — L0~L3 위험도 컨텍스트 UX
- **CLI**: `bloks-os init/start/doctor/upgrade`, 브라우저 자동 오픈, diagnostics export
- **World Canvas**: Phaser 3 top-down RPG (`/world`)
- **Demo 시나리오 시스템**: 홈페이지/PPT/프로그램 3종, 산출물 미리보기, FastAPI 서버 실행
- **CI**: GitHub Actions verify pipeline (9개 패키지 lint + 테스트)
- **API 테스트**: 109개 테스트 (security 48, runtime-audit 20, runtime 11, 기타)
- **E2E 테스트**: 122개 Playwright 시나리오 (`apps/web/e2e/` — auth, projects, board, approvals, world, audit, characters, demo, security-e2e, smoke)
- **Helm 배포 템플릿**: `deploy/helm/bloks-os/` (api/web/worker + ingress)
- **Local-first 모드**: 인메모리 시드(5캐릭터 + runtime states), Supabase 없이 기동 가능

---

## 미완료 — GA 블로커 ❌

| 항목 | 목표 | 현황 |
|------|------|------|
| E2E 테스트 스위트 | 120개 이상 | ✅ 122개 (`apps/web/e2e/`) |
| 보안 테스트 | 80개 이상 | ✅ 109개 (security 48 + audit 20 + runtime 11 등) |
| p95 응답 지연 | ≤ 2s | ✅ 77ms (로컬, `pnpm perf:p95`) — 프로덕션 재측정 필요 |
| OS 매트릭스 | Win/Mac/Linux 클린 머신 | 미검증 |
| 백업/복원 드릴 | 실제 실행 | 런북만 존재 |
| Time-to-first-task | ≤ 10분 | 미측정 |
| 30일 베타 | 완료 | 미시작 |

---

## 미완료 — 기능 ⚠️

*(없음 — 모든 기능 미완료 항목 해결됨)*

> - **Local-first 태스크 영속성**: ✅ `local-stub.ts`에 `projects`, `tasks`, `artifacts`, `event_logs` 테이블 추가 완료.
> - **NPC 대화 개선**: ✅ `PERSONA_BUBBLE_TEMPLATES` + `DIALOGUE_BY_STATUS` + `getPersonaType()` 모두 `apps/worker/src/tick-engine.ts`에 존재.

---

## 현재 읽어야 할 문서

| 문서 | 목적 |
|------|------|
| `docs/skillsets/BLOKS-OS-COMPLETE/06-release-gates.md` | GA 게이트 상세 현황 |
| `docs/tasks/P3-bloks-os-phase-D-world-ux-completion.md` | World UX 미완 항목 |
| `docs/tasks/P3-bloks-os-phase-E-distribution-operations.md` | 배포/운영 미완 항목 |
| `docs/tasks/P3-bloks-os-phase-F-hardening-ga.md` | GA 블로커 상세 |
| `docs/NEXT_PHASE_BACKLOG.md` | 다음 작업 백로그 |
| `docs/TESTING_SCOPE.md` | 테스트 범위 정의 |
| `docs/runbooks/` | 운영 런북 |
