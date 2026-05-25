> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

---
title: P2 Cost - AI 비용 측정/쿼터/경보(예산 폭주 방지)
priority: LOW
owner: TBD
status: DONE
---

## 목적
AI 비용을 '추정'이 아니라 '측정'하고, 과금 폭탄을 구조적으로 차단한다.

## 작업 단계
1) AI 호출마다 usage 토큰/latency를 저장한다.
2) project/day budget 초과 시 new job enqueue를 차단한다.
3) top costly tasks/characters 대시보드용 집계 잡 추가.

## 참고
- OWASP API4: Unrestricted Resource Consumption (비용 폭주 리스크)
- repo .env.example 상한값 존재
