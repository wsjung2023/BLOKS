> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

# 09_BLOKS_API_contracts_and_job_specs_v0.1

## 문서 성격
이 문서는 BLOKS MVP의 **실제 개발 착수용 Build-Spec**이다.  
목표는 web / api / worker / ai-router가 같은 언어로 대화하게 만드는 것이다.

이 문서에는 다음이 포함된다.
- HTTP API 계약
- request / response payload 구조
- job queue 명세
- event type 명세
- idempotency / retry / fallback 규칙
- 인증 / 권한 / 감사 포인트
- 실패 케이스와 예외 처리

이 문서는 “대충 이런 API가 있으면 좋다”가 아니라,  
**첫 구현 때 어떤 엔드포인트와 어떤 잡을 만들지**를 결정하는 기준 문서다.

---

# 1. 범위

## 1.1 MVP에서 반드시 지원할 기능
1. Founder가 프로젝트 생성
2. 프로젝트 상태 조회 / 상세 조회
3. 태스크 생성 / 배정 / 상태 전이
4. 승인 요청 / 승인 / 반려 / 수정반환
5. 캐릭터 목록 / 캐릭터 상세 / 캐릭터 상태 조회
6. 이벤트 로그 조회
7. 산출물(Artifact) 등록 / 조회
8. AI 작업 요청 생성
9. worker가 AI 작업을 처리하고 결과를 artifact / event log로 저장

## 1.2 MVP에서 보류 가능한 기능
- 다중 사용자 협업 권한
- 외부 OAuth 로그인
- 복잡한 Webhook 아웃바운드
- 고급 검색 DSL
- 실시간 공동 편집
- 다중 테넌트 회사 분리

---

# 2. 공통 설계 원칙

## 2.1 API 스타일
- REST 우선
- 일부 장기 실행 작업은 비동기 Job 생성 후 polling 또는 event feed로 확인
- JSON only
- 날짜/시간은 ISO-8601 UTC 문자열 사용
- snake_case 대신 **camelCase** 사용

## 2.2 응답 기본 형식
성공 응답:

```json
{
  "ok": true,
  "data": {}
}
```

실패 응답:

```json
{
  "ok": false,
  "error": {
    "code": "TASK_ALREADY_BLOCKED",
    "message": "Task is already blocked.",
    "details": {
      "taskId": "task_123"
    }
  }
}
```

## 2.3 ID 규칙
문자열 prefix 기반 사용.
- company_001
- char_001
- proj_001
- task_001
- appr_001
- art_001
- evt_001
- job_001

## 2.4 낙관적 설계 원칙
- UI는 사용자가 의도를 빠르게 입력하게 한다.
- API는 유효성 검증과 권한 검사를 담당한다.
- 상태 전이 정합성은 workflow engine이 최종 책임진다.
- 장기 작업은 절대 브라우저 요청-응답에 묶지 않는다.

---

# 3. 인증 / 세션 / 권한

## 3.1 MVP 인증 원칙
초기 MVP는 Founder 단일 계정 또는 관리자 단일 계정 전제를 둔다.

지원 방식:
- 이메일 + 매직링크 또는
- 단일 admin credential
- 로컬 개발용 dev bypass

## 3.2 API 권한 헤더
- Authorization: Bearer <token>
- X-Request-Id: 클라이언트 생성 가능
- Idempotency-Key: 생성성 요청에서 선택 사용

## 3.3 서버 권한 해석
현재 사용자 주체는 Founder로 취급한다.  
다만 내부 엔진은 캐릭터 권한 해석을 함께 수행한다.

예:
- Founder는 강제 상태 변경 가능
- COO는 Project Intake / Assignment 변경 가능
- QA는 Approval 관련 일부 권한 가능
- Digital Twin은 권고만 가능, 확정권 없음

---

# 4. 엔티티 요약

## 4.1 주요 엔티티
- Company
- Character
- Project
- Task
- Approval
- Artifact
- EventLog
- JobExecution
- KnowledgeDocument
- RelationshipEdge
- RiskRegister

## 4.2 엔티티 간 최소 관계
- Project 1:N Task
- Project 1:N Artifact
- Task 0..N Approval
- Character 1:N Assigned Task
- Character 1:N EventLog actor
- JobExecution 1:1 또는 1:N Artifact

---

# 5. HTTP API 명세

# 5.1 Health / System

## GET /api/health
용도:
- 서버 생존 여부 확인
- DB / Redis / Queue 연결 간단 상태 노출

응답 예시:
```json
{
  "ok": true,
  "data": {
    "api": "up",
    "db": "up",
    "redis": "up",
    "worker": "degraded",
    "timestamp": "2026-03-20T01:00:00Z"
  }
}
```

---

# 5.2 Characters

## GET /api/characters
설명:
- 40인 roster 조회
- 필터/검색/페이징 지원

query params:
- department
- rank
- role
- runtimeStatus
- activeMode (activeCore | onCall | specialist)
- q
- page
- pageSize

응답 예시:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "char_014",
        "name": "NABI",
        "codeName": "nabi",
        "departmentCode": "strategy",
        "rankCode": "manager",
        "roleCode": "servicePlanner",
        "runtimeStatus": "Focused",
        "activeMode": "activeCore",
        "trustScore": 73,
        "influenceScore": 41,
        "currentTaskCount": 2
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 40
  }
}
```

## GET /api/characters/:characterId
설명:
- 캐릭터 상세 조회

응답 핵심 필드:
- identity
- organization
- persona
- capability
- runtimeState
- modelProfile
- relationshipSummary
- performanceMetrics
- governance

## POST /api/characters/:characterId/actions/assign-task
설명:
- 특정 캐릭터에게 태스크 배정

request:
```json
{
  "taskId": "task_101",
  "assignedByCharacterId": "char_004",
  "reason": "Need UX flow clarification"
}
```

validation:
- task 존재 여부
- task 상태가 Assigned 가능한 상태인지
- assignee가 현재 배정 가능 상태인지
- 권한 보유자인지

성공 시:
- task.state = Assigned
- task.assigneeCharacterId 갱신
- event log 생성

---

# 5.3 Projects

## GET /api/projects
query params:
- state
- businessType
- priority
- riskState
- approvalState
- ownerCharacterId
- q
- page
- pageSize

## POST /api/projects
설명:
- Founder가 새 프로젝트 생성
- 생성 시 기본 상태는 Intake 또는 Idea → Intake 자동 전이

request:
```json
{
  "title": "BLOKS landing page PRD",
  "businessType": "appPlanning",
  "priority": "P1",
  "goal": "Create the first public landing page product brief",
  "requestedBy": "founder",
  "description": "Need product messaging, IA, feature framing",
  "tags": ["landing", "mvp", "product"]
}
```

response:
```json
{
  "ok": true,
  "data": {
    "project": {
      "id": "proj_101",
      "state": "Intake",
      "approvalState": "NotRequired",
      "riskState": "Stable"
    }
  }
}
```

후행 동작:
- project.created event
- intake.created event
- optional: project.intake.routing job enqueue

## GET /api/projects/:projectId
포함 정보:
- project header
- summary
- task list/tree
- artifact list
- approval summary
- risk summary
- related characters
- recent events

## POST /api/projects/:projectId/state-transition
설명:
- 프로젝트 상태 전이

request:
```json
{
  "nextState": "InPlanning",
  "changedByCharacterId": "char_003",
  "reasonCode": "FOUNDER_DECISION",
  "comment": "Approved for planning after intake review"
}
```

검사:
- 현재 상태에서 nextState가 허용되는지
- 권한 보유자인지
- 금지 전이인지

실패 코드 예시:
- PROJECT_INVALID_TRANSITION
- PROJECT_PERMISSION_DENIED
- PROJECT_ALREADY_CANCELLED

---

# 5.4 Tasks

## POST /api/tasks
설명:
- 태스크 생성

request:
```json
{
  "projectId": "proj_101",
  "parentTaskId": null,
  "title": "Draft PRD overview",
  "description": "Create first PRD overview draft",
  "taskType": "planningDocument",
  "priority": "P1",
  "createdByCharacterId": "char_005",
  "assigneeCharacterId": "char_009",
  "reviewerCharacterId": "char_003",
  "dueAt": "2026-03-21T09:00:00Z"
}
```

생성 규칙:
- 기본 state = Created
- assigneeCharacterId가 있으면 Created → Assigned 자동 전이 가능
- parentTaskId 있으면 같은 projectId인지 검증

## GET /api/tasks/:taskId
반환:
- task detail
- dependency list
- latest approvals
- artifacts
- recent logs

## POST /api/tasks/:taskId/accept
설명:
- 담당자가 태스크 수락

request:
```json
{
  "acceptedByCharacterId": "char_009"
}
```

전이:
- Assigned → Accepted

## POST /api/tasks/:taskId/start
설명:
- Accepted → InProgress

## POST /api/tasks/:taskId/request-review
설명:
- InProgress 또는 Rework → PendingReview

request:
```json
{
  "requestedByCharacterId": "char_009",
  "comment": "Draft complete, requesting first review"
}
```

후행 동작:
- approval 레코드가 필요한 태스크면 approval queue 생성

## POST /api/tasks/:taskId/reject
설명:
- PendingReview → Rejected

request:
```json
{
  "reviewedByCharacterId": "char_003",
  "reasonCode": "REQUIREMENTS_UNCLEAR",
  "comment": "User flow section needs refinement"
}
```

후행 동작:
- task.rejection reason 필수
- 다음 상태를 수동 또는 자동으로 Rework로 전이

## POST /api/tasks/:taskId/rework
설명:
- Rejected → Rework

## POST /api/tasks/:taskId/approve
설명:
- PendingReview → Approved

## POST /api/tasks/:taskId/complete
설명:
- Approved → Done

## POST /api/tasks/:taskId/block
설명:
- InProgress / Accepted → Blocked

request:
```json
{
  "changedByCharacterId": "char_009",
  "reasonCode": "WAITING_DEPENDENCY",
  "comment": "Need market analysis output first"
}
```

## POST /api/tasks/:taskId/unblock
설명:
- Blocked → InProgress 또는 Assigned
- choice를 API body로 받음

---

# 5.5 Approvals

## GET /api/approvals
query params:
- state
- level
- assigneeCharacterId
- projectId
- entityType
- dueBefore

## POST /api/approvals
설명:
- 승인건 생성

request:
```json
{
  "entityType": "task",
  "entityId": "task_101",
  "level": "L2",
  "requestedByCharacterId": "char_009",
  "approverCharacterId": "char_003",
  "summary": "Need approval for PRD first draft"
}
```

## POST /api/approvals/:approvalId/approve
## POST /api/approvals/:approvalId/reject
## POST /api/approvals/:approvalId/return-for-revision
## POST /api/approvals/:approvalId/expire

reject / return-for-revision 시 reasonCode 필수.

---

# 5.6 Artifacts

## POST /api/artifacts
설명:
- 산출물 생성/등록

request:
```json
{
  "projectId": "proj_101",
  "taskId": "task_101",
  "artifactType": "PRD",
  "title": "PRD v0.1",
  "contentMarkdown": "# PRD\n...",
  "createdByCharacterId": "char_009",
  "sourceJobId": "job_101"
}
```

artifactType 예시:
- PRD
- ResearchReport
- MarketingCopy
- InvestmentMemo
- CodeSpec
- QAReport
- MeetingNote

## GET /api/artifacts/:artifactId
## GET /api/projects/:projectId/artifacts

버전 원칙:
- artifact는 immutable version append 방식 권장
- 수정은 새 version 생성

---

# 5.7 Event Logs

## GET /api/events
query params:
- projectId
- taskId
- actorCharacterId
- entityType
- eventType
- limit
- cursor

응답 예시:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "evt_9001",
        "eventType": "task.state.changed",
        "entityType": "task",
        "entityId": "task_101",
        "actorCharacterId": "char_009",
        "payload": {
          "from": "Accepted",
          "to": "InProgress"
        },
        "occurredAt": "2026-03-20T01:00:00Z"
      }
    ],
    "nextCursor": null
  }
}
```

---

# 5.8 AI Actions / Async jobs

## POST /api/ai-actions
설명:
- AI 기반 비동기 작업 요청 생성
- 즉시 결과를 주지 않고 jobId를 반환

request:
```json
{
  "projectId": "proj_101",
  "taskId": "task_101",
  "characterId": "char_009",
  "actionType": "generate_prd_draft",
  "input": {
    "goal": "Draft the PRD overview section",
    "constraints": ["concise", "product-led", "Korean"]
  },
  "requestedBy": "founder"
}
```

response:
```json
{
  "ok": true,
  "data": {
    "jobId": "job_2001",
    "status": "queued"
  }
}
```

## GET /api/jobs/:jobId
응답:
- queued
- active
- waitingRetry
- completed
- failed
- cancelled

completed 시 결과 위치:
- artifactId
- outputSummary
- relatedEventIds

---

# 6. Queue / Job 명세

## 6.1 Queue 목록
1. `workflow-transitions`
2. `ai-actions`
3. `approvals`
4. `artifact-postprocess`
5. `analytics-rollups`
6. `notifications`

## 6.2 Job 타입 목록

### workflow-transitions queue
- `project.autoRouteIntake`
- `project.advanceToPlanning`
- `task.autoAssignReviewer`
- `task.resolveBlockedDependency`
- `approval.escalateExpired`

### ai-actions queue
- `ai.generatePlanningDraft`
- `ai.generateMarketingCopy`
- `ai.generateResearchSummary`
- `ai.generateInvestmentMemo`
- `ai.generateCodeSpec`
- `ai.qaReview`
- `ai.summarizeEventWindow`

### approvals queue
- `approval.createForTaskReview`
- `approval.remindApprover`
- `approval.autoExpire`

### artifact-postprocess queue
- `artifact.extractMetadata`
- `artifact.embedForSearch`
- `artifact.linkToKnowledge`

### analytics-rollups queue
- `analytics.rollupCharacterMetrics`
- `analytics.rollupProjectMetrics`
- `analytics.rollupDepartmentMetrics`

### notifications queue
- `notify.founder`
- `notify.approver`
- `notify.assignee`

---

# 7. Job Payload 계약

## 7.1 공통 job envelope
```json
{
  "jobId": "job_2001",
  "jobType": "ai.generatePlanningDraft",
  "requestedBy": "founder",
  "companyId": "company_001",
  "projectId": "proj_101",
  "taskId": "task_101",
  "characterId": "char_009",
  "attempt": 1,
  "priority": "P1",
  "payload": {}
}
```

## 7.2 ai.generatePlanningDraft payload
```json
{
  "goal": "Create PRD overview",
  "inputContext": {
    "projectSummary": "...",
    "taskDescription": "...",
    "existingArtifacts": ["art_301"]
  },
  "constraints": {
    "language": "ko",
    "maxTokensBudget": 12000,
    "style": "practical"
  },
  "outputContract": {
    "artifactType": "PRD",
    "schema": "PlanningDraftV1"
  }
}
```

## 7.3 ai.qaReview payload
```json
{
  "targetArtifactId": "art_500",
  "reviewChecklist": [
    "requirements_clarity",
    "scope_completeness",
    "handoff_readiness"
  ],
  "outputContract": {
    "artifactType": "QAReport",
    "schema": "QaReviewV1"
  }
}
```

---

# 8. Event Type 명세

## 8.1 Event naming 규칙
`domain.entity.action`

예:
- project.created
- project.state.changed
- task.assigned
- task.state.changed
- approval.created
- approval.rejected
- artifact.created
- ai.job.queued
- ai.job.completed
- ai.job.failed
- risk.raised

## 8.2 핵심 event types

### Project
- project.created
- project.updated
- project.state.changed
- project.hold.requested
- project.cancelled

### Task
- task.created
- task.assigned
- task.accepted
- task.started
- task.review.requested
- task.rejected
- task.rework.started
- task.approved
- task.completed
- task.blocked
- task.unblocked

### Approval
- approval.created
- approval.approved
- approval.rejected
- approval.returned
- approval.expired

### Artifact
- artifact.created
- artifact.versioned
- artifact.indexed

### Job
- ai.job.queued
- ai.job.started
- ai.job.retrying
- ai.job.completed
- ai.job.failed

### Runtime
- character.status.changed
- relationship.score.changed
- risk.state.changed

---

# 9. AI Router 계약

## 9.1 목적
모든 AI 호출을 직접 worker에서 외부 API로 때리지 않는다.  
반드시 ai-router 레이어를 통과시킨다.

이유:
- 모델 교체를 쉽게 하기 위해
- 비용/토큰 한도를 중앙에서 통제하기 위해
- structured output / retry / fallback을 공통 처리하기 위해
- 감사로그를 남기기 위해

## 9.2 AI Router 입력 계약
```json
{
  "characterId": "char_009",
  "taskType": "planningDocument",
  "actionType": "generate_prd_draft",
  "inputContext": {},
  "budget": {
    "maxInputTokens": 12000,
    "maxOutputTokens": 3000,
    "maxUsd": 2.5
  },
  "responseSchema": "PlanningDraftV1",
  "policy": {
    "allowToolUse": true,
    "allowWeb": false,
    "strictJson": true
  }
}
```

## 9.3 AI Router 출력 계약
```json
{
  "ok": true,
  "modelUsed": "gpt-x",
  "usage": {
    "inputTokens": 5000,
    "outputTokens": 1200,
    "estimatedUsd": 0.88
  },
  "confidence": 0.79,
  "output": {},
  "warnings": []
}
```

## 9.4 fallback 규칙
1. primary model timeout
2. transient API failure
3. structured output parse fail
4. budget exceeded

fallback 시 원칙:
- 무조건 더 비싼 모델로 가지 않음
- taskType별 fallback matrix 사용
- 최종 실패 시 `LOW_CONFIDENCE` 또는 `MODEL_FAILURE` reason code로 종료

---

# 10. Idempotency / Retry / Deduplication

## 10.1 Idempotency 대상
다음 요청은 idempotency 적용 권장.
- POST /api/projects
- POST /api/tasks
- POST /api/approvals
- POST /api/ai-actions

## 10.2 키 정책
- 클라이언트가 `Idempotency-Key` 제공 시 24시간 보존
- 동일 key + 동일 route + 동일 actor 조합 재호출 시 기존 결과 반환

## 10.3 Retry 정책

### HTTP 재시도
- 클라이언트는 GET만 자동 재시도 허용
- POST 재시도는 idempotency-key 있을 때만 안전

### Worker 재시도
권장:
- maxAttempts: 3
- backoff: exponential
- jitter: enabled

예시:
- 1st retry: 10 sec
- 2nd retry: 60 sec
- 3rd retry: 5 min

## 10.4 중복 방지
동일 taskId + 동일 actionType + 동일 assigneeCharacterId + 동일 input hash 조합으로 5분 내 중복 ai-action 생성 금지.

---

# 11. 오류 코드 체계

## 11.1 네이밍 규칙
`DOMAIN_REASON`

예시:
- PROJECT_INVALID_TRANSITION
- TASK_PERMISSION_DENIED
- APPROVAL_ALREADY_RESOLVED
- JOB_DUPLICATE_REQUEST
- AI_MODEL_TIMEOUT
- ARTIFACT_SCHEMA_INVALID

## 11.2 주요 오류 코드

### Project
- PROJECT_NOT_FOUND
- PROJECT_INVALID_TRANSITION
- PROJECT_PERMISSION_DENIED
- PROJECT_ALREADY_CANCELLED

### Task
- TASK_NOT_FOUND
- TASK_INVALID_TRANSITION
- TASK_ALREADY_BLOCKED
- TASK_ASSIGNEE_MISMATCH
- TASK_PERMISSION_DENIED

### Approval
- APPROVAL_NOT_FOUND
- APPROVAL_ALREADY_RESOLVED
- APPROVAL_INVALID_LEVEL
- APPROVAL_PERMISSION_DENIED

### Job / AI
- JOB_NOT_FOUND
- JOB_DUPLICATE_REQUEST
- AI_MODEL_TIMEOUT
- AI_MODEL_FAILURE
- AI_OUTPUT_SCHEMA_INVALID
- AI_BUDGET_EXCEEDED

### Artifact
- ARTIFACT_NOT_FOUND
- ARTIFACT_VERSION_CONFLICT
- ARTIFACT_SCHEMA_INVALID

---

# 12. 실패 / 예외 처리 규칙

## 12.1 프로젝트 취소 시
- 하위 task가 Done/Cancelled가 아닌 경우 자동 Cancelled 처리 후보 생성
- 이미 진행 중 task는 force cancel 대신 block + founder confirm 가능
- approval pending 건은 Expired 또는 Cancelled 처리

## 12.2 승인 만료 시
- approval.state = Expired
- event log 생성
- approver / founder notification 생성
- 필요 시 risk 상태 상향

## 12.3 AI 작업 실패 시
- job status = failed
- failure reason 저장
- artifact는 생성하지 않음
- event log 생성
- retry 가능한 유형이면 waitingRetry
- 최종 실패면 founder/owner에게 visible alert

## 12.4 schema parse 실패 시
- 1차: same model retry with repair prompt
- 2차: fallback model
- 3차: fail with AI_OUTPUT_SCHEMA_INVALID

## 12.5 assignee overload 시
- task assignment는 허용 가능하되 warning 반환
- P0/P1이 아니면 assignment 거절 가능

---

# 13. API/Worker 구현 순서

## 13.1 1차 구현
- GET /api/health
- POST /api/projects
- GET /api/projects
- GET /api/projects/:id
- POST /api/tasks
- POST /api/tasks/:id/accept
- POST /api/tasks/:id/start
- POST /api/tasks/:id/request-review
- GET /api/events
- POST /api/ai-actions
- GET /api/jobs/:id

## 13.2 2차 구현
- approvals CRUD/actions
- artifacts
- block/unblock
- reject/rework/approve/complete
- character directory/detail

## 13.3 3차 구현
- analytics rollups
- risk register
- knowledge indexing
- notifications

---

# 14. 최소 OpenAPI 스타일 예시

## POST /api/projects

```yaml
post:
  summary: Create project
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          required:
            - title
            - businessType
            - priority
          properties:
            title:
              type: string
            businessType:
              type: string
              enum: [appPlanning, marketing, researchInvestment, engineering]
            priority:
              type: string
              enum: [P0, P1, P2, P3, P4]
            goal:
              type: string
            description:
              type: string
  responses:
    "200":
      description: Created
```

---

# 15. FE / BE / Worker 책임 분리

## web
- 사용자 입력 수집
- 조회 화면 렌더링
- optimistic UI 최소 적용
- 장기 작업은 polling/event feed로 추적

## api
- auth / validation / authorization
- workflow command acceptance
- transaction handling
- persistence
- event log 기록
- job enqueue

## worker
- 장기 실행
- AI 호출
- artifact 후처리
- analytics rollup
- notification dispatch

금지 원칙:
- web이 외부 AI 직접 호출 금지
- worker가 DB 정합성 룰 임의 변경 금지
- api가 장시간 AI 호출 동기 처리 금지

---

# 16. Definition of Done for 09
다음 조건을 충족하면 09 문서를 구현 가능한 수준으로 본다.

1. web팀이 어떤 endpoint를 호출해야 하는지 안다.
2. api팀이 어떤 route와 payload를 만들어야 하는지 안다.
3. worker팀이 어떤 queue와 job type을 구현해야 하는지 안다.
4. ai-router팀이 어떤 입력/출력 계약을 지켜야 하는지 안다.
5. 실패 케이스와 reason code가 최소 수준으로 정리되어 있다.

---

# 17. 다음 문서 연결
다음 문서 추천:
**10_BLOKS_world_runtime_and_isometric_rules_v0.1.md**

이유:
09가 시스템의 혈관이라면,
10은 BLOKS가 실제로 “살아 움직이는 회사”처럼 보이게 만드는 물리 법칙과 연출 법칙을 정한다.
