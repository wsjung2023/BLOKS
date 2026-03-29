# 13_BLOKS_P1_P2_execution_prep_v0.1

## 목적
P0 안정화 이후, P1/P2 작업을 빠르게 진행하기 위한 실행 준비 체크리스트.

## P1 준비 (아키텍처/정합성)
1. AI Provider 정책 확정
   - [x] 11번 정본 기준으로 MVP는 OpenAI 단일 강제할지 결정
   - [x] Anthropic 코드는 제거/Feature Flag/테스트 전용 중 하나로 정책 문서화
2. 문서 진행률 산정 방식 고도화
   - [x] 파일 존재 체크 + 동작 검증 체크 분리
   - [x] 핵심 라우트 smoke test(health, tasks, approvals) 추가
3. API 응답 계약서 고정
   - [x] `ok/data/items` 형태를 웹 공통 API 클라이언트로 강제
   - [x] 페이지별 ad-hoc 파싱 제거

## P2 준비 (품질/운영성)
1. 프론트 공통 API 레이어
   - [ ] Authorization 헤더/에러 처리/재시도 로직 중앙화
   - [ ] dev-bypass 헤더는 개발환경에서만 주입
2. 화면 품질 향상
   - [ ] Approval/Analytics/Characters loading/empty/error 상태 분리
   - [ ] RightContextPanel 재사용 패턴으로 통일
3. 테스트 기반 마련
   - [ ] web: 최소 1개 컴포넌트 렌더 테스트
   - [ ] api: approvals/characters happy-path 테스트
   - [ ] e2e smoke: board 데이터 표시 확인

## 시작 순서 제안
1) P1-1 (Provider 정책 확정) → 2) P1-2 (진행률 체크 고도화) → 3) P2-1 (공통 API 레이어) → 4) P2-3 (테스트)

## 실행 태스크 파일화(심층 리서치 반영)
- [x] `docs/tasks/` 폴더 생성
- [x] P0/P1/P2 태스크 템플릿 12개 생성
  - P0: contract-lock, auth, worker-bullmq, outbox-idempotency
  - P1: ai-router responses, event/audit log, otel tracing, world snapshot+sse, testing state machine
  - P2: CI, cost/quotas, governance prompt policy

