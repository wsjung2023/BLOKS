---
title: P0 Contract Lock - SSOT(상태/이벤트/런타임필드) 정본화
priority: HIGH
owner: TBD
status: IN_PROGRESS
---

## 목적
문서(11)에서 선언한 SSOT를 실제 코드/DB/API/UI 계약으로 고정한다.
- character runtime 필드명 불일치
- event_logs 컬럼 상 불일치
- jobs를 event_logs로만 "기록"하는 임시 구현을 종료할 기반 마련

## 범위
- packages/shared (enum/DTO/event schema 강화)
- apps/api 라우터(특히 characters/events/tasks/jobs)
- DB 테이블 스키마 정합성(문서/Prisma/Supabase 테이블의 최소 교집합)

## 작업 단계
1) 현행 API 응답(JSON) 샘플을 수집한다 (characters, tasks, events, jobs).
2) packages/shared에 "정본 타입"을 정의한다:
   - CharacterRuntimeState
   - EventLogRecord
   - JobExecutionRecord
3) apps/api 라우터에서 DB select/insert 필드명을 정본 타입에 맞춘다.
4) web(world)에서 참조하는 필드명(runtime_status 등)을 정본 타입에 맞춘다.

## 수용 기준(DoD)
- characters list 응답과 world UI가 동일 필드셋으로 동작한다.
- events 라우터와 tasks writer가 같은 event_logs 스키마를 사용한다.
- 타입 체크(TypeScript)가 깨지지 않는다.

## 리스크/롤백
- 변경 범위가 넓으므로, 단계별 PR로 쪼개서 병합한다.
- 먼저 read path(SELECT)부터 정리 후 write path(INSERT/UPDATE)로 확장.

## 참고
- repo docs: 03, 04, 09, 11


## 진행 현황
- [x] `packages/shared`에 계약 타입(`CharacterRuntimeStateRecord`, `EventLogRecord`, `JobExecutionRecord`) 추가
- [x] `characters`, `events` 라우트 read-path에 정본 타입 연결
- [x] tasks/jobs 라우트까지 이벤트/잡 계약 타입 연결
- [x] API 응답 샘플 고정 및 계약 스냅샷 생성 (`docs/contracts/api-contract-snapshot.json`)
