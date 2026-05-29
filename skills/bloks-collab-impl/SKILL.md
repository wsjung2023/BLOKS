---
name: bloks-collab-impl
description: BLOKS 에이전트 협업 시스템 구현 가이드. /bloks-collab-impl 호출 시 4단계(character_moved 캔버스 반영, agent_messages 활성화, 피드백 루프, 태스크 템플릿)를 체크리스트 기반으로 순서대로 구현한다. BLOKS 프로젝트에서 협업, SSE, agent_messages, feedback, task template 관련 작업 시 반드시 사용.
---

# BLOKS 협업 시스템 구현

## 현재 상태 (배경)

- `character_moved` SSE 이벤트가 캔버스에서 무시됨
- `agent_messages` 테이블은 존재하나 미사용 (HANDOFF/REVIEW_REQUEST/RESPONSE 흐름 없음)
- 피드백 루프 없음 (완료된 태스크를 재작업할 방법이 없음)
- 태스크 템플릿/모델 매핑이 기본값만 존재

## 구현 순서

각 Phase 시작 전 해당 파일의 현재 상태를 Read로 확인하고, 이미 구현된 부분은 건너뛴다.

---

## Phase 1: character_moved 캔버스 반영

**목표:** SSE로 수신한 `character_moved` 이벤트가 Phaser 씬에서 실제 캐릭터 이동으로 반영되어야 한다.

**관련 파일:**
- `apps/web/src/components/IsometricWorldCanvas.tsx` (또는 현재 Phaser 씬 파일)
- `apps/api/src/routes/stream.ts`

**체크리스트:**
- [ ] SSE 스트림에서 `character_moved` 이벤트 타입 수신 확인
- [ ] 이벤트 페이로드 구조 파악 (`characterId`, `x`, `y`, `direction` 등)
- [ ] Phaser 씬에서 해당 캐릭터 스프라이트를 찾아 위치 업데이트
- [ ] 애니메이션(걷기→정지) 처리

**검증:** 브라우저에서 캐릭터가 SSE 이벤트 수신 시 실제로 이동하는지 확인.

---

## Phase 2: agent_messages 활성화

**목표:** 에이전트 간 HANDOFF, REVIEW_REQUEST, RESPONSE 메시지가 DB에 저장되고 UI에 표시되어야 한다.

**관련 파일:**
- `apps/api/src/routes/tasks.ts` 또는 `apps/api/src/routes/characters.ts`
- `packages/shared/src/` (메시지 타입 enum)
- `apps/worker/src/` (워커에서 메시지 발행)

**체크리스트:**
- [ ] `agent_messages` 테이블 스키마 확인 (`packages/db/prisma/`)
- [ ] `POST /api/v1/messages` 또는 태스크 완료 시 메시지 생성 엔드포인트 구현/활성화
- [ ] `HANDOFF` → 다음 담당자에게 태스크 전달
- [ ] `REVIEW_REQUEST` → 리뷰어 지정 후 상태 변경
- [ ] `RESPONSE` → 리뷰 결과 반환
- [ ] SSE로 메시지 이벤트 브로드캐스트

**검증:** 태스크 완료 시 `agent_messages` 테이블에 레코드가 생성되는지 확인.

---

## Phase 3: 피드백 루프

**목표:** 완료된 태스크에 피드백을 보내면 재작업 상태로 전환되어야 한다.

**관련 파일:**
- `apps/api/src/routes/tasks.ts`
- `packages/db/prisma/schema/` (revision_count, feedback_history 컬럼)

**체크리스트:**
- [ ] DB 마이그레이션: `revision_count INT DEFAULT 0`, `feedback_history JSONB DEFAULT '[]'`
- [ ] `POST /api/v1/tasks/:id/feedback` 엔드포인트 구현
  - 바디: `{ message: string, requestedBy: string }`
  - 동작: 태스크 상태 → `IN_REVISION`, `revision_count++`, feedback history append
- [ ] 워커에서 `IN_REVISION` 상태 태스크 처리 (재작업 큐 등록)
- [ ] 피드백 전송 UI (태스크 카드에 "피드백 보내기" 버튼)

**검증:** 완료된 태스크에 피드백 POST 후 상태가 `IN_REVISION`으로 바뀌는지 확인.

---

## Phase 4: 업무 유형별 태스크 템플릿

**목표:** 태스크 유형별로 다른 프롬프트 템플릿과 AI 모델을 사용해야 한다.

**관련 파일:**
- `packages/ai-router/src/index.ts` (TASK_TEMPLATES, TASK_MODEL_MAP)
- `packages/shared/src/` (태스크 유형 enum)

**체크리스트:**
- [ ] 현재 `routeAI()` 구현 확인
- [ ] `TASK_TEMPLATES` 맵 확장: 태스크 유형 → 시스템 프롬프트 템플릿
- [ ] `TASK_MODEL_MAP` 확장: 태스크 유형 → 모델 ID (복잡한 태스크는 더 강력한 모델)
- [ ] 워커에서 태스크 유형을 `routeAI()`에 전달하도록 수정

**검증:** 서로 다른 유형의 태스크가 다른 모델로 처리되는지 워커 로그에서 확인.

---

## 실행 방법

1. 각 Phase의 체크리스트를 위에서 아래로 순서대로 확인
2. 이미 구현된 항목은 체크 후 건너뜀
3. 미구현 항목부터 구현 시작
4. Phase 완료 후 검증 항목 확인 후 다음 Phase 진행
5. 모든 변경 후 `pnpm lint` 실행하여 타입 오류 없는지 확인
