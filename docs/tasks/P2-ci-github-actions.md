---
title: P2 CI - pnpm/turbo 모노레포 CI 파이프라인
priority: LOW
owner: TBD
status: TODO
---

## 목적
PR마다 lint/test/build를 자동 검증하고 monorepo 캐시로 속도를 확보한다.

## 작업 단계
1) GitHub Actions workflow 추가
2) pnpm 캐시 + turbo 캐시 적용
3) main 브랜치 보호 규칙(테스트 통과 필수) 권장
