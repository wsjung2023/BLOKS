> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

---
title: P1 AI Router - Responses API + Structured Outputs로 전환
priority: MEDIUM
owner: TBD
status: DONE
---

## 목적
AI 출력의 스키마 준수/검증 비용을 낮추고, 에이전트 실행의 신뢰성을 올린다.

## 범위
- packages/ai-router OpenAI provider 교체(Chat Completions -> Responses)
- output schema를 Zod/JSON Schema로 관리
- 실패 분류(JSON schema divergence, timeout 등)와 재시도 정책 정리

## 작업 단계
1) response schemas(PlanningDraftV1 등)를 Zod로 정의한다.
2) OpenAI Responses API 호출로 변경한다.
3) Structured Outputs(strict)로 스키마를 강제한다.
4) 실패 시 fallback policy를 정본화한다(무한 재시도 금지).

## 수용 기준(DoD)
- 특정 actionType이 항상 스키마 준수 JSON을 반환한다.
- schema mismatch 재시도/수정 프롬프트 로직이 작동한다.

## 참고(공식)
- Responses API: https://platform.openai.com/docs/api-reference/responses/create
- Structured outputs: https://platform.openai.com/docs/guides/structured-outputs
- 소개 글: https://openai.com/index/introducing-structured-outputs-in-the-api/
