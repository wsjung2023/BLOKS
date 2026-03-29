---
title: P0 Security - dev-bypass 제거 및 MVP 인증/세션 완성
priority: HIGH
owner: TBD
status: DONE
---

## 목적
프로덕션 경로에서 dev-bypass를 제거하고, Founder 단일 사용자 인증을 완성한다.

## 범위
- apps/api/src/middleware/auth.ts
- apps/web/src/lib/apiClient.ts + world canvas 하드코딩 헤더 제거
- .env.example 정리(DEV 전용 값 분리)

## 작업 단계
1) dev-bypass 토큰 사용 위치를 전수 조사한다.
2) 개발 환경에서만 동작하는 방식으로 제한하거나 완전히 제거한다.
3) Founder 로그인/세션 발급 엔드포인트를 추가한다(최소 /api/v1/auth/login).
4) web은 로그인 후 받은 토큰을 사용하여 API 호출한다(로컬 스토리지/쿠키 중 택1).
5) Supabase service role key는 절대 클라이언트 번들에 포함되지 않음을 확인한다.

## 수용 기준(DoD)
- production NODE_ENV에서 dev-bypass로 인증이 통과하지 않는다.
- 월드 화면이 "실제 토큰"으로 characters를 가져온다.
- 인증 실패 시 UX(로그인 유도)가 동작한다.

## 참고
- Supabase RLS/Service key 주의: https://supabase.com/docs/guides/database/postgres/row-level-security
- OWASP API Security Top10: https://owasp.org/API-Security/editions/2023/en/0x11-t10/


## 진행 현황
- [x] API dev-bypass를 `ENABLE_DEV_BYPASS_AUTH` 플래그로 비활성 기본값 전환
- [x] Web dev-bypass 헤더를 `NEXT_PUBLIC_ENABLE_DEV_BYPASS_AUTH` 플래그 기반으로 제한
- [x] 최소 Founder 로그인 엔드포인트 `POST /api/v1/auth/login` 추가
- [x] 토큰 저장 전략(localStorage) 확정 및 Web 로그인 UX 연결
- [x] production 경로에서 dev-bypass 완전 제거 검증 (`pnpm auth:guard`)
