> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

---
title: P0 Reliability - JobExecution + Outbox + 멱등성(Idempotency) 도입
priority: HIGH
owner: TBD
status: DONE
---

## 목적
DB 변경과 메시지/잡 발행을 정합성 있게 묶고,
중복 요청/재시도에도 안전한 실행 경로를 만든다.

## 범위
- DB: job_executions, outbox_messages (또는 유사 테이블)
- apps/api: POST /ai-actions, POST /jobs 등 생성성 엔드포인트에 idempotency-key 적용
- worker: outbox relay + dedupe key 적용

## 작업 단계
1) Transactional Outbox 패턴을 적용할 테이블을 설계한다.
2) API에서 "DB 변경 + outbox insert"를 하나의 트랜잭션으로 수행한다.
3) worker(outbox relay)가 outbox를 polling하여 BullMQ로 발행한다.
4) idempotency-key 저장/재사용 정책을 정의한다(최소 24시간).
5) BullMQ deduplication id를 dedupe_key와 연결한다.

## 수용 기준(DoD)
- 동일 요청(idempotency-key 동일) 재시도 시 중복 JobExecution이 생성되지 않는다.
- worker 재시작/크래시 후에도 outbox 메시지가 결국 발행된다.
- consumer는 at-least-once를 가정하고 멱등 처리한다.

## 참고
- Transactional Outbox: https://microservices.io/patterns/data/transactional-outbox.html
- Stripe idempotency 개념(참고용): https://docs.stripe.com/api/idempotent_requests
