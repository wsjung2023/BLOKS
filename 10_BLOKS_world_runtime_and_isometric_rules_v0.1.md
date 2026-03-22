# 10_BLOKS_world_runtime_and_isometric_rules_v0.1

## 문서 성격
이 문서는 BLOKS MVP의 **월드 런타임 / 아이소메트릭 규칙 / 캐릭터 이동 / 공간 상호작용 / 시각화 연출 규칙**을 정의하는 Build-Spec이다.

즉, 이 문서는 “예쁜 사무실 화면”을 설명하는 문서가 아니다.  
이 문서의 진짜 목적은 다음 질문에 답하는 것이다.

- 월드는 무엇을 표현하고 무엇을 생략하는가?
- 캐릭터는 어떻게 움직이고 언제 멈추는가?
- 상태가 공간 안에서 어떻게 보이는가?
- 충돌 체크는 어느 수준까지 필요한가?
- 실제 실시간처럼 보이게 하되, 시스템은 어디까지 단순화하는가?

---

# 1. 설계 목표

## 1.1 월드의 역할
BLOKS 월드는 세 가지 역할을 동시에 수행해야 한다.

1. **운영 대시보드**
   - 누가 바쁜지
   - 어디가 막혔는지
   - 어느 부서가 혼잡한지
   를 한눈에 보여준다.

2. **정서적 몰입 장치**
   - 캐릭터들이 진짜 회사 구성원처럼 살아 있다는 느낌을 준다.

3. **상호작용 장치**
   - 사용자 클릭/선택/명령의 진입점이 된다.

## 1.2 MVP 현실 원칙
월드는 “실시간처럼 보이게” 만들지만, 실제 내부는 완전 자유 시뮬레이션이 아니다.

MVP 원칙:
- 진짜 샌드박스형 자율세계 금지
- 모든 캐릭터 상시 pathfinding 금지
- 모든 NPC 상시 추론 금지
- Active Core 중심 시각화
- 나머지는 상태 스냅샷 + 이벤트 발생 시만 동작

---

# 2. 뷰 / 카메라 / 좌표계

## 2.1 뷰 타입
- 2D 아이소메트릭 45도 기준
- 부드럽고 귀여운 질감
- 타일 기반 또는 타일 유사 zone 기반 구현

## 2.2 권장 좌표계
내부 로직 좌표는 grid 기반,
렌더링은 isometric projection 사용.

예:
- logical cell: (x, y)
- render point:
  - screenX = (x - y) * tileHalfWidth
  - screenY = (x + y) * tileHalfHeight

이 방식의 장점:
- pathfinding / zone 계산이 단순함
- 충돌 판정이 쉬움
- 렌더만 아이소메트릭으로 보이면 된다

## 2.3 타일 크기 권장
예시:
- logical tile = 1 world cell
- render tile = 128 x 64 또는 96 x 48

권장 시작값:
- 96 x 48

이유:
- 너무 크면 정보 밀도가 떨어짐
- 너무 작으면 캐릭터 식별이 어려움

## 2.4 카메라 규칙
MVP에서는 자유 카메라 + 빠른 포커스 이동 조합.

필수 기능:
- pan
- zoom in/out
- double click focus
- selected character follow (옵션)
- selected room center focus

줌 단계 권장:
- 0.75x
- 1.0x
- 1.25x
- 1.5x

---

# 3. 공간 구조

## 3.1 월드 레이아웃 원칙
회사는 물리적으로 하나의 캠퍼스/오피스로 보이되,
실제 시스템 의미는 **zone** 단위로 관리한다.

## 3.2 필수 zone 목록
1. Executive Zone
2. Strategy & Planning Wing
3. Marketing Studio
4. Research & Investment Lab
5. Engineering Floor
6. Platform Ops Room
7. Shared Meeting Rooms
8. Founder Room
9. Lounge / Recovery Area
10. Transition Corridor / Common Path

## 3.3 zone 속성
각 zone은 최소 아래 필드를 가진다.

```json
{
  "zoneId": "zone_strategy",
  "zoneType": "department",
  "displayName": "Strategy & Planning Wing",
  "capacity": 8,
  "walkable": true,
  "interactionPoints": ["desk_a", "meeting_booth_1"],
  "departmentCode": "strategy"
}
```

## 3.4 방/좌석 수준 디테일
MVP에서는 모든 책상을 개별 시뮬레이션할 필요 없다.

단계 구분:
- Level 1: zone only
- Level 2: room + zone
- Level 3: desk / seat / device

권장:
- MVP는 Level 2

즉,
- 부서 구역 있음
- 회의실 있음
- 라운지 있음
- 개별 책상은 시각 연출 정도만

---

# 4. 캐릭터 렌더링 규칙

## 4.1 표현 대상
항상 렌더되는 캐릭터:
- Founder Avatar
- Digital Twin
- Active Core 12~16명

조건부 렌더:
- 현재 프로젝트 관련 On-call 인력
- 특정 이벤트로 호출된 Specialist

비가시 상태:
- Dormant 인원
- 월드에 등장 필요 없는 지원 캐릭터

## 4.2 스프라이트 규칙
최소 필요 방향:
- 북동 / 북서 / 남동 / 남서 4방향 또는
- 단일 정면 + 이동 애니메이션 단순화

MVP 추천:
- 4방향까지 욕심내지 말고
- 이동 방향에 따라 flip 가능한 2방향+idle+focus 연출부터 시작

## 4.3 시각 구분 요소
캐릭터별로 최소 구분되는 것:
- 실루엣
- 대표 색
- 헤어/액세서리
- 부서 배지
- 직급 표식

## 4.4 상태 오버레이
머리 위 또는 발 밑에 표시.

표시 정보:
- runtimeStatus icon
- 우선순위 glow (P0/P1)
- overload warning
- approval waiting badge
- current task count dot

과잉 표시 금지 원칙:
- 동시에 3개 이상 시각 경고를 붙이지 않는다.

---

# 5. 캐릭터 상태와 월드 행동 매핑

## 5.1 Runtime Status → World 표현

### Idle
- 자기 zone 내 서 있거나 가벼운 idle 애니메이션
- 배정 가능 상태

### Moving
- zone 간 또는 room 간 이동 애니메이션
- destination point 보유

### Focused
- 업무 zone 또는 회의 부스 내 정지
- 집중 aura / 책상 작업 연출

### Collaborating
- 두 명 이상이 근접 배치
- 같은 interaction point 공유
- 협업 이펙트 가능

### InMeeting
- meeting room 점유
- room occupancy 상태 표시

### Reviewing
- 정적 상태 + 문서/패널 확인 연출

### Escalating
- 상위 zone으로 이동하거나 빨간 아이콘 표시

### Overloaded
- 느린 이동, 경고 오버레이, 색 강조

### Resting
- lounge zone 위치
- 회복 애니메이션

### Offline
- 월드 미등장 또는 반투명 미활성

---

# 6. 이동 규칙

## 6.1 이동 모델
MVP는 정교한 완전 자유 pathfinding보다 **waypoint + zone route** 구조를 추천한다.

구조:
- zone anchor
- corridor waypoint
- room point
- interaction point

예:
Strategy zone → corridor_2 → meeting_room_1 → seat_03

## 6.2 pathfinding 수준
MVP 권장:
- A*를 전체 월드 타일에 매 프레임 돌리지 않는다.
- 미리 정의된 walkable graph를 사용한다.

즉,
- navigation graph 기반 이동
- 특정 tile 충돌만 간단 체크

## 6.3 충돌 체크 기준
필수:
- 벽/비이동 구역 충돌
- 같은 interaction point 중복 점유 방지
- meeting room capacity 제한

단순화 가능:
- 캐릭터끼리 어깨 부딪힘 물리연산 없음
- soft separation 적용

## 6.4 soft collision 규칙
두 캐릭터가 같은 지점에 겹칠 수 있는가?

원칙:
- corridor에서는 일시적 겹침 허용 가능
- interaction point / meeting seat는 중복 금지
- 시각적으로 100% 안 겹치게 하려면 비용이 커진다

MVP 추천:
- soft collision 허용
- 정적 지점만 hard occupancy 적용

## 6.5 이동 속도
캐릭터별 기본 speed stat은 있되, MVP에서는 과도한 차이를 두지 않는다.

권장:
- base move speed = 동일
- overloaded = 0.8x
- urgent escalation = 1.2x

---

# 7. 월드 업데이트 모델

## 7.1 Tick 기반 운영
진짜 실시간 AI 시뮬레이터 대신,
월드는 **tick-based state refresh**를 사용한다.

권장 tick:
- render: client animation frame
- simulation sync: 1~2초 단위
- analytics rollup: 30~60초 단위

즉,
- 화면은 부드럽게 움직이지만
- 상태 결정은 저빈도 sync로 충분

## 7.2 클라이언트와 서버 역할
클라이언트:
- 현재 상태를 보간해서 부드럽게 보여줌
- 이동 애니메이션 연출

서버:
- 진실 원장
- 캐릭터 상태/위치 스냅샷 제공
- 이벤트/전이/점유 상태 관리

## 7.3 위치 데이터 구조
```json
{
  "characterId": "char_009",
  "zoneId": "zone_strategy",
  "roomId": "meeting_room_1",
  "logicalPosition": { "x": 12, "y": 8 },
  "targetPosition": { "x": 15, "y": 10 },
  "runtimeStatus": "Moving",
  "updatedAt": "2026-03-20T02:00:00Z"
}
```

---

# 8. 공간 점유 규칙

## 8.1 Meeting Room
meeting room은 상태를 가진다.

```json
{
  "roomId": "meeting_room_1",
  "capacity": 4,
  "occupancy": 3,
  "state": "occupied",
  "activeMeetingId": "meet_101"
}
```

상태값:
- available
- reserved
- occupied
- blocked

## 8.2 Focus Desk / Review Booth
정적 interaction point는 occupancy lock을 가진다.
- 하나의 point에 하나의 active character
- timeout 또는 state exit 시 해제

## 8.3 Founder Room
특수 규칙 가능:
- P0/P1 escalation 시만 자동 접근 허용
- 일반 캐릭터는 meeting invite 기반 접근

---

# 9. 월드 이벤트 시각화

## 9.1 Event Pin 유형
- approval waiting
- risk raised
- task blocked
- urgent escalation
- meeting started
- artifact delivered

## 9.2 표시 규칙
- project 관련 pin은 관련 zone 또는 responsible character 위에 표시
- 시간이 지나면 fade out
- 중요한 건 하단 event feed에도 남음

## 9.3 강도 단계
- info
- warning
- critical

critical만 월드와 UI 둘 다 강하게 강조.

---

# 10. 사용자 인터랙션 규칙

## 10.1 클릭 우선순위
겹친 객체 클릭 시 우선순위:
1. critical event pin
2. character
3. project pin
4. room
5. zone
6. floor tile

## 10.2 hover 정보
hover 시 최소 정보 카드:
- character: 이름 / 상태 / 현재 task 수
- room: 이름 / 점유 / 진행 중 meeting
- project pin: 프로젝트명 / 상태 / 우선순위

## 10.3 더블클릭 동작
- character: character detail open
- project pin: project detail open
- room: room focus + room side panel open

## 10.4 컨텍스트 액션
Founder 기준 우클릭 또는 quick action:
- assign task
- call meeting
- request report
- inspect logs
- focus camera

---

# 11. 월드와 업무 시스템의 연결 규칙

## 11.1 단순 연출 금지
월드에서 보이는 행동은 가능하면 시스템 상태와 연결되어야 한다.

예:
- InMeeting이면 실제 meeting event 존재
- Reviewing이면 실제 approval/task review 대상 존재
- Overloaded면 실제 active task count와 연결

## 11.2 연출 허용 범위
다만 100% 사실성을 강제하면 비용이 커진다.  
그래서 아래는 연출 허용.

허용되는 연출:
- idle wandering
- non-critical corridor movement
- ambience NPC loop

반드시 시스템 연동해야 하는 연출:
- meeting room occupancy
- blocked escalation
- approval waiting
- urgent task handoff

---

# 12. 성능 가드레일

## 12.1 렌더링 가드레일
- 월드 내 상시 렌더 캐릭터 수 20 이하 권장
- particle effect 최소화
- path line 표시 기본 off
- zone label은 확대 시만 full text

## 12.2 시뮬레이션 가드레일
- 모든 character에 매 tick 추론 금지
- 이동 path는 event 발생 시 계산
- active 없는 캐릭터는 snapshot만 유지

## 12.3 네트워크 가드레일
- world snapshot payload는 summary-only
- character detail은 lazy fetch
- event feed는 cursor pagination

---

# 13. MVP에서 버릴 것

다음은 10 문서 기준으로 **의도적으로 버리는 것**이다.

1. 자유 대화형 wandering AI
2. 모든 캐릭터 상시 스케줄러
3. 완전한 desks-level physics
4. 실시간 전역 충돌 회피
5. 고급 군중 시뮬레이션
6. 복잡한 감정 애니메이션
7. 3D 카메라 회전

이걸 버려야 BLOKS가 살아남는다.

---

# 14. MVP에서 반드시 살릴 것

1. Active Core의 살아있는 움직임
2. zone 기반 부서 정체성
3. 상태 배지와 이벤트 핀
4. meeting room occupancy
5. overloaded / escalation 같은 드라마성 높은 상태 시각화
6. 프로젝트/캐릭터/승인이 월드와 연결되는 경험

---

# 15. 구현 권장 순서

## 15.1 Step 1 — static world
- zone 배치
- camera pan/zoom
- 클릭 가능한 room/zone

## 15.2 Step 2 — character placement
- Active Core 배치
- idle/focused/reviewing 기본 상태만 렌더

## 15.3 Step 3 — movement
- waypoint graph 구축
- zone 간 이동
- selected follow

## 15.4 Step 4 — event overlays
- approval pin
- risk pin
- blocked task pin

## 15.5 Step 5 — system-linked world
- project/task/approval 상태와 월드 연결
- meeting room occupancy 반영
- overload 시각화

---

# 16. 예시 월드 스냅샷 계약

```json
{
  "worldVersion": 3,
  "timestamp": "2026-03-20T02:15:00Z",
  "zones": [
    {
      "zoneId": "zone_strategy",
      "displayName": "Strategy & Planning Wing",
      "occupancy": 5,
      "loadLevel": "medium"
    }
  ],
  "rooms": [
    {
      "roomId": "meeting_room_1",
      "state": "occupied",
      "occupancy": 3,
      "activeMeetingId": "meet_101"
    }
  ],
  "characters": [
    {
      "characterId": "char_009",
      "runtimeStatus": "Moving",
      "zoneId": "zone_strategy",
      "logicalPosition": { "x": 12, "y": 8 },
      "targetPosition": { "x": 14, "y": 10 },
      "taskCount": 2,
      "badges": ["P1"]
    }
  ],
  "eventPins": [
    {
      "pinId": "pin_001",
      "pinType": "approvalWaiting",
      "severity": "warning",
      "targetType": "character",
      "targetId": "char_003"
    }
  ]
}
```

---

# 17. UI 패널 연결

## 17.1 좌측 패널
- 부서 필터
- active core toggle
- risk overlay toggle
- approval overlay toggle

## 17.2 우측 패널
선택 대상 상세:
- character summary
- project summary
- room summary
- quick actions

## 17.3 하단 로그
world에서 발생한 이벤트와 업무 로그를 같은 타임라인으로 묶는다.

원칙:
- 장식성 로그보다 운영상 의미 있는 로그 우선

---

# 18. 테스트 기준

## 18.1 기능 테스트
- 캐릭터 클릭 시 상세 패널 열림
- status badge 정확히 반영
- meeting room occupancy 중복 방지
- blocked 상태 pin 표시
- camera zoom/pan 정상

## 18.2 운영 테스트
- project/task/approval 상태 변화가 월드에 반영
- active core overload 시 경고 보임
- event pin이 시간 경과 후 정리됨

## 18.3 성능 테스트
- active 16명 기준 60fps에 근접 또는 체감상 부드러움
- snapshot 2초 주기 수신 시 UI 떨림 과도하지 않음

---

# 19. Definition of Done for 10
다음 조건을 충족하면 10의 MVP 구현 정의를 만족한다.

1. 사용자가 월드에서 누가 어떤 상태인지 알 수 있다.
2. project/task/approval의 중요 이벤트가 월드와 연결된다.
3. Active Core가 살아 있는 회사처럼 보인다.
4. 충돌/점유/회의실 규칙이 최소 수준으로 동작한다.
5. 월드가 예쁘기만 한 장식이 아니라 운영 UI로 기능한다.

---

# 20. 다음 문서 연결
다음 문서 후보:
- 11_BLOKS_seed_repo_file_tree_and_initial_code_map_v0.1.md
- 11_BLOKS_prompt_contracts_and_agent_policies_v0.1.md

우선 추천:
**seed repo file tree and initial code map**

이유:
07, 08, 09, 10이 정리됐으면 이제 실제 파일/폴더/초기 코드 뼈대를 박는 문서로 넘어가는 게 가장 실무적이다.
