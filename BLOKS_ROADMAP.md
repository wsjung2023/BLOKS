# BLOKS 상세 작업계획서

> **비전**: 멀티에이전트들이 의뢰한 일을 계획 수립 후 협업하여 결과물을 만들어내는 과정을
> 하나의 살아있는 회사처럼 만화책/애니메이션 형식으로 시각화하는 시뮬레이션 플랫폼

---

## 현재 자산 현황

| 자산 | 상태 | 활용 계획 |
|---|---|---|
| Phaser 3.90 월드 (층별 캐릭터 렌더링) | ✅ 동작 | 전면 확장 |
| 각 층 `layout.json` (seats/meeting_seats/objects) | ✅ 존재, 미활용 | Phase 1에서 즉시 활용 |
| SSE 실시간 스트림 | ✅ 동작 | 이벤트 타입 확장 |
| Worker 틱 엔진 (30초 주기) | ✅ 동작 | 행동 엔진으로 확장 |
| API 라우터 (projects/tasks/artifacts/memories/approvals) | ✅ 존재 | 본격 활용 |
| 말풍선 시스템 (speech/thought) | ✅ 기본 동작 | 감정 확장 |
| 캐릭터 스프라이트 (work-stand/work-desk/work-meeting) | work-stand만 실사용 | 포즈 확장 |
| 파운더 캐릭터 (FOUNDER-01, chr_founder) | ✅ DB 존재 | Phase 1 시각화 |

---

---

# PHASE 1 — 시각적 생동감 (Visual Life)

**목표**: 캐릭터들이 실제로 살아있어 보이는 시각 기반 완성

---

### 1-1. `layout.json` 기반 정확한 좌석 시스템

**문제**: 현재 `FLOOR_SEAT_OVERRIDES` 하드코딩 → 실제 floor 이미지와 불일치
**해결**: 각 층 `layout.json`에 이미 `seats` / `meeting_seats` / `objects` 좌표 데이터 존재

```
세부 작업:
  - getSeats() 함수를 layout.json 동적 로드 방식으로 교체
  - desk_seat, meeting_seat 좌표 정확히 반영
  - facing 방향 데이터 저장 (캐릭터가 어느 방향 바라볼지)
  - FLOOR_SEAT_OVERRIDES 하드코딩 제거

수정 파일:
  - apps/web/src/components/world/IsometricWorldCanvas.tsx
  - apps/web/src/components/world/world-sprites.ts

완료 기준: 캐릭터가 실제 책상 위치에 정확히 앉음
```

---

### 1-2. 캐릭터 애니메이션 상태머신

**현재**: 정적 스프라이트 1장
**방식**: 새 스프라이트 없이 Phaser Tween + Graphics 이펙트로 구현

```
캐릭터 상태 및 표현:
  IDLE_STAND   → work-stand + 미세 bob tween (상하 2px, 3초 주기)
  WORKING      → work-stand + ⌨️ 오버레이 아이콘 + 빠른 bob
  THINKING     → work-stand + 💭 말풍선 + 느린 좌우 흔들림
  IN_MEETING   → meeting 좌석으로 이동 + work-stand
  RESTING      → 휴게존 이동 + alpha 0.85
  SLEEPING     → 수면존 이동 + 😴 아이콘 + 수평 기울임 tween
  CHATTING     → 대상 캐릭터 방향으로 이동 + 💬 풍선
  ARGUING      → 빠른 좌우 흔들림 + 빨간 💢 Graphics 오버레이
  CELEBRATING  → 점프 tween + ✨ Phaser Particles

신규 파일:
  - apps/web/src/components/world/CharacterAnimator.ts
    (상태 → tween/effect 매핑 클래스)

수정 파일:
  - IsometricWorldCanvas.tsx — CharSprite 타입에 animState 추가
  - apps/worker/src/tick-engine.ts — 상태 SSE emit 시 animState 포함
  - apps/api/src/routes/stream.ts — WorldEvent 타입 확장

완료 기준: 상태별로 다른 시각 효과 표시
```

---

### 1-3. 층별 공간 구획 (Zone System)

```
구역 정의:
  DESK_ZONE     → layout.json seats 영역 (기본 업무)
  MEETING_ZONE  → layout.json meeting_seats 영역
  REST_ZONE     → 층별 지정 좌표 (카페/소파 근처)
  TRANSIT       → 이동 중 (엘리베이터 → 책상 경로)

구현:
  - layout.json 파싱으로 구역별 좌표 로드
  - Phaser Zone 오브젝트로 등록
  - 캐릭터 상태에 따라 목적지 구역 결정 로직

수정 파일:
  - apps/web/src/components/world/world-sprites.ts
    FloorConfig에 zones 필드 추가
  - IsometricWorldCanvas.tsx — 구역 기반 이동 로직

완료 기준: 회의 시 캐릭터가 meeting_seats로, 휴식 시 rest zone으로 이동
```

---

### 1-4. 감정 표현 강화 말풍선

```
현재: speech / thought 2종
추가 emotion 타입:
  ANGRY     → 빨간 배경 + 💢
  SLEEPY    → 회색 배경 + 😴 + "z z z" 텍스트
  EXCITED   → 노란 배경 + ✨
  QUESTION  → 파란 배경 + ❓
  IDEA      → 노란 배경 + 💡
  STRESSED  → 주황 배경 + 😰
  LOVE      → 핑크 배경 + 💕 (협업 성공 시)

구현:
  - BubbleData 타입에 emotion 필드 추가
  - showBubble() 함수 emotion별 배경색/아이콘 분기
  - Worker LLM 응답에서 감정 태깅 (키워드 분석 또는 LLM 분류)

수정 파일:
  - IsometricWorldCanvas.tsx — BubbleData, showBubble()
  - apps/api/src/routes/stream.ts — WorldEvent payload 확장
  - apps/worker/src/tick-engine.ts — bubble emit 시 emotion 포함

완료 기준: 상황에 맞는 감정 표현이 말풍선에 반영됨
```

---

### 1-5. 낮/밤 사이클

```
시간대별 조명:
  06:00–09:00  여명 — rgba(100, 120, 200, 0.15) 오버레이
  09:00–18:00  낮   — 오버레이 없음 (정상)
  18:00–21:00  석양 — rgba(255, 150, 50, 0.12) 오버레이
  21:00–06:00  밤   — rgba(0, 0, 40, 0.35) 오버레이

구현:
  - Phaser 씬에 fullscreen 반투명 Rectangle 레이어 추가 (depth: CANVAS_H + 10)
  - setInterval로 1분마다 색상 tween 업데이트
  - Worker 틱에서 시간대별 캐릭터 수면 스케줄 연동

수정 파일:
  - IsometricWorldCanvas.tsx — DayNightOverlay 레이어
  - apps/worker/src/tick-engine.ts — 시간대 체크 추가

완료 기준: 시간대에 따라 층 분위기가 달라짐
```

---

### 1-6. 파운더 캐릭터 시각 구별

```
파운더 식별:
  - DB: id = 'chr_founder', code_name = 'FOUNDER-01'
  - 월드에서 다른 캐릭터와 시각적 구분 필요

구현:
  - 파운더 컨테이너에 👑 텍스트 오브젝트 오버레이 (이름 위)
  - 이름 라벨 색상: 금색 (#FFD700)
  - 파운더는 어느 층 선택해도 항상 해당 층에 표시
  - 파운더 클릭 시 "파운더 모드" 패널 (Phase 2에서 확장)

신규 파일:
  - apps/web/src/lib/useFounder.ts (파운더 ID 판별 훅)

수정 파일:
  - IsometricWorldCanvas.tsx — 파운더 특별 렌더링 분기

완료 기준: 파운더가 👑 달고 금색 이름으로 구별됨
```

---

**Phase 1 전체 완료 기준**:
- [ ] 캐릭터가 실제 책상 위치에 정확히 앉음
- [ ] 상태별 애니메이션/이펙트 표시
- [ ] 감정 표현 말풍선 작동
- [ ] 낮/밤 분위기 변화
- [ ] 파운더 👑 시각 구별

---

---

# PHASE 2 — 파운더 개입 레이어 (Founder Interface)

**목표**: 유저가 살아있는 회사 세계에 직접 개입

---

### 2-1. 파운더 → 캐릭터 직접 메시지

```
UX 플로우:
  1. 월드에서 캐릭터 클릭
  2. 디테일 패널 하단에 "파운더 메시지" 입력창 추가
  3. 메시지 전송 → API 호출
  4. 해당 캐릭터가 LLM으로 응답 생성 (persona + 현재 context 포함)
  5. 응답이 character_bubble SSE로 emit → 말풍선 표시
  6. 응답이 task 생성/수정으로 이어질 수 있음

신규 API:
  POST /api/v1/characters/:id/message
  body: { message: string, fromFounder: true }
  처리:
    - 캐릭터 persona + 현재 task + runtime state 로드
    - LLM 호출 (응답 + 액션 JSON)
    - 응답을 character_bubble SSE emit
    - 액션이 있으면 task 생성/수정 실행

신규 파일:
  - apps/api/src/routes/character-message.ts
  - apps/web/src/components/world/FounderMessageInput.tsx

수정 파일:
  - IsometricWorldCanvas.tsx — CharacterDetail에 메시지 입력창 추가

완료 기준: 캐릭터 클릭 → 메시지 입력 → 실시간 말풍선 반응
```

---

### 2-2. 파운더 지시 → 진행중 태스크 수정

```
파운더 개입 액션:
  방향 수정   → task description 업데이트 + 캐릭터 알림
  긴급 지시   → priority P0 변경 + 캐릭터 즉시 전환
  일시 정지   → task status PAUSED 추가
  담당자 변경 → reassign to 다른 캐릭터

신규 API:
  POST /api/v1/tasks/:id/founder-override
  body: { action: 'redirect'|'urgent'|'pause'|'reassign', payload: {...} }

수정 파일:
  - apps/web/src/app/board/page.tsx — TaskDetailPanel에 파운더 액션 버튼
  - apps/api/src/routes/tasks.ts — founder-override 엔드포인트
  - apps/worker/src/tick-engine.ts — PAUSED 상태 처리

완료 기준: 진행중인 태스크를 파운더가 실시간으로 수정 가능
```

---

### 2-3. 파운더 말풍선 월드 표시

```
파운더가 메시지 보낼 때:
  - 파운더 캐릭터 위에 금색 테두리 말풍선
  - 수신 캐릭터가 파운더 위치 방향으로 잠깐 이동
  - 대화 완료 후 원래 자리 복귀

구현:
  - character_bubble SSE에 isFounderMessage: boolean 필드 추가
  - 파운더 말풍선 스타일: 배경 rgba(255,215,0,0.15), 테두리 #FFD700
  - 수신 캐릭터 이동: tweenCharTo(founderPos) → 응답 후 tweenCharTo(seatPos)

수정 파일:
  - IsometricWorldCanvas.tsx — founder bubble 렌더링 분기
  - apps/api/src/routes/stream.ts — WorldEvent 확장

완료 기준: 파운더-캐릭터 대화가 월드에서 자연스럽게 연출됨
```

---

**Phase 2 전체 완료 기준**:
- [ ] 캐릭터 클릭 → 직접 대화 가능
- [ ] 진행중 태스크 실시간 수정
- [ ] 파운더-캐릭터 대화 월드 연출

---

---

# PHASE 3 — 오케스트레이터 엔진 (The Brain)

**목표**: 의뢰 한 줄 입력 → 자동 계획 → 배분 → 에이전트 협업 실행

---

### 3-1. 프로젝트 인테이크 UI

```
위치: 상단 네비게이션 "New Project" 버튼 → 모달 또는 전용 페이지

입력 필드:
  - 프로젝트 제목 (필수)
  - 의뢰 내용 자유 입력 (필수) — "이런 걸 만들어줘"
  - 마감기한 (선택)
  - 예상 관련 부서 (선택, 오케스트레이터가 자동 결정 가능)

제출 시:
  - POST /api/v1/projects (이미 존재하는 API)
  - 오케스트레이터 Worker Job 트리거

신규 파일:
  - apps/web/src/app/projects/new/page.tsx
  - apps/web/src/components/project/ProjectIntakeForm.tsx

완료 기준: 유저가 자연어로 프로젝트 의뢰 가능
```

---

### 3-2. 오케스트레이터 에이전트

```
트리거: 새 프로젝트 생성 → BullMQ 'orchestrate' 큐에 Job 추가
담당 캐릭터: 가장 높은 rank의 캐릭터 (PM 역할)

LLM 입력 구성:
  system:
    "당신은 [회사명]의 PM입니다.
     팀 구성: [캐릭터 목록 + role + 현재 workload]
     회사 규칙: 각자 전문 영역 외 작업 금지"

  user:
    "다음 프로젝트를 수행하세요: [project description]
     아래 JSON 형식으로 태스크를 분해하고 담당자를 배정하세요."

LLM 응답 스키마:
  {
    "plan_summary": "string",
    "estimated_total_hours": number,
    "tasks": [
      {
        "title": "string",
        "description": "string",
        "assignee_role": "engineering|marketing|research|...",
        "depends_on_titles": ["string"],
        "priority": "P0|P1|P2|P3|P4",
        "estimated_hours": number,
        "deliverable_type": "DOCUMENT|CODE|ANALYSIS|MEMO"
      }
    ]
  }

실행 로직:
  1. LLM 응답 파싱
  2. 각 태스크 POST /tasks 생성
  3. assignee_role 기반 최적 캐릭터 선택 (workload 낮은 순)
  4. 의존성 있는 태스크는 BLOCKED 상태로 생성
  5. PM 캐릭터 말풍선: "📋 [n]개 태스크로 분해 완료! 팀에 배분했습니다"

신규 파일:
  - apps/worker/src/orchestrator.ts
  - packages/shared/src/types/orchestrator.ts

완료 기준: 자연어 의뢰 → 자동 태스크 분해 및 배정
```

---

### 3-3. 에이전트간 통신 프로토콜

```
시나리오:
  - 개발자가 마케터에게 "이 기능 설명 문구 필요해요"
  - 디자이너가 PM에게 "초안 검토 요청"
  - 분석가가 개발자에게 "이 데이터 처리 방식 확인 필요"

DB 스키마 (신규):
  agent_messages 테이블
    id               uuid PK
    from_char_id     uuid FK characters
    to_char_id       uuid FK characters
    message_type     enum: REQUEST|RESPONSE|HANDOFF|REVIEW_REQUEST|FYI
    content          text
    related_task_id  uuid FK tasks (nullable)
    status           enum: PENDING|READ|ACTED_ON
    created_at       timestamptz

SSE 이벤트 (신규):
  agent_message:
    { fromCharId, toCharId, messageType, content, relatedTaskId }
  → 수신 캐릭터가 발신 캐릭터 방향으로 고개 돌리는 연출

Worker 처리:
  - 메시지 수신 캐릭터가 LLM으로 응답 생성
  - 응답이 태스크 업데이트 또는 신규 태스크로 연결

신규 파일:
  - db/migrations/003-agent-messages.sql
  - apps/api/src/routes/agent-messages.ts
  - apps/worker/src/agent-communication.ts

완료 기준: 캐릭터간 메시지 전달이 월드에서 시각적으로 보임
```

---

### 3-4. 의존성 기반 태스크 워크플로우

```
의존성 흐름 예시:
  [기획서 작성] → 완료 → [개발 착수] unblock → [QA 검토] unblock

Worker 로직:
  - 태스크 DONE 전환 시 depends_on 체크
  - BLOCKED 해제된 하위 태스크들 자동 활성화
  - 배정된 캐릭터에게 "새 태스크 시작" SSE 알림
  - 알림 받은 캐릭터 말풍선: "💼 [태스크명] 시작합니다"

수정 파일:
  - apps/api/src/routes/tasks.ts — 완료 시 downstream 처리
  - apps/worker/src/tick-engine.ts — 의존성 체크 추가

완료 기준: 연쇄 태스크가 자동으로 순서대로 진행됨
```

---

**Phase 3 전체 완료 기준**:
- [ ] 자연어 의뢰 → 자동 태스크 분해 및 배정
- [ ] 에이전트간 메시지 교환 작동
- [ ] 의존성 있는 태스크 순차 실행

---

---

# PHASE 4 — 회사 생활 시뮬레이션 (Company Life)

**목표**: 업무 외에도 살아있는 24시간 회사

---

### 4-1. 캐릭터 일과 스케줄러

```
시간대별 기본 행동표:
  09:00  출근 → 자기 층 책상으로 이동 (active_flag=true)
  10:30  오전 집중 업무
  12:00  점심 → 7F Cafe로 이동 + 잡담
  13:00  오후 업무 복귀
  15:00  오후 휴식 (30% 확률 커피 타임)
  18:00  업무 마무리 + 잡담
  19:00  퇴근 (월드에서 페이드아웃)
  23:00  수면 시작 (energy 회복)
  06:00  기상

Worker 구현:
  - 틱마다 현재 게임 시간 확인 (real time 또는 가속 시간)
  - 캐릭터별 스케줄 테이블과 대조
  - 상태 전환 SSE emit

신규 파일:
  - apps/worker/src/schedule-engine.ts

완료 기준: 시간대별로 캐릭터들이 자연스럽게 이동/행동
```

---

### 4-2. 자발적 행동 엔진 (Emergent Behavior)

```
틱마다 확률 기반 랜덤 행동 트리거:

  잡담 (15%)     → 같은 층 캐릭터 1명 선택, LLM으로 짧은 대화 생성
  커피 (8%)      → 7F Cafe로 잠깐 이동 후 복귀
  산책 (10%)     → 층 내 랜덤 위치 이동
  독백 (12%)     → 현재 태스크 관련 💭 생각 풍선
  스트레스 (workload>70 시) → 😰 말풍선
  번아웃 (burnout=true 시) → 특별 시퀀스 (자리 이탈 + 빨간 오버레이)

잡담 LLM 구성:
  두 캐릭터의 persona + 현재 회사 상황
  → 자연스러운 직장 대화 2-3 교환
  → 길이 제한: 말풍선당 50자 이내

신규 파일:
  - apps/worker/src/behavior-engine.ts

수정 파일:
  - apps/worker/src/tick-engine.ts — behavior-engine 호출

완료 기준: 태스크 없는 시간에도 캐릭터들이 자연스럽게 행동
```

---

### 4-3. 회의 메카닉

```
회의 트리거:
  - 오케스트레이터가 "리뷰 회의 필요" 판단 시 자동
  - 파운더가 직접 회의 소집
  - 특정 태스크 PendingReview 전환 시 자동

플로우:
  1. meeting_invite SSE → 관련 캐릭터들에게 전송
  2. 초대 캐릭터들이 해당 층 meeting_seats로 이동
  3. 라운드로빈 발언 (LLM) — 각 캐릭터 persona 반영
  4. 결론 도출 → 태스크 상태 업데이트 or 신규 태스크 생성
  5. "회의 종료" 선언 → 각자 자리 복귀

DB 스키마 (신규):
  meetings 테이블
    id                    uuid PK
    project_id            uuid FK
    agenda                text
    status                enum: SCHEDULED|IN_PROGRESS|DONE
    participant_char_ids  uuid[]
    transcript            jsonb  (발언 기록)
    summary               text   (LLM 생성 요약)
    decisions             jsonb  (결정 사항)
    started_at            timestamptz
    ended_at              timestamptz

SSE 이벤트 (신규):
  meeting_started: { meetingId, participants, location }
  meeting_speech: { meetingId, charId, text }
  meeting_ended: { meetingId, summary }

신규 파일:
  - apps/worker/src/meeting-engine.ts
  - db/migrations/004-meetings.sql
  - apps/api/src/routes/meetings.ts

완료 기준: 회의 소집 → 캐릭터들 모임 → 발언 → 결론 → 복귀 전 과정 작동
```

---

### 4-4. 감정 및 관계 시스템

```
캐릭터 감정 상태 (runtime 확장):
  mood:    0–100  (전반적 기분, 낮으면 작업 quality 저하)
  energy:  0–100  (낮으면 수면 필요, 0이면 강제 수면)
  stress:  0–100  (높으면 번아웃 위험)

감정 변화 트리거:
  태스크 완료    → mood +10, stress -5
  태스크 실패    → mood -15, stress +20
  파운더 칭찬    → mood +25
  동료 잡담      → mood +5, energy +3
  오버타임 근무  → energy -20, stress +15
  수면           → energy +40, stress -20

캐릭터간 관계도 (신규):
  character_relationships 테이블
    char_a_id       uuid
    char_b_id       uuid
    affinity        int  -100 ~ 100 (갈등 ↔ 친밀)
    interaction_count int
    last_interaction timestamptz

관계가 행동에 미치는 영향:
  affinity < -30  → 협업 시 갈등 이벤트 발생 가능
  affinity > 60   → 잡담 빈도 2배, 협업 quality 향상
  mood < 30 시    → LLM 프롬프트에 "기분이 좋지 않음" 추가

신규 파일:
  - apps/worker/src/emotion-engine.ts
  - db/migrations/005-relationships.sql

완료 기준: 감정 상태가 캐릭터 행동에 실제로 영향을 줌
```

---

**Phase 4 전체 완료 기준**:
- [ ] 시간대별 자연스러운 출퇴근 / 점심 / 수면 사이클
- [ ] 태스크 없는 시간에도 잡담/커피/산책 행동
- [ ] 회의 소집 → 물리적 이동 → 발언 → 결론 작동
- [ ] 감정 상태가 행동과 업무 퀄리티에 영향

---

---

# PHASE 5 — 결과물 시스템 (Deliverables)

**목표**: AI 에이전트들이 실제로 뭔가를 만들어내고 파운더에게 전달

---

### 5-1. 결과물 생산 파이프라인

```
태스크 실행 중 LLM이 생성하는 산출물:
  DOCUMENT  → 기획서, 전략 문서, 분석 리포트
  CODE      → 코드 스니펫, 스크립트
  ANALYSIS  → 데이터 분석, 시장 조사
  MEMO      → 의사결정 메모, 회의록
  COPY      → 마케팅 카피, 콘텐츠

Worker LLM system prompt 추가:
  "작업 완료 후 반드시 결과물을 다음 JSON으로 제출하세요:
   {
     'artifact_type': 'DOCUMENT|CODE|ANALYSIS|MEMO|COPY',
     'title': '결과물 제목',
     'content': '마크다운 형식의 본문 내용'
   }"

저장: artifacts 테이블 (이미 존재하는 API 활용)
  - task_id, character_id, artifact_type
  - title, content (마크다운)
  - version, status: DRAFT|REVIEW|APPROVED|REJECTED

수정 파일:
  - apps/worker/src/tick-engine.ts — artifact 파싱 및 저장 로직
  - apps/api/src/routes/artifacts.ts — 조회/상태변경 API 완성

완료 기준: 태스크 완료 시 실제 텍스트 결과물이 DB에 저장됨
```

---

### 5-2. 결과물 뷰어 UI

```
위치: /artifacts 페이지 또는 Board 태스크 클릭 시 패널

기능:
  - 프로젝트별 결과물 목록
  - 마크다운 렌더링 (react-markdown)
  - 버전 히스토리 (수정 이력)
  - 파운더 승인/거부 버튼 + 피드백 입력창

승인/거부 플로우:
  파운더 승인 → task DONE + artifacts status APPROVED
              + 담당 캐릭터 mood +20 + 🎉 말풍선
  파운더 거부 + 피드백 → task REWORK + 캐릭터에게 피드백 전달
              + 캐릭터 mood -10 + 😔 말풍선 반응

신규 파일:
  - apps/web/src/app/artifacts/page.tsx
  - apps/web/src/components/artifact/ArtifactViewer.tsx
  - apps/web/src/components/artifact/ArtifactCard.tsx

완료 기준: 결과물 확인 → 승인/거부 → 캐릭터 반응 전 과정 작동
```

---

### 5-3. 프로젝트 최종 보고

```
트리거: 프로젝트의 모든 태스크 DONE 전환 시

PM 캐릭터 행동:
  1. 파운더 위치로 이동
  2. 말풍선: "📋 [프로젝트명] 완료 보고드립니다!"
  3. 보고서 자동 생성 (LLM):
     - 완료된 태스크 목록
     - 주요 결과물 링크
     - 소요 시간 및 참여 캐릭터
     - 팀 성과 하이라이트
  4. 파운더 알림 패널에 보고서 표시

신규 파일:
  - apps/worker/src/project-completion.ts

완료 기준: 프로젝트 완료 시 PM이 파운더에게 자동 보고
```

---

**Phase 5 전체 완료 기준**:
- [ ] 태스크 완료 시 실제 결과물 텍스트 생성
- [ ] 결과물 뷰어에서 확인 및 승인/거부
- [ ] 프로젝트 완료 시 PM의 자동 보고

---

---

# PHASE 6 — 만화책 연출 (Comic Direction)

**목표**: 보는 재미 극대화 — 애니메이션/만화책처럼 펼쳐지는 연출

---

### 6-1. 카메라 포커스 시스템

```
중요 이벤트 → 자동 카메라 이동:
  파운더 메시지   → 수신 캐릭터 줌인 (zoom 1.5x, 1.5초)
  회의 시작       → 회의실 전체 줌인 (zoom 1.3x)
  태스크 완료     → 완료 캐릭터 하이라이트 (zoom 1.4x, 2초)
  갈등 발생       → 두 캐릭터 동시 프레임
  프로젝트 완료   → 전체 층 줌아웃 후 파운더 줌인

구현:
  - Phaser Camera.pan() + Camera.zoomTo() tween
  - SSE 이벤트에 camera_hint 필드 추가
    { focus: 'char'|'zone', targetId, zoom, duration }
  - 유저가 수동 조작 시 자동 카메라 5초간 일시 중지

수정 파일:
  - IsometricWorldCanvas.tsx — CameraDirector 클래스 추가

완료 기준: 중요 이벤트 시 카메라가 자동으로 따라감
```

---

### 6-2. 이벤트 피드 (Event Ticker)

```
위치: 화면 하단 고정 뉴스 티커 스타일

표시 형식:
  👑 [파운더] → [마르크]: "캠페인 방향 수정해줘"
  📋 [오케스트레이터] 프로젝트 분해 완료 — 8개 태스크
  💬 [회의] 5F Marketing — 캠페인 방향 결정
  ✅ [픽셀스] 분석 리포트 완성
  😡 [링커] ↔ [버즈] 의견 충돌 발생
  🎉 프로젝트 [여름 캠페인] 완료!

구현:
  - 모든 SSE 이벤트를 피드 항목으로 변환
  - 최근 30개 유지, 오래된 것 페이드아웃
  - 항목 클릭 시 해당 캐릭터/태스크로 카메라 이동

신규 파일:
  - apps/web/src/components/world/EventTicker.tsx

완료 기준: 무슨 일이 일어나는지 한눈에 파악 가능
```

---

### 6-3. 특수 연출 이펙트

```
상황별 이펙트:
  프로젝트 완료   → 화면 전체 🎊 Phaser Particles + 캐릭터들 점프 tween
  번아웃 발생     → 빨간 플래시 Camera.flash(0xff0000, 300)
  갈등/싸움       → 💥 Graphics + 양 캐릭터 빠른 진동 tween
  회의 시작       → 해당 구역 Phaser Spotlight 효과
  파운더 등장     → 왕관 파티클 + 전용 사운드 (선택)
  결과물 승인     → 초록 체크 파티클 + 캐릭터 점프

구현:
  - Phaser 3 Particles Manager
  - Camera 효과 (flash, shake, fade)
  - 이펙트별 SSE 트리거 이벤트

신규 파일:
  - apps/web/src/components/world/EffectsLayer.ts

완료 기준: 특별한 순간에 시각 효과로 강조됨
```

---

### 6-4. 시뮬레이션 속도 조절

```
UI: 월드 우하단 컨트롤 패널

속도 옵션:
  ⏸ 일시정지   → Worker 틱 중단 (API로 제어)
  ▶ 실시간     → 틱 30초 (기본)
  ⏩ 2배속      → 틱 15초
  ⏩⏩ 4배속    → 틱 7초

구현:
  - PATCH /api/v1/simulation/speed { tickInterval: number }
  - Worker에서 동적으로 interval 조정
  - 파운더만 제어 가능 (권한 체크)

신규 파일:
  - apps/web/src/components/world/SimulationControls.tsx
  - apps/api/src/routes/simulation.ts

완료 기준: 속도 조절이 실제 Worker 틱에 반영됨
```

---

**Phase 6 전체 완료 기준**:
- [ ] 중요 이벤트 시 카메라 자동 포커스
- [ ] 하단 이벤트 피드 작동
- [ ] 상황별 특수 이펙트 연출
- [ ] 시뮬레이션 속도 조절 가능

---

---

## 전체 Phase 요약

| Phase | 핵심 결과물 | 주요 신규 파일 | 규모 |
|---|---|---|---|
| 1. Visual Life | 살아있는 애니메이션 + 낮/밤 + 파운더 | CharacterAnimator.ts, useFounder.ts | 중 |
| 2. Founder Interface | 직접 대화 + 태스크 개입 | character-message.ts, FounderMessageInput.tsx | 중 |
| 3. Orchestrator | 자동 계획/배분/에이전트 협업 | orchestrator.ts, agent-communication.ts | 대 |
| 4. Company Life | 24시간 생활 시뮬 + 회의 + 감정 | schedule-engine.ts, meeting-engine.ts, behavior-engine.ts | 대 |
| 5. Deliverables | 실제 결과물 생산 + 보고 | ArtifactViewer.tsx, project-completion.ts | 중 |
| 6. Comic Direction | 카메라 연출 + 이펙트 + 속도 조절 | CameraDirector, EffectsLayer.ts, EventTicker.tsx | 소 |

**원칙: 각 Phase는 독립 동작 가능하며 이전 Phase의 완성도를 높이는 방향으로 진행**

---

*작성일: 2026-05-10*
*프로젝트: BLOKS — AI 멀티에이전트 회사 시뮬레이션*
