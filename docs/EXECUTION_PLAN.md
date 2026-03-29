# BLOKS 실행 계획서 (Source of Truth 기반)

> 기준 문서(고정):
> 1) `BLOKS 멀티에이전트 시스템 심층 분석 및 아키텍처 개선 권고보고서.md`
> 2) `deep-research-report.md`

## 0. 운영 원칙

- 문서 기준 우선순위는 **P0(신뢰성/보안/정합성) -> P1(관측/품질) -> P2(운영 고도화)** 순서로만 진행한다.
- PR은 반드시 "작은 단위 + 검증 가능" 원칙으로 분리한다.
- P0 완료 전에는 신규 UI 기능 확장을 하지 않는다(버그 수정 제외).
- 각 작업은 완료 시 해당 task 파일의 `status`를 `DONE`으로 갱신하고, 근거 커밋 SHA를 남긴다.

---

## 1. 전체 계획 맵

### P0 (필수 선행)
- [ ] `docs/tasks/P0-contract-lock-ssot.md`
- [ ] `docs/tasks/P0-auth-remove-dev-bypass.md` *(현재: IN_PROGRESS)*
- [ ] `docs/tasks/P0-worker-bullmq-bootstrap.md`
- [ ] `docs/tasks/P0-job-execution-outbox-idempotency.md`

### P1 (품질 잠금)
- [ ] `docs/tasks/P1-ai-router-responses-structured-outputs.md`
- [ ] `docs/tasks/P1-eventlog-auditlog-unification.md`
- [ ] `docs/tasks/P1-opentelemetry-tracing.md`
- [ ] `docs/tasks/P1-world-snapshot-and-sse.md`
- [ ] `docs/tasks/P1-testing-state-machine.md`

### P2 (운영 고도화)
- [ ] `docs/tasks/P2-ci-github-actions.md`
- [ ] `docs/tasks/P2-cost-metrics-and-quotas.md`
- [ ] `docs/tasks/P2-governance-prompt-policy.md`

---

## 2. 현재 진척도 (2026-03-29 기준)

- Task 카드 기준: `DONE 0 / 12`, `IN_PROGRESS 1 / 12`, `TODO 11 / 12`
- 체크리스트(13번 문서) 기준: `8 / 15` 완료 (메타 준비 작업 포함)
- 해석: **본체 구현은 아직 초기 착수 단계**

---

## 3. 실행 순서 (강제)

### Step A — Contract Lock (P0-1)
목표: API/DB/UI 필드 계약 일치(SSOT)

1) characters/events/tasks/jobs 응답 샘플 고정
2) `packages/shared` 정본 타입 추가
3) API select/insert 필드 정렬
4) world/board 참조 필드 정렬

완료 조건:
- 타입체크 통과
- 관련 스모크 통과
- 계약 스냅샷(diff) 리뷰 완료

### Step B — Auth Hardening (P0-2)
목표: dev bypass 의존 제거 + 실제 로그인 경로 연결

1) web 로그인 화면/토큰 저장 전략 확정
2) `POST /api/v1/auth/login` 연동
3) production에서 bypass 불가 검증

완료 조건:
- dev bypass 비활성 기본값 유지
- 로그인 성공/실패 UX 동작

### Step C — Worker Bootstrap (P0-3)
목표: 큐 소비자 실제 동작

1) BullMQ worker/queue registry
2) 최소 1개 E2E job 흐름
3) 완료/실패 이벤트 기록

### Step D — Outbox + Idempotency (P0-4)
목표: 내구성 있는 실행 경로

1) outbox/job_executions 모델
2) API 트랜잭션 + outbox
3) relay -> queue publish
4) idempotency-key 정책

---

## 4. PR 체크리스트 (매 PR 공통)

- [ ] 범위가 단일 task에 묶여 있는가?
- [ ] DoD를 문서/코드/테스트로 증명했는가?
- [ ] `pnpm --filter api lint`
- [ ] `pnpm --filter web lint`
- [ ] `pnpm smoke:api`
- [ ] 관련 task 문서 status 갱신 및 근거 SHA 기입

---

## 5. 다음 액션 (즉시 실행)

- [ ] `P0-contract-lock-ssot`를 첫 구현 대상으로 시작
- [ ] API 응답 계약 스냅샷 수집 스크립트 추가
- [ ] characters/events/tasks/jobs 계약 테이블 작성
