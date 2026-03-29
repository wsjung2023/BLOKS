---
title: P1 Testing - 상태머신/권한/멱등성 테스트 잠금
priority: MEDIUM
owner: TBD
status: TODO
---

## 목적
BLOKS의 본질(상태 전이/승인/반려/재작업)을 자동 테스트로 잠근다.

## 작업 단계
1) TaskState transitions 테이블 기반 테스트 작성
2) 금지 규칙(self-approval 금지 등) 테스트
3) idempotency-key 재시도 테스트(중복 생성 방지)

## 수용 기준(DoD)
- 핵심 전이 규칙이 깨지면 CI에서 실패한다.
