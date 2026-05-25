> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

---
title: P0 Worker - BullMQ 기반 큐 소비자 부트스트랩
priority: HIGH
owner: TBD
status: DONE
---

## 목적
문서 09/11의 canonical queue names(워크플로우 전이, ai-actions 등)를 실제로 처리하는 worker를 만든다.

## 범위
- apps/worker (BullMQ Worker, QueueEvents, connection)
- packages/shared QUEUE_NAMES 사용
- .env.example의 REDIS_URL 사용

## 작업 단계
1) apps/worker에 bullmq 의존성을 추가한다.
2) queue registry를 만든다(QUEUE_NAMES -> Queue/Worker 매핑).
3) 최소 1개 job을 end-to-end로 동작시킨다:
   - ai-actions: ai.generatePlanningDraft (mock 가능)
4) QueueEvents로 completed/failed를 수신하고 EventLog/JobExecution에 기록한다.

## 수용 기준(DoD)
- worker가 redis에 연결되고 1개 이상의 큐를 소비한다.
- queued -> completed/failed 상태 전이가 관측된다.

## 참고
- BullMQ Flows: https://docs.bullmq.io/guide/flows
- BullMQ Deduplication: https://docs.bullmq.io/guide/jobs/deduplication
