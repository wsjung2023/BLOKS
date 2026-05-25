> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

# 04_BLOKS_data_model_ERD_v0.1

## 문서 목적
이 문서는 BLOKS의 핵심 데이터 구조와 엔터티 관계를 정의하는 1차 ERD 설계 문서다.  
범위는 MVP 기준이며, 아래 영역을 포함한다.

- 회사/조직/캐릭터 구조
- 프로젝트/태스크/승인/산출물 흐름
- 관계도/로그/메모리
- KPI/분석용 최소 데이터 축
- 권한 및 감사 추적을 위한 기본키 구조

이 문서는 DB 구현 직전의 **논리 데이터 모델(Logical Data Model)** 기준이다.

---

## 1. 모델링 원칙

### 1.1 기본 원칙
1. **상태와 히스토리를 분리한다.**  
   현재 상태는 본 테이블에, 변경 이력은 로그 테이블에 저장한다.

2. **업무 엔터티와 승인 엔터티를 분리한다.**  
   Project / Task 상태와 Approval 상태는 독립적으로 관리한다.

3. **캐릭터의 정적 속성과 런타임 속성을 분리한다.**  
   페르소나, 직급, 모델 프로필은 정적 데이터로, 현재 피로도/집중도/상태는 런타임 데이터로 관리한다.

4. **모든 핵심 엔터티는 audit 가능해야 한다.**  
   created_at, updated_at, created_by, updated_by, version 필드를 기본으로 둔다.

5. **MVP에서는 과도한 정규화보다 운영 명확성을 우선한다.**

### 1.2 ID 규칙 제안
- company_id: `cmp_...`
- department_id: `dep_...`
- character_id: `chr_...`
- project_id: `prj_...`
- task_id: `tsk_...`
- approval_id: `apr_...`
- artifact_id: `art_...`
- event_id: `evt_...`
- memory_id: `mem_...`
- relationship_id: `rel_...`

---

## 2. 핵심 엔터티 개요

### 2.1 조직 계층
- Company
- Division / HQ
- Department
- Role
- Rank
- Character
- Character_Runtime_State

### 2.2 업무 계층
- Project
- Task
- Task_Dependency
- Approval
- Artifact
- Workflow_Template (후순위)

### 2.3 지식/기억 계층
- Knowledge_Document
- Memory_Node
- Character_Memory_Link

### 2.4 분석/관계/감사 계층
- Relationship
- KPI_Snapshot
- Event_Log
- Audit_Log
- Risk_Register

---

## 3. 엔터티 상세 정의

## 3.1 Company
회사 단위 최상위 엔터티.

| 필드 | 타입 | 설명 |
|---|---|---|
| company_id | PK | 회사 ID |
| company_name | varchar | 예: BLOKS |
| company_code | varchar | 내부 코드 |
| world_tone | varchar | 세계관 톤 |
| active_flag | boolean | 사용 여부 |
| created_at | timestamp | 생성일시 |
| updated_at | timestamp | 수정일시 |

---

## 3.2 Division
본부/HQ 단위.

| 필드 | 타입 | 설명 |
|---|---|---|
| division_id | PK | 본부 ID |
| company_id | FK | Company 참조 |
| division_name | varchar | 본부명 |
| division_type | varchar | Strategy / Marketing / Research / Engineering / Ops |
| head_character_id | FK nullable | 본부장 캐릭터 |
| sort_order | int | 표시 순서 |
| active_flag | boolean | 사용 여부 |

---

## 3.3 Department
세부 부서/팀 단위.

| 필드 | 타입 | 설명 |
|---|---|---|
| department_id | PK | 부서 ID |
| division_id | FK | 소속 본부 |
| department_name | varchar | 팀명 |
| department_code | varchar | 팀 코드 |
| lead_character_id | FK nullable | 팀 리드 |
| active_flag | boolean | 사용 여부 |

---

## 3.4 Rank
직급 마스터.

| 필드 | 타입 | 설명 |
|---|---|---|
| rank_id | PK | 직급 ID |
| rank_name | varchar | 인턴/사원/대리...대표 |
| rank_level | int | 숫자 레벨 |
| approval_ceiling | varchar | 최대 승인 가능 레벨 |
| default_authority_score | int | 기본 권한 점수 |

---

## 3.5 Role
직책/직무 마스터.

| 필드 | 타입 | 설명 |
|---|---|---|
| role_id | PK | 역할 ID |
| department_id | FK nullable | 기본 부서 |
| role_name | varchar | 직책명 |
| role_family | varchar | Executive / Planning / Marketing / Research / Engineering / Ops |
| responsibility_summary | text | 핵심 책임 |
| is_lead_role | boolean | 리드 여부 |

---

## 3.6 Character
정적 캐릭터 마스터.  
40인 roster의 핵심 테이블.

| 필드 | 타입 | 설명 |
|---|---|---|
| character_id | PK | 캐릭터 ID |
| company_id | FK | 회사 |
| character_name | varchar | 표시명 |
| code_name | varchar | 코드명 |
| division_id | FK | 본부 |
| department_id | FK | 부서 |
| rank_id | FK | 직급 |
| role_id | FK | 역할 |
| character_type | varchar | Founder / Twin / Executive / Staff / Specialist |
| system_role_tags | jsonb | 시스템 특수 권한 태그 (QA, PMO 등) |
| approval_level_limit | varchar | 최대 승인 결재 한도 (L0~L4) |
| budget_limit_tier | varchar | 최대 예산 통제 한도 (B0~B4) |
| persona_summary | text | 한줄 개성 |
| core_drive | varchar | 성취/권력/창조 등 |
| moral_filter | varchar | 윤리 성향 |
| default_model_profile_id | FK nullable | 기본 모델 프로필 |
| trust_base | numeric | 초기 신뢰도 |
| influence_base | numeric | 초기 영향력 |
| loyalty_base | numeric | 초기 충성도 |
| active_mode | varchar | Active Core / On-Call / Dormant |
| avatar_uri | varchar nullable | 아바타 리소스 |
| active_flag | boolean | 사용 여부 |
| created_at | timestamp | 생성일시 |
| updated_at | timestamp | 수정일시 |

---

## 3.7 Character_Runtime_State
캐릭터의 현재 활동/피로/집중도 등 런타임 상태.

| 필드 | 타입 | 설명 |
|---|---|---|
| character_id | PK, FK | Character 참조 |
| activity_state | varchar | Idle / Moving / Focused / In Meeting 등 |
| location_zone | varchar | 현재 위치 구역 |
| workload_score | numeric | 현재 업무량 |
| fatigue_score | numeric | 피로도 |
| focus_score | numeric | 집중도 |
| stress_score | numeric | 스트레스 |
| burnout_triggered | boolean | 번아웃 발동 여부 (Risk 전이용) |
| reliability_live | numeric | 실시간 신뢰도 보정치 |
| last_active_at | timestamp | 마지막 활동 시각 |
| updated_at | timestamp | 갱신 시각 |

---

## 3.8 Model_Profile
캐릭터가 사용할 수 있는 모델 엔진 프로필.

| 필드 | 타입 | 설명 |
|---|---|---|
| model_profile_id | PK | 프로필 ID |
| profile_name | varchar | 예: Strategic Reasoner |
| provider_name | varchar | 모델 제공사 |
| primary_model | varchar | 주 모델 |
| secondary_model | varchar nullable | 보조 모델 |
| reasoning_depth | varchar | low / mid / high |
| creativity_score | numeric | 창의성 지수 |
| reliability_score | numeric | 안정성 지수 |
| coding_score | numeric | 코딩 적합도 |
| analysis_score | numeric | 분석 적합도 |
| max_budget_per_task | numeric | 태스크 예산 상한 |
| tool_access_level | varchar | none / limited / full |
| active_flag | boolean | 사용 여부 |

---

## 3.9 Project
프로젝트 최상위 업무 단위.

| 필드 | 타입 | 설명 |
|---|---|---|
| project_id | PK | 프로젝트 ID |
| company_id | FK | 회사 |
| project_title | varchar | 제목 |
| project_type | varchar | Planning / Marketing / Research / Investment / Engineering |
| business_domain | varchar | 사업영역 |
| project_state | varchar | Idea ~ Archived |
| priority_code | varchar | P0 ~ P4 |
| approval_state | varchar | Waiting L1 등 요약 상태 |
| risk_state | varchar | Stable ~ Incident |
| requester_character_id | FK nullable | 요청자 |
| owner_character_id | FK nullable | 총괄 책임자 |
| sponsor_character_id | FK nullable | 스폰서/승인자 |
| summary | text | 설명 |
| objective | text | 목적 |
| virtual_budget_allocated | numeric | 시뮬레이션 내 할당된 사내 예산 (가상화폐) |
| virtual_budget_consumed | numeric | 현재까지 소모된 사내 예산 |
| api_cost_accumulated | numeric | 실제 LLM API 호출에 사용된 현실 비용 ($) |
| due_at | timestamp nullable | 목표 완료일 |
| started_at | timestamp nullable | 시작일시 |
| completed_at | timestamp nullable | 종료일시 |
| created_at | timestamp | 생성일시 |
| updated_at | timestamp | 수정일시 |
| version | int | 낙관적 락 버전 |

---

## 3.10 Task
프로젝트 하위 실행 단위.

| 필드 | 타입 | 설명 |
|---|---|---|
| task_id | PK | 태스크 ID |
| project_id | FK | 상위 프로젝트 |
| parent_task_id | FK nullable | 상위 태스크 |
| task_title | varchar | 태스크명 |
| task_type | varchar | Research / Draft / Review / Build / QA 등 |
| task_state | varchar | Draft ~ Done |
| priority_code | varchar | P0 ~ P4 |
| assignee_character_id | FK nullable | 담당자 |
| reviewer_character_id | FK nullable | 검토자 |
| owner_department_id | FK nullable | 소유 부서 |
| description | text | 상세 설명 |
| input_artifact_id | FK nullable | 입력 산출물 |
| output_artifact_id | FK nullable | 출력 산출물 |
| virtual_cost_consumed | numeric | 본 업무 수행에 태운 부서 예산 (가상) |
| api_token_consumed | int | 담당 에이전트(LLM)가 소모한 총 토큰 수 |
| started_at | timestamp nullable | 시작 |
| due_at | timestamp nullable | 마감 |
| completed_at | timestamp nullable | 완료 |
| rework_count | int | 재작업 횟수 |
| block_reason_code | varchar nullable | Blocked 사유 |
| created_at | timestamp | 생성일시 |
| updated_at | timestamp | 수정일시 |
| version | int | 버전 |

---

## 3.11 Task_Dependency
태스크 선후행 관계.

| 필드 | 타입 | 설명 |
|---|---|---|
| dependency_id | PK | 관계 ID |
| predecessor_task_id | FK | 선행 태스크 |
| successor_task_id | FK | 후행 태스크 |
| dependency_type | varchar | FS / SS 등 단순화 가능 |
| active_flag | boolean | 사용 여부 |

---

## 3.12 Approval
승인 엔터티.  
Project, Task, Artifact 등과 연결 가능하도록 다형 구조를 택한다.

| 필드 | 타입 | 설명 |
|---|---|---|
| approval_id | PK | 승인 ID |
| entity_type | varchar | project / task / artifact |
| entity_id | varchar | 대상 엔터티 ID |
| approval_level | varchar | L1 / L2 / L3 / Founder |
| approval_state | varchar | Waiting / Approved / Rejected / Returned |
| approver_character_id | FK nullable | 승인자 |
| requested_by_character_id | FK nullable | 상신자 |
| requested_at | timestamp | 상신시각 |
| responded_at | timestamp nullable | 응답시각 |
| reason_code | varchar nullable | 반려/만료 사유 |
| comment | text nullable | 코멘트 |
| sequence_no | int | 승인 순서 |

---

## 3.13 Artifact
업무 결과물 테이블.

| 필드 | 타입 | 설명 |
|---|---|---|
| artifact_id | PK | 산출물 ID |
| project_id | FK | 프로젝트 |
| task_id | FK nullable | 태스크 |
| artifact_type | varchar | PRD / Report / Copy / CodeSpec / QAResult 등 |
| artifact_title | varchar | 제목 |
| storage_uri | varchar nullable | 저장 위치 |
| content_format | varchar | md / json / html / link 등 |
| version_no | int | 산출물 버전 |
| status | varchar | Draft / Submitted / Approved / Archived |
| author_character_id | FK nullable | 작성자 |
| reviewer_character_id | FK nullable | 검토자 |
| created_at | timestamp | 생성일시 |
| updated_at | timestamp | 수정일시 |

---

## 3.14 Knowledge_Document
회사 공용 지식 문서/위키 (RAG 시맨틱 검색 지원).

| 필드 | 타입 | 설명 |
|---|---|---|
| document_id | PK | 문서 ID |
| company_id | FK | 회사 |
| title | varchar | 제목 |
| document_type | varchar | Policy / Playbook / Guideline / Wiki |
| storage_uri | varchar nullable | 저장 위치 |
| embedding_vector | vector(1536) | 벡터 DB용 임베딩 데이터 (유사도 검색용) |
| token_size | int | 컨텍스트 윈도우 계산용 토큰 사이즈 |
| owner_character_id | FK nullable | 책임자 |
| active_flag | boolean | 사용 여부 |
| updated_at | timestamp | 수정일시 |

---

## 3.15 Memory_Node
장기 기억 또는 맥락 기억 저장 단위 (RAG 연동용).

| 필드 | 타입 | 설명 |
|---|---|---|
| memory_id | PK | 기억 ID |
| memory_scope | varchar | company / team / character / project |
| scope_entity_id | varchar | 적용 범위 엔터티 ID |
| memory_type | varchar | preference / lesson / warning / relationship / strategy |
| summary | text | 기억 요약 |
| embedding_vector | vector(1536) | 에이전트 상황/맥락 추론용 벡터 데이터 |
| token_size | int | 프롬프트 주입용 토큰 크기 |
| source_event_id | FK nullable | 생성 이벤트 |
| importance_score | numeric | 중요도 |
| decay_policy | varchar | long / medium / short |
| created_at | timestamp | 생성일시 |
| updated_at | timestamp | 갱신일시 |

---

## 3.16 Character_Memory_Link
캐릭터와 기억 노드 연결.

| 필드 | 타입 | 설명 |
|---|---|---|
| link_id | PK | 링크 ID |
| character_id | FK | 캐릭터 |
| memory_id | FK | 기억 |
| relevance_score | numeric | 관련도 |
| visibility_level | varchar | private / team / exec |

---

## 3.17 Relationship
캐릭터 간 관계도.

| 필드 | 타입 | 설명 |
|---|---|---|
| relationship_id | PK | 관계 ID |
| from_character_id | FK | 출발 캐릭터 |
| to_character_id | FK | 대상 캐릭터 |
| trust_score | numeric | 신뢰도 |
| respect_score | numeric | 존중도 |
| tension_score | numeric | 긴장도 |
| rivalry_score | numeric | 경쟁도 |
| loyalty_score | numeric | 충성도 |
| alignment_score | numeric | 정치적/전략적 정렬도 |
| last_changed_at | timestamp | 최근 변화 시각 |

---

## 3.18 Event_Log
상태 전이 및 주요 행동 로그.

| 필드 | 타입 | 설명 |
|---|---|---|
| event_id | PK | 이벤트 ID |
| entity_type | varchar | project / task / approval / character 등 |
| entity_id | varchar | 대상 ID |
| event_type | varchar | state_changed / assigned / approved / rejected 등 |
| previous_state | varchar nullable | 이전 상태 |
| next_state | varchar nullable | 다음 상태 |
| actor_character_id | FK nullable | 행동자 |
| related_project_id | FK nullable | 관련 프로젝트 |
| related_task_id | FK nullable | 관련 태스크 |
| reason_code | varchar nullable | 사유 코드 |
| event_payload_json | jsonb | 상세 payload |
| occurred_at | timestamp | 발생 시각 |

---

## 3.19 Audit_Log
감사 추적용 로그.

| 필드 | 타입 | 설명 |
|---|---|---|
| audit_id | PK | 감사 ID |
| entity_type | varchar | 엔터티 타입 |
| entity_id | varchar | 엔터티 ID |
| action_type | varchar | create / update / delete / override |
| actor_type | varchar | system / founder / character |
| actor_id | varchar nullable | 수행자 |
| before_json | jsonb nullable | 변경 전 |
| after_json | jsonb nullable | 변경 후 |
| occurred_at | timestamp | 발생 시각 |

---

## 3.20 KPI_Snapshot
분석용 지표 스냅샷.

| 필드 | 타입 | 설명 |
|---|---|---|
| kpi_snapshot_id | PK | 스냅샷 ID |
| scope_type | varchar | company / division / department / character / project |
| scope_entity_id | varchar | 대상 ID |
| metric_name | varchar | 지표명 |
| metric_value | numeric | 값 |
| snapshot_date | date | 기준일 |
| period_type | varchar | daily / weekly / monthly |

---

## 3.21 Risk_Register
리스크 항목 관리.

| 필드 | 타입 | 설명 |
|---|---|---|
| risk_id | PK | 리스크 ID |
| project_id | FK nullable | 프로젝트 |
| task_id | FK nullable | 태스크 |
| risk_state | varchar | Stable / Watch / Warning / Critical / Incident / Resolved |
| risk_type | varchar | schedule / budget / quality / people / security |
| severity_score | numeric | 심각도 |
| owner_character_id | FK nullable | 담당자 |
| description | text | 설명 |
| detected_at | timestamp | 감지 시각 |
| resolved_at | timestamp nullable | 해결 시각 |

---

## 3.22 Delegation
05번 문서 기반으로, 파운더나 임원진이 일정 기간 권한을 위임한 이력을 추적/적용하기 위한 마스터 엔터티.

| 필드 | 타입 | 설명 |
|---|---|---|
| delegation_id | PK | 위임 ID |
| delegator_id | FK | 위임자 캐릭터 ID |
| delegatee_id | FK | 수임자 캐릭터 ID (Twin 등) |
| scope_json | jsonb | 위임 범위 (L2 결재 통과 등) |
| start_at | timestamp | 위임 시작 시간 |
| end_at | timestamp | 위임 만료 시간 |
| reason | text | 사유 |
| revocable | boolean | 직권 회수 가능 여부 |
| active_flag | boolean | 현재 유효 여부 |

---

## 3.23 Prompt_Template
LLM 에이전트의 성격, 행동 지침을 규정하는 시스템 프롬프트(Master Prompt)의 버전 관리용 마스터 테이블. 바이브 코딩 및 엔진 연동 시 가장 중요한 로직 펌프.

| 필드 | 타입 | 설명 |
|---|---|---|
| template_id | PK | 프롬프트 ID |
| character_id | FK nullable | 특정 캐릭터 전용 페르소나일 경우 |
| role_id | FK nullable | 직책 공통 업무지침일 경우 (예: QA 공통) |
| template_type | varchar | system_persona / task_instruction / review_guideline |
| prompt_content | text | 실제 시스템 프롬프트 본문 (System Prompt) |
| version_no | int | 프롬프트 버전 관리용 |
| is_active | boolean | 현재 라이브 적용본 여부 |
| updated_at | timestamp | 갱신 시각 |

---

## 4. 핵심 관계 요약

### 4.1 조직 관계
- Company 1 : N Division
- Division 1 : N Department
- Department 1 : N Role
- Rank 1 : N Character
- Role 1 : N Character
- Character 1 : 1 Character_Runtime_State

### 4.2 업무 관계
- Company 1 : N Project
- Project 1 : N Task
- Task 1 : N Task_Dependency (선/후행)
- Project 1 : N Artifact
- Task 1 : N Artifact
- Project / Task / Artifact 1 : N Approval

### 4.3 기억/관계 관계
- Character N : N Memory_Node (via Character_Memory_Link)
- Character 1 : N Relationship (from)
- Character 1 : N Relationship (to)

### 4.4 로그/분석 관계
- 모든 핵심 엔터티 1 : N Event_Log
- 모든 핵심 엔터티 1 : N Audit_Log
- Company/Division/Department/Character/Project 1 : N KPI_Snapshot

---

## 5. ERD 텍스트 다이어그램

```mermaid
erDiagram
    COMPANY ||--o{ DIVISION : has
    DIVISION ||--o{ DEPARTMENT : has
    DEPARTMENT ||--o{ ROLE : has
    RANK ||--o{ CHARACTER : assigns
    ROLE ||--o{ CHARACTER : assigns
    COMPANY ||--o{ CHARACTER : owns
    CHARACTER ||--|| CHARACTER_RUNTIME_STATE : has
    MODEL_PROFILE ||--o{ CHARACTER : default_for

    COMPANY ||--o{ PROJECT : owns
    PROJECT ||--o{ TASK : contains
    TASK ||--o{ TASK_DEPENDENCY : predecessor
    TASK ||--o{ TASK_DEPENDENCY : successor

    PROJECT ||--o{ ARTIFACT : produces
    TASK ||--o{ ARTIFACT : produces

    CHARACTER ||--o{ PROJECT : requests
    CHARACTER ||--o{ PROJECT : owns
    CHARACTER ||--o{ TASK : assigned_to
    CHARACTER ||--o{ TASK : reviews

    CHARACTER ||--o{ APPROVAL : approves
    PROJECT ||--o{ APPROVAL : targets
    TASK ||--o{ APPROVAL : targets
    ARTIFACT ||--o{ APPROVAL : targets

    CHARACTER ||--o{ RELATIONSHIP : from
    CHARACTER ||--o{ RELATIONSHIP : to

    MEMORY_NODE ||--o{ CHARACTER_MEMORY_LINK : linked
    CHARACTER ||--o{ CHARACTER_MEMORY_LINK : linked

    PROJECT ||--o{ RISK_REGISTER : has
    TASK ||--o{ RISK_REGISTER : has

    PROJECT ||--o{ EVENT_LOG : logs
    TASK ||--o{ EVENT_LOG : logs
    CHARACTER ||--o{ EVENT_LOG : acts

    CHARACTER ||--o{ DELEGATION : delegator
    CHARACTER ||--o{ DELEGATION : delegatee
    
    CHARACTER ||--o{ PROMPT_TEMPLATE : uses
    ROLE ||--o{ PROMPT_TEMPLATE : bounds
```

---

## 6. MVP에서 실제로 먼저 만들 테이블

### 6.1 1차 필수
- Company
- Division
- Department
- Rank
- Role
- Character
- Character_Runtime_State
- Model_Profile
- Project
- Task
- Approval
- Artifact
- Event_Log
- Delegation

### 6.2 2차 필수
- Relationship
- Risk_Register
- KPI_Snapshot

### 6.3 후순위
- Knowledge_Document
- Memory_Node
- Character_Memory_Link
- Audit_Log (단, 운영상 매우 권장)
- Task_Dependency

---

## 7. 인덱스 / 제약 조건 제안

### 7.1 인덱스 추천
- Project(project_state, priority_code)
- Task(project_id, task_state)
- Task(assignee_character_id, task_state)
- Approval(entity_type, entity_id, approval_state)
- Event_Log(entity_type, entity_id, occurred_at desc)
- Relationship(from_character_id, to_character_id)
- KPI_Snapshot(scope_type, scope_entity_id, snapshot_date)

### 7.2 유니크 제약 추천
- Character(company_id, code_name)
- Department(division_id, department_code)
- Role(department_id, role_name)
- Relationship(from_character_id, to_character_id)

### 7.3 체크 제약 예시
- trust_score between 0 and 100
- respect_score between 0 and 100
- tension_score between 0 and 100
- loyalty_score between 0 and 100
- rank_level > 0
- version_no >= 1

---

## 8. 소프트 삭제 / 버전 전략

### 8.1 삭제 전략
운영 데이터는 가능하면 hard delete 하지 않고 아래 원칙을 권장한다.
- active_flag = false
- status = Archived / Cancelled

### 8.2 버전 전략
산출물과 핵심 업무 객체는 version을 관리한다.
- Project.version
- Task.version
- Artifact.version_no

특히 Artifact는 실질적으로 문서 버전 관리 대상이다.

---

## 9. API/화면과의 연결 포인트

### 9.1 조직 화면
- Division / Department / Character
- Rank / Role
- Character_Runtime_State

### 9.2 프로젝트 화면
- Project
- Task
- Approval
- Artifact
- Risk_Register

### 9.3 캐릭터 상세 패널
- Character
- Character_Runtime_State
- Relationship
- KPI_Snapshot
- 최근 Event_Log

### 9.4 감사/운영 대시보드
- Event_Log
- Audit_Log
- KPI_Snapshot
- Risk_Register

---

## 10. 설계 판단 메모

### 10.1 왜 Character와 Runtime_State를 분리했는가
캐릭터의 정체성과 현재 컨디션은 변경 빈도와 성격이 다르기 때문이다.  
이걸 한 테이블에 몰아넣으면 UI 갱신과 로그 해석이 지저분해진다.

### 10.2 왜 Approval을 별도 엔터티로 뒀는가
승인은 업무 자체가 아니라 업무를 통제하는 메커니즘이기 때문이다.  
Project/Task에 승인 컬럼만 넣으면 다단 승인, 반려 이력, 승인자 체인을 표현하기 어렵다.

### 10.3 왜 Event_Log가 중요한가
BLOKS는 단순 CRUD 앱이 아니라 “움직이는 회사”다.  
따라서 무엇이 어떻게 바뀌었는지를 기록하는 Event_Log가 사실상 시스템의 척추다.

---

## 11. 다음 문서 연결
다음으로 가야 할 정규 문서는 아래 둘 중 하나다.

1. `05_BLOKS_UI_screen_spec_v0.1.md`
2. `06_BLOKS_MVP_WBS_v0.1.md`

추천 순서:
- 먼저 05 UI / Screen Spec
- 그다음 06 MVP / WBS

이유:
ERD가 잡혔으니 이제 화면이 어떤 데이터를 어떻게 소비하는지 정의할 차례다.
