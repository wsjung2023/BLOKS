# BLOKS 테스트 추가의 의미 (현재 범위)

## 1) 이번에 추가된 테스트 종류

### A. Web 컴포넌트 렌더 테스트
- 파일: `apps/web/src/components/common/LoadStateBlock.test.tsx`
- 목적:
  - `LoadStateBlock`이 전달된 메시지를 렌더하는지 확인
  - 액션 라벨(버튼 텍스트)이 렌더되는지 확인
  - 에러 톤 렌더 분기가 동작하는지 확인
- 의미:
  - 화면 상태 UI의 가장 기초적인 렌더링 회귀(regression)를 빠르게 감지

### B. API 라우트 happy-path 테스트
- 파일: `apps/api/src/routes/happy-path.test.ts`
- 목적:
  - `GET /approvals`와 `GET /characters`가
    - 정상 응답 코드(200)
    - `ok/data/items` 계약 형태
    를 반환하는지 확인
- 의미:
  - 프론트가 기대하는 응답 스키마 계약이 깨지는 변경을 조기에 탐지

### C. 보드 smoke 검증
- 파일: `tools/e2e-board-smoke.mjs` + `tools/fixtures/board-smoke-tasks.json`
- 목적:
  - 보드가 소비하는 태스크 payload에 필수 필드/유효 상태/우선순위가 있는지 검증
- 의미:
  - 런타임 데이터 형태가 보드 화면 요구사항에서 벗어나는지 빠르게 체크

## 2) “정확히 무엇을 추가했는가” 요약
- 테스트 파일 2개 추가
  - web: `LoadStateBlock.test.tsx`
  - api: `happy-path.test.ts`
- smoke 스크립트 1개 + fixture 1개 추가
  - `e2e-board-smoke.mjs`
  - `board-smoke-tasks.json`
- CI 실행 진입점 추가
  - `verify:ci` 스크립트
  - `.github/workflows/verify.yml`

## 3) 이 테스트가 보장하지 않는 것 (중요)
- 실제 브라우저 E2E(클릭/라우팅/DOM 상호작용) 전체를 보장하지는 않음
- approve/reject 같은 write 시나리오의 end-to-end 무결성은 아직 추가 여지 있음
- 외부 인프라(실제 DB/Redis/API 가용성)까지 완전 보장하지는 않음

## 4) 현재 해석 방법
- “추가된 테스트”는 **기초 안전망**이다.
- 즉, 코어 UI/응답 계약이 깨지는 단순 회귀를 빠르게 막아주는 레이어이며,
  다음 단계로 시나리오 통합 테스트를 붙이면 신뢰도가 더 올라간다.
