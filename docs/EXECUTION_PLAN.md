> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

# BLOKS 실행 계획 (EXECUTION_PLAN)

> 기준일: 2026-03-29
> 목적: P0 완료 이후 P1/P2를 실제 개발 스프린트로 전환하기 위한 실행 기준 문서.

## 1) 현재 상태 요약
- P0 범위(문서 00~11 기준) 완료율: **100%**
- 즉시 착수 대상: `13_BLOKS_P1_P2_execution_prep_v0.1.md`에 정의된 미완료 항목

## 2) 작업 원칙
1. **계약 우선**: API 응답 형식(`ok/data/items`)과 타입 계약을 먼저 고정한다.
2. **작게 쪼개기**: 각 항목을 0.5~1일 단위 작업으로 나눈다.
3. **검증 포함 완료**: 코드 + 최소 테스트(또는 스모크 스크립트)까지 완료로 본다.
4. **문서 동기화**: 완료 시 본 문서와 구현 진행 문서를 즉시 갱신한다.

## 3) 실행 백로그 (P1 → P2)

### P1-2. 진행률 산정 방식 고도화
- [x] 파일 존재 체크와 동작 검증 체크를 분리한 스크립트/리포트 작성 (`tools/p1-progress-check.mjs`)
- [x] 핵심 API smoke test 추가: `health`, `tasks`, `approvals` (초안 완료)
- [x] CI/로컬에서 동일하게 실행 가능한 커맨드 문서화 (`pnpm progress:p1`)

**완료 기준**
- [x] 존재 체크 결과와 동작 체크 결과가 각각 독립적으로 출력된다.
- [x] 3개 핵심 라우트 스모크가 성공 시 pass/fail로 표시된다.

---

### P2-1. 프론트 공통 API 레이어
- [x] Authorization 헤더 주입 공통화
- [x] 공통 에러 처리(네트워크/권한/서버) 및 재시도 정책 적용
- [x] `dev-bypass` 헤더를 개발 환경에서만 자동 주입
- [x] 기존 페이지의 ad-hoc fetch를 공통 클라이언트로 이관

진행 메모: `IsometricWorldCanvas` ad-hoc fetch → `apiClient` 이관 완료(분모 고정을 위해 체크박스 외 메모로 기록).

**완료 기준**
- [x] 주요 페이지(Approval/Analytics/Characters)가 공통 API 클라이언트를 사용한다.
- [x] production 빌드에서 `dev-bypass` 헤더가 주입되지 않는다.

---

### P2-2. 화면 품질 향상
- [x] Approval/Analytics/Characters의 loading/empty/error 상태를 분리 구현
- [x] RightContextPanel 재사용 패턴으로 화면 구조 통일
- [x] 실패 시 사용자 액션(재시도/이동) 제공

진행 메모: Approvals/Board/Characters에서 RightContextPanel 재사용 패턴 적용 완료.

**완료 기준**
- [x] 각 화면에서 3가지 상태가 명확히 구분되어 렌더링된다.
- [x] 중복 UI 패턴이 공통 컴포넌트/패턴으로 정리된다.

---

### P2-3. 테스트 기반 마련
- [x] web: 최소 1개 컴포넌트 렌더 테스트
- [x] api: approvals/characters happy-path 테스트
- [x] e2e smoke: board 데이터 표시 확인 (fixture/API 모드 스크립트 추가)

**완료 기준**
- [x] `web`, `api` 단위 테스트가 CI에서 실행 가능하다.
- [x] e2e smoke 1개 시나리오가 안정적으로 통과한다. (board fixture smoke)

## 4) 권장 순서 (Sprint 제안)
1. **Sprint A**: P1-2 (진행률/스모크)  
2. **Sprint B**: P2-1 (공통 API 레이어)  
3. **Sprint C**: P2-3 (테스트 기반)  
4. **Sprint D**: P2-2 (화면 품질 정리)

## 5) 트래킹 규칙
- 상태값: `TODO` / `IN_PROGRESS` / `BLOCKED` / `DONE`
- 각 작업은 PR 단위로 쪼개고, PR 본문에 아래를 포함한다.
  - 변경 범위
  - 검증 커맨드/결과
  - 잔여 리스크
- 보고 규칙: 모든 진행 공유는 `docs/STATUS_REPORT.md`와 동일한 bullet 중심 `Summary` + `Testing` 형식으로 보고

## 6) 실행 커맨드
- `pnpm progress:p1` : 파일 존재 체크 + API 스모크 체크를 순차 실행
- `BLOKS_API_BASE_URL=http://localhost:4000 pnpm progress:p1` : 대상 API 주소 지정

## 7) 오늘 바로 시작할 작업 (Next Actions)
- [x] `P1-2`용 progress 체크 스크립트 설계안 작성
- [x] API 3종 smoke test 초안 추가
- [x] 실행 커맨드(`pnpm progress:p1`) 문서화
- [x] 스모크 체크를 CI 파이프라인에 연결 (`.github/workflows/verify.yml`, `pnpm verify:ci`)
