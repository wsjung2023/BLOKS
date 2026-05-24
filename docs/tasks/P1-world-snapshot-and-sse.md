> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

---
title: P1 World - /world/snapshot + SSE 이벤트 스트림 구현
priority: MEDIUM
owner: TBD
status: DONE
---

## 목적
문서의 "2~5초 스냅샷 + 중요 이벤트 push" 정본 모델을 구현해 월드가 '살아있게' 보이도록 한다.

## 작업 단계
1) /api/v1/world/snapshot 엔드포인트 추가(min payload).
2) web(world canvas)에서 2~5초 polling + interpolation 적용.
3) /api/v1/world/events/stream (SSE)로 중요 이벤트만 push.
4) pin 룰(approval waiting, blocked, risk)을 최소 구현.

## 참고
- repo docs: 10, 11
