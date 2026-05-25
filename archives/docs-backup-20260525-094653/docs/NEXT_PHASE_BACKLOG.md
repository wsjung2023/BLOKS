# BLOKS Next Phase Backlog

> 기준일: 2026-05-22 (업데이트)  
> P0~P3 Phase A/B/C 완료 후 남은 GA 블로커 및 기능 백로그.

---

## 🔴 GA 블로커 (Phase F — PARTIAL)

- [x] **E2E 테스트 스위트** — 122개 완료 (목표 120개). `apps/web/e2e/` 9개 spec 파일
- [x] **보안 테스트 추가** — 109개 완료 (목표 80개). `security.test.ts` 48개 + `runtime-audit.test.ts` 20개 + `runtime.test.ts` 11개 등
- [x] **p95 응답 지연 측정** — 로컬 p95=77ms (목표 ≤ 2000ms). `pnpm perf:p95` 스크립트 완성. 프로덕션 환경 재측정 필요
- [ ] **OS 매트릭스** — Windows/macOS/Linux 클린 머신 검증
- [ ] **백업/복원 드릴** — 런북은 있음, 실제 실행 필요
- [ ] **Time-to-first-task** — 목표 ≤ 10분 중앙값, 사용성 테스트 미실시
- [ ] **30일 베타** — 미시작

---

## 🟡 기능 미완 (Phase D/E)

- [x] **NPC 대화 개선** — 구현 완료. `tick-engine.ts`에 `PERSONA_BUBBLE_TEMPLATES` + `DIALOGUE_BY_STATUS` 존재.
- [x] **Local-first 태스크 영속성** — 완료. `packages/db/src/local-stub.ts`에 `projects`, `tasks`, `artifacts`, `event_logs` 테이블 추가.

---

## 🟢 운영 안정화 (Phase E)

- [ ] `smoke:board` API 모드 주기 실행 + 실패 알림 연동
- [ ] API cost/queue depth 대시보드 위젯
- [ ] P95 응답시간, 실패율 지표 수집 — `pnpm perf:p95`로 측정 가능, CI 연동 미완
- [ ] 월별 실행 비용 리포트 자동 생성

---

## 완료된 백로그 항목 (참고용)

- [x] E2E 테스트 122개 — `apps/web/e2e/` 9개 spec 파일 (auth, projects, board, approvals, world, audit, characters, demo, security-e2e, smoke)
- [x] 보안 테스트 109개 — API 라우트 단위 보안, JWT 심층, injection 저항, 감사 보안
- [x] Local-first 태스크 영속성 — `local-stub.ts` projects/tasks/artifacts/event_logs 테이블 지원
- [x] approvals approve/reject 라우트 시나리오 테스트
- [x] Approvals/Board/Characters 접근성 개선
- [x] 모바일 뷰 대응
- [x] 에러 메시지/토스트 공통화 (AppShell ToastContext)
- [x] CI GitHub Actions verify pipeline
- [x] Auth middleware lazy env-var (JWT_SECRET 테스트 격리)
