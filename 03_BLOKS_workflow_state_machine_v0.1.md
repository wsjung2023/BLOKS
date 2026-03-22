# 03_BLOKS_workflow_state_machine_v0.1

## 문서 목적
이 문서는 BLOKS의 업무 흐름을 **프로젝트(Project)**, **태스크(Task)**, **승인(Approval)**, **리스크(Risk)**, **캐릭터(Character Activity)** 관점에서 상태머신으로 정의하기 위한 1차 설계 사양서다.

이 문서의 목적은 단순히 상태 이름을 나열하는 것이 아니라,
- 어떤 상태가 왜 존재하는지
- 어떤 조건에서 다음 상태로 전이되는지
- 어느 레이어에서 어떤 권한으로 상태를 바꾸는지
를 구조적으로 정리하는 데 있다.

---

## 1. 상태머신 설계 원칙

### 1.1 분리 원칙
BLOKS에서는 아래 상태를 하나로 섞지 않는다.

1. Project 상태
2. Task 상태
3. Approval 상태
4. Character Activity 상태
5. Risk 상태

이유:
- 프로젝트 전체 상태와 개별 태스크 상태는 다르다.
- 승인 대기와 실제 작업 진행은 다르다.
- 캐릭터가 바쁜 것과 태스크가 막힌 것은 다르다.
- 리스크는 별도의 감시 축으로 존재해야 한다.

### 1.2 전이 원칙
모든 상태 전이는 아래 셋 중 하나여야 한다.

- 시스템 자동 전이
- 권한 보유자 수동 전이
- 이벤트 기반 조건 전이

### 1.3 로그 원칙
모든 상태 전이는 Event Log에 남긴다.

필수 로그 항목:
- entity_type
- entity_id
- previous_state
- next_state
- changed_by
- changed_at
- reason_code
- comment
- related_artifact_id
- related_project_id
- related_task_id

---

## 2. Project 상태머신

### 2.1 Project 상태값
- Idea
- Intake
- Qualified
- Approved for Planning
- In Planning
- In Execution
- On Hold
- Review
- Approved
- Released
- Archived
- Cancelled

### 2.2 상태 정의

#### Idea
아직 정식 접수되지 않은 아이디어 상태.
- 생성 주체: Founder, Digital Twin, CEO, Strategy 조직
- 산출물: 아이디어 메모, 간단한 개요, 배경

#### Intake
정식으로 접수된 상태.
- 최소 필수값: 제목, 목적, 사업영역, 요청자, 우선순위
- 책임자: COO 또는 PMO

#### Qualified
진행 가능성 검토를 통과한 상태.
- 검토 항목:
  - 사업 관련성
  - 자원 가용성
  - 전략 적합성
  - 예상 가치
  - 예상 리스크

#### Approved for Planning
기획을 시작해도 되는 승인 상태.
- 이 시점부터 Strategy & Planning HQ가 본격 투입된다.

#### In Planning
요구사항 정의, PRD, IA, 기능구조, 리서치 연결 등 기획이 진행되는 상태.

#### In Execution
실제 실행 단계.
- 마케팅
- 조사
- 투자 분석
- 개발
- QA
등이 병렬 혹은 순차적으로 수행될 수 있다.

#### On Hold
일시 중단.
- 예산 보류
- 우선순위 하락
- 외부 의존성 미해결
- Founder 보류 지시
등으로 진입 가능.

#### Review
최종 산출물 검토 상태.
- CEO/Founder/부서장/QA가 참여 가능

#### Approved
최종 산출물이 공식 승인된 상태.

#### Released
외부 또는 내부 운영 영역으로 배포/전달 완료된 상태.

#### Archived
프로젝트 종료 후 보관 상태.

#### Cancelled
중단 확정 상태.

### 2.3 Project 전이 규칙

#### 기본 전이
- Idea → Intake
- Intake → Qualified
- Intake → Cancelled
- Qualified → Approved for Planning
- Qualified → On Hold
- Approved for Planning → In Planning
- In Planning → In Execution
- In Planning → On Hold
- In Execution → Review
- In Execution → On Hold
- Review → Approved
- Review → In Execution
- Approved → Released
- Released → Archived
- On Hold → In Planning
- On Hold → In Execution
- On Hold → Cancelled

### 2.4 Project 전이 권한

- Founder Avatar: 전체 상태 강제 변경 가능
- CEO: Qualified 이후 대부분 전이 가능
- COO: Intake, Qualified, Planning, Execution 관리 가능
- PMO Lead: 제한적 전이 가능
- 시스템: Released 이후 Archive 자동화 가능

### 2.5 금지 전이
다음 전이는 직접 허용하지 않는 것이 원칙이다.
- Idea → Released
- Intake → Approved
- In Planning → Released
- Cancelled → In Execution
- Archived → In Execution

---

## 3. Task 상태머신

### 3.1 Task 상태값
- Draft
- Created
- Assigned
- Accepted
- In Progress
- Pending Review
- Rejected
- Rework
- Approved
- Done
- Blocked
- Cancelled

### 3.2 상태 정의

#### Draft
아직 확정되지 않은 초안 태스크.

#### Created
정식 생성된 태스크.
- 상위 프로젝트와 연결
- 담당 부서 또는 담당자 미정 가능

#### Assigned
담당자에게 배정됨.
- 아직 수락은 안 됨

#### Accepted
담당자가 업무 수락.
- 수행 책임 발생

#### In Progress
실제 작업 진행 중.

#### Pending Review
검토 요청 상태.
- L1 검토자 이상에게 넘어감

#### Rejected
반려됨.
- 이유 코드 필수

#### Rework
반려 이후 재작업 중 상태.

#### Approved
해당 태스크 결과가 승인됨.

#### Done
업무 종료.
- 하위 산출물 저장 완료
- 후속 태스크 트리거 가능

#### Blocked
외부 의존성, 자원 부족, 선행 태스크 미완료 등으로 진행 불가.

#### Cancelled
취소 확정.

### 3.3 Task 전이 규칙
- Draft → Created
- Created → Assigned
- Assigned → Accepted
- Assigned → Cancelled
- Accepted → In Progress
- In Progress → Pending Review
- In Progress → Blocked
- Pending Review → Approved
- Pending Review → Rejected
- Rejected → Rework
- Rework → Pending Review
- Approved → Done
- Blocked → In Progress
- Blocked → Cancelled

### 3.4 핵심 포인트
Assigned와 Accepted를 분리한다.
- 시스템이 배정했다고 해서 실제 담당자가 일 시작한 것은 아니다.

Rejected와 Rework도 분리한다.
- 반려와 수정 중은 운영상 완전히 다른 상태다.

Approved와 Done도 분리한다.
- 승인되었어도 저장, 후속 트리거, 회계 반영 등이 끝나지 않을 수 있다.

### 3.5 Task 전이 권한
- 생성: PMO Lead, 부서장, 시스템
- 배정: COO, 부서장, PMO
- 수락: 담당 캐릭터
- 검토 요청: 담당 캐릭터 또는 팀 리드
- 승인/반려: 리드, 부서장, QA, Founder
- 취소: 상위 권한자 또는 Founder

---

## 4. Approval 상태머신

### 4.1 Approval 상태값
- Not Required
- Waiting L1
- Waiting L2
- Waiting L3
- Waiting Founder
- Approved
- Rejected
- Returned for Revision
- Expired

### 4.2 승인 레벨 매핑 (8단계 직급 체계 연동)
01번 기초 문서의 8단계 직급과 연동하여 아래와 같이 역할을 매핑합니다.
- **L1 (실무 리드 검토):** 과장(Manager) ~ 차장(Deputy GM) 급. 파트 단위 워크플로우 1차 결재
- **L2 (팀장/부서장 검토):** 부장(GM) 급. 부서 내 실무 총괄 및 프로젝트 중간 승인
- **L3 (임원 검토):** 이사(Director/C-Level) 등 임원진. 전사 전략 방향성 일치 및 본부 예산 승인
- **Founder:** 유저(Founder Avatar). 예산 할당, 조직 개편, 강제 승인(God Mode) 및 반려 지시

### 4.3 Approval 전이 규칙
- Not Required → Approved
- Waiting L1 → Waiting L2
- Waiting L1 → Returned for Revision
- Waiting L1 → Rejected
- Waiting L2 → Waiting L3
- Waiting L2 → Returned for Revision
- Waiting L2 → Rejected
- Waiting L3 → Waiting Founder
- Waiting L3 → Returned for Revision
- Waiting L3 → Rejected
- Waiting Founder → Approved
- Waiting Founder → Returned for Revision
- Waiting Founder → Rejected
- Waiting L1/L2/L3/Founder → Expired

### 4.4 Returned for Revision 처리 원칙
Returned for Revision은 Approval 상태이고,
실제 작업 엔티티(Project/Task)는 다시 Rework, In Planning, In Execution 등으로 전환될 수 있다.

즉:
- Approval 상태와 Work 상태는 별도 관리한다.

---

## 5. Character Activity 상태머신

### 5.1 Character 상태값
- Idle
- Moving
- Focused
- Collaborating
- In Meeting
- Reviewing
- Escalating
- Overloaded
- Resting
- Offline

### 5.2 상태 정의

#### Idle
대기 중. 새 업무를 받을 수 있음.

#### Moving
오피스 월드 내에서 공간 이동 중.
- 회의실
- 본부석
- 전략실
- 개발실
- 라운지
등으로 이동 가능

#### Focused
단독 집중 작업 중.

#### Collaborating
2인 이상 협업 중.

#### In Meeting
회의 참여 상태.

#### Reviewing
검토/승인/감사/피드백 상태.

#### Escalating
상위 권한자에게 이슈 보고/상신 중.

#### Overloaded
동시 업무 과다 상태.
- 처리시간 증가
- 실수율 증가
- 감정 상태 악화 가능

#### Resting
휴식 상태.
- 피로도 회복
- 장기적으로 품질 안정화에 도움

#### Offline
비활성 상태.
- 현재 월드에 등장하지 않음
- On-call 대기 또는 비가동

### 5.3 Character 상태 전이 예시
- Idle → Moving
- Moving → Focused
- Focused → Collaborating
- Focused → In Meeting
- Focused → Reviewing
- Focused → Overloaded
- Overloaded → Resting
- Resting → Idle
- Idle → Offline
- Offline → Idle

### 5.4 비즈니스 활용 포인트
Character 상태는 단순 연출이 아니라 아래에 영향을 준다.
- 업무 배정 가능 여부
- 반응 속도
- 승인 지연
- 품질 점수
- 감정 및 관계 변화

---

## 6. Risk 상태머신

### 6.1 Risk 상태값
- Stable
- Watch
- Warning
- Critical
- Incident
- Resolved

### 6.2 상태 정의
- Stable: 이상 없음
- Watch: 관찰 필요
- Warning: 리스크 징후 명확
- Critical: 높은 위험
- Incident: 실제 문제 발생
- Resolved: 문제 해결됨

### 6.3 Risk 전이 예시
- Stable → Watch
- Watch → Warning
- Warning → Critical
- Critical → Incident
- Incident → Resolved
- Resolved → Stable
- Warning → Stable
- Critical → Watch

### 6.4 Risk 발생 트리거 예시
- 재작업 3회 이상
- 승인 지연 임계 초과
- 핵심 캐릭터 overload 지속
- 예산 초과
- 일정 초과
- QA 실패율 급증
- 상위 보고 미실행

---

## 7. 우선순위 상태와 SLA 연동

### 7.1 Priority
- P0
- P1
- P2
- P3
- P4

### 7.2 SLA 기본 원칙
- P0: 즉시 배정, 즉시 에스컬레이션 허용
- P1: 당일 배정
- P2: 24시간 내 배정
- P3: 리소스 여유 시
- P4: 백로그 적재

### 7.3 SLA 위반 처리
SLA 위반 시 자동 이벤트:
- 경고 로그 생성
- COO/PMO 알림
- Risk 상태 상향 가능
- 담당 캐릭터 overload 체크
- 우선순위 재조정 후보 등록

---

## 8. 상태 전이 트리거 이벤트

### 8.1 시스템 이벤트 예시
- deadline_reached
- dependency_resolved
- artifact_uploaded
- approval_timeout
- budget_threshold_exceeded
- qa_failure_detected

### 8.2 사용자/캐릭터 이벤트 예시
- founder_requested
- assignee_accepted
- review_submitted
- reviewer_rejected
- escalation_requested
- hold_requested
- cancel_confirmed

---

## 9. 이유 코드(Reason Code) 기본 세트

### 9.1 공통 Reason Code
- STRATEGIC_CHANGE
- RESOURCE_SHORTAGE
- LOW_CONFIDENCE
- QUALITY_ISSUE
- RISK_DETECTED
- WAITING_DEPENDENCY
- FOUNDER_DECISION
- BUDGET_LIMIT
- TIMEOUT
- DUPLICATE_REQUEST
- SCOPE_CHANGED
- INVALID_INPUT

### 9.2 반려 사유 예시 (시뮬레이션 전용 변수 포함)
사내 갈등 및 멘탈 변수를 시뮬레이션하기 위해 정상적인 업무 사유와 정치적/감정적 사유가 혼재되어야 합니다.

**[업무 기준 반려]**
- REQUIREMENTS_UNCLEAR (요구사항 불명확 - 기획팀/개발팀 충돌 시)
- LOGIC_INSUFFICIENT (비즈니스 로직 부족)
- MARKET_EVIDENCE_WEAK (시장 데이터 부족 - 리서치팀 전용)
- TECHNICAL_RISK_HIGH (개발 부채 및 아키텍처 리스크 - CTO/개발 리드)
- TEST_FAILED (QA 품질 미달 - QA 리드 전용)
- SECURITY_CONCERN (사내 보안/감사 규정 위배 - 보안팀 전용)

**[블랙 코미디 & 감정 기준 반려]**
- OVERLOAD_REJECTION (캐릭터 과부하 및 번아웃으로 인한 무조건적 반려)
- POLITICAL_CONFLICT (사내 부서 간 기싸움으로 인한 고의 지연 및 반려)
- FOUNDER_MICRO_MANAGEMENT (파운더 아바타의 과도한 트집 및 수동 반려)
- BUDGET_FROZEN (부서 예산 동결 및 법인카드 한도 초과)

---

## 10. 최소 데이터 모델 초안

### 10.1 Project
```json
{
  "id": "proj_001",
  "title": "BLOKS marketing simulator MVP",
  "state": "In Planning",
  "priority": "P1",
  "owner_character_id": "char_pmo_01",
  "approval_state": "Waiting L2",
  "risk_state": "Watch"
}
```

### 10.2 Task
```json
{
  "id": "task_001",
  "project_id": "proj_001",
  "title": "Create PRD draft",
  "state": "In Progress",
  "assignee_character_id": "char_strategy_02",
  "reviewer_character_id": "char_exec_02",
  "reason_code": null
}
```

### 10.3 Event Log (감정 및 스트레스 메타데이터 포함)
상태 변화가 개별 AI 캐릭터의 멘탈리티에 미치는 영향을 추적하여 Risk 상태머신과 연동하기 위해 `simulation_meta` 필드를 추가합니다.

```json
{
  "id": "event_001",
  "entity_type": "task",
  "entity_id": "task_001",
  "previous_state": "Accepted",
  "next_state": "In Progress",
  "changed_by": "char_strategy_02",
  "changed_at": "2026-03-20T10:30:00Z",
  "reason_code": "FOUNDER_DECISION",
  "comment": "파운더의 강제 철야 지시로 작업 시작",
  "simulation_meta": {
    "stress_impact": 15,
    "fatigue_impact": 10,
    "morale_impact": -5,
    "target_character_state": "Overloaded"
  }
}
```

---

## 11. 화면 반영 포인트

### 11.1 Project 패널
- 프로젝트명
- 현재 상태
- 우선순위
- 리스크
- 승인 단계
- 담당 본부
- 진행률

### 11.2 Task 패널
- 태스크 상태
- 담당자
- 검토자
- 남은 시간
- 재작업 횟수
- 블록 원인

### 11.3 Character 패널
- 현재 활동 상태
- 집중도
- 피로도
- 신뢰도
- 현재 업무 수
- overload 여부

### 11.4 하단 로그 패널
- 최근 상태 전이
- 에스컬레이션 알림
- 승인/반려 내역
- 리스크 경고

---

## 12. MVP 범위에서 꼭 필요한 것

### 반드시 포함
- Project 상태머신
- Task 상태머신
- Approval 상태머신
- Character Activity 상태
- Reason Code
- Event Log

### 후순위 가능
- 고급 Risk 상태 자동화
- SLA 자동 패널티
- 복합 승인 경로 분기
- 감정/정치 상태가 승인 흐름에 미치는 영향

---

## 13. 구현 우선순위 추천

### 1차
- Project / Task / Approval 상태 정의
- 기본 전이 API
- 로그 저장

### 2차
- Character Activity 상태 연동
- UI 배지 및 패널 반영
- Blocked / Rework 흐름 강화

### 3차
- Risk 상태 자동화
- SLA 룰 엔진
- 에스컬레이션 자동 추천

---

## 14. 다음 문서 연결
다음 문서는 아래 순서가 자연스럽다.

- 04_BLOKS_character_schema_v0.1.md
- 05_BLOKS_permissions_and_approval_matrix_v0.1.md
- 06_BLOKS_information_architecture_v0.1.md

이 중 다음 우선 추천 문서는:

**04_BLOKS_character_schema_v0.1.md**

이유:
상태머신 다음에는 캐릭터 데이터 구조를 확정해야
실제 DB / UI / 오케스트레이션 설계가 가능해진다.
