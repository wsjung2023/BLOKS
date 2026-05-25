> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

---
title: P1 Observability Data - EventLog/AuditLog 테이블과 writer 유틸 통일
priority: MEDIUM
owner: TBD
status: DONE
---

## 목적
문서에서 구분한 EventLog(시스템 변화)와 AuditLog(권한/결정 추적)를 실제 테이블·코드로 고정한다.

## 작업 단계
1) event_logs / audit_logs의 컬럼을 확정한다.
2) apps/api에서 직접 insert를 금지하고 공용 writer만 사용한다.
3) "override/approval/reject"는 audit에 반드시 남긴다.

## 수용 기준(DoD)
- 모든 상태 전이는 event_logs에 남는다.
- override 또는 권한 위임은 audit_logs에 남는다.
