> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

---
title: P1 Observability - OpenTelemetry + traceparent 전파
priority: MEDIUM
owner: TBD
status: DONE
---

## 목적
API -> Worker -> AI Router -> Provider까지 요청을 한 줄로 추적한다.

## 작업 단계
1) API에 OpenTelemetry instrumentation 도입(Express).
2) traceparent 헤더를 수용하고 로그/이벤트에 traceId를 기록한다.
3) Worker job payload에 traceId를 carry한다.
4) AI Router 호출 span에 모델/토큰/비용 attribute를 기록한다.

## 참고
- OTel context propagation: https://opentelemetry.io/docs/concepts/context-propagation/
- W3C Trace Context: https://www.w3.org/TR/trace-context/
