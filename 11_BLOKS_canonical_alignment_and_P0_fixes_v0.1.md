> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

# 11_BLOKS_canonical_alignment_and_P0_fixes_v0.1

## 문서 성격
이 문서는 01번부터 10번까지 작성된 BLOKS 기획/설계 문서들 사이에 존재하는 **P0급 설정 충돌(정본 불일치)을 교정하고, 단 하나의 진실의 원천(Single Source of Truth, SSOT)을 선언**하는 문서입니다.

AI 파트너(Cursor/Claude)나 개발자는 코딩 중 이전 문서들 사이의 설정 충돌을 발견할 경우, **반드시 이 11번 문서의 규칙을 최우선(Override) 법전으로 적용**해야 합니다.

---

## 1. Roster (조직 인원수) 정본화
- **이슈:** 01번(Founder 제외 40명) vs 02번(Founder 포함 40명)
- **정본 선언:** **"총 40명 = Founder 아바타 1명 + Digital Twin 1명 + 일반 직원 AI 38명"**으로 고정합니다.
- **영향:** DB Seed Data 삽입 및 UI Pagination 카운트 계산 시 전체 풀을 정확히 40개 노드로 제한합니다. (불필요한 과금/과적 방지)

## 2. 직급 체계(Rank) 및 승인 밴드 정본화
- **이슈:** 01번(8단계 직급) vs 04번 권한(12단계 직급) 충돌
- **정본 선언:** 01번의 8단계는 폐기하며, **04번의 12단계 직급(Rank)을 정본으로 사용**합니다. 
  - 단, 직급(Rank)과 결재권(Approval)은 완전히 분리하여 **승인 레벨은 `L0 ~ L4` 밴드로 독립 운영**합니다.
- **영향:** API Payload 및 UI Filter 조건에 12단계 직급이 강제 적용됩니다.

## 3. 부서(Organization Family) 정본화
- **이슈:** 01번에서 신설된 `Corporate Management HQ`가 04번 ERD `role_family`에 누락됨.
- **정본 선언:** ERD `role_family` ENUM에 **`management` (Corporate Management HQ, HR 및 Finance 담당)**를 공식 추가합니다.
- **영향:** Analytics 부서별 집계 및 초기 DB Seed에 `management` 부서 Row가 생성됩니다.

## 4. ID Prefix (식별자 접두사) 정본화
- **이슈:** 04번(`chr_`) vs 09번(`char_`) 등 네이밍 길이 충돌
- **정본 선언:** 가독성과 API 통일성을 우선하여 문서 전체에 걸쳐 **09번 명세서의 긴 웹 친화적 Prefix를 정본으로 채택**합니다.
  - `company_` / `char_` / `proj_` / `task_` / `appr_` / `art_` / `evt_` / `job_`
- **영향:** Prisma Schema Primary Key 설계 및 API JSON Payload 응답 규칙에 강제 적용.

## 5. Queue Taxonomy (비동기 큐 명칭) 정본화
- **이슈:** 07번 vs 08번 vs 09번 큐 이름 불일치
- **정본 선언:** API/Worker의 실제 구동 계약서인 **09번 명세서의 Queue 이름을 공식 명칭으로 고정**합니다.
  - `workflow-transitions` / `ai-actions` / `approvals` / `artifact-postprocess` / `analytics-rollups` / `notifications`
- **영향:** BullMQ 큐 레지스트리 생성 및 Worker Job 라우터 분기 작성 시 기준이 됨.

## 6. Repo Package (모노레포 패키지) 정본화
- **이슈:** 07번(Full Map) vs 08번(Bootstrap 축약본) 불일치
- **정본 선언:** 최종 목표 패키지 아키텍처는 **07번 구조(Full Target)가 맞습니다.** 08번은 단지 **Day 1 진입을 위한 최소 스캐폴딩 뼈대(Minimal Phase 1)**일 뿐입니다.
  - 코더는 08번 터미널 명령어로 뼈대를 세운 뒤, 이후 07번 문서를 참조하여 추가 패키지(auth, analytics 등)를 확장해야 합니다.
  - 역할 분산 선언: **아이소메트릭 렌더링 계층 = `packages/world`**, **월드 상태 연산기 = `packages/simulation`** 두 개를 모두 살려 책임을 분리합니다.

## 7. 실시간 갱신 모델 (Real-time Sync) 정본화
- **이슈:** 05번(초당 실시간 Polling) vs 07/10번(2~5초 Snapshot + Push 혼합)
- **정본 선언:** DB 부하 방지를 위해 **07번/10번의 "2~5초 간격 Snapshot Polling + 중요 이벤트만 서버 Push" 혼합 모델을 정본으로 채택**합니다.
- **영향:** 프론트엔드(`웹 및 월드 UI`)는 매초 무지성 폴링을 금지하고, 서버의 Snapshot 주기에 맞춰 UI 상태를 클라이언트 레벨에서 보간(Interpolation) 처리해야 합니다.

## 8. 멀티 멀티모델 엔진 주입 제한 (AI Provider) 정본화
- **이슈:** 02번 명단에는 캐릭터 별로 다양한 LLM/이미지 모델이 배정되어 있으나, 08번은 OpenAI 단일 통제를 명시함.
- **정본 선언:** 02번 명단의 다중 모델 구조는 **캐릭터의 "서사적 아키타입(설정)"일 뿐이며, MVP 구현 시에는 `OpenAI` API 단일 Provider로 라우팅을 강제**합니다. 멀티 Provider 확장은 MVP 이후 단계에서 검토됩니다.

---

## 🚀 결론
이 11번 문서는 BLOKS Vibe Coding 파이프라인의 **"대법원 판례(Supreme Court Precedent)"**입니다.
이후 에디터(Cursor/Claude)에서 앞선 문서 간 충돌로 인해 컴파일/타입 에러가 발생한다면, 시스템 프롬프트는 100% 이 11번 문서의 규칙을 우선하여 코드를 Generate 해야 합니다.
