# 07_BLOKS_build_stack_and_repo_structure_v0.1

## 문서 성격
**Build-Spec**

이 문서는 BLOKS를 실제로 만들기 위한 **개발 착수용 기술 설계 문서**다.
이전 문서들이 “무엇을 만들 것인가”를 정의했다면, 이 문서는 “무엇으로, 어떻게 조립할 것인가”를 결정한다.

이 문서의 목표는 다음 4가지다.

1. 기술 스택을 확정한다.
2. 모노레포 구조와 각 패키지의 책임을 확정한다.
3. 런타임 흐름, AI 오케스트레이션, 작업 큐, 로그, 실시간 전략을 구체화한다.
4. 개발자가 이 문서를 보고 바로 첫 리포지토리 스캐폴드와 첫 커밋을 시작할 수 있게 만든다.

---

# 1. 설계 결정 요약

## 1.1 BLOKS MVP 기술 방향 한 줄 요약
BLOKS MVP는 **“데스크톱 우선 아이소메트릭 운영 UI + 업무 상태머신 + AI 오케스트레이션 워커 + PostgreSQL 중심 기록 시스템”** 구조로 설계한다.

## 1.2 이번 문서에서 확정하는 핵심 결정

### 결정 1. 프론트엔드는 Next.js + React + TypeScript로 간다.
이유:
- 화면 수가 많고, 운영 패널/상세화면/내비게이션/서버 액션/라우팅이 중요하다.
- 아이소메트릭 월드가 핵심이지만, 제품 전체는 게임보다 운영툴에 가깝다.
- SSR/서버 컴포넌트/데이터 페칭/권한 처리 측면에서 유리하다.

### 결정 2. 월드 뷰는 Phaser보다 PixiJS 계열을 우선한다.
이유:
- BLOKS의 핵심은 전투 게임이 아니라 **시각화된 회사 운영 UI**다.
- 물리, 충돌, 맵 기반 상호작용은 필요하지만, 전형적 게임 루프가 제품의 중심은 아니다.
- 그래서 게임 엔진 전체보다 2D 렌더링/애니메이션/스프라이트/이벤트 제어에 강한 계층이 더 적합하다.

### 결정 3. 백엔드는 API 서버와 워커를 분리한다.
이유:
- AI 호출, 승인 흐름, 상태 전이, 로그 적재, 요약 작업은 HTTP 요청-응답 수명 안에서 다 처리하면 안 된다.
- API는 빠르게 응답하고, 무거운 처리/AI 실행/후처리는 워커가 맡아야 한다.

### 결정 4. DB는 PostgreSQL을 시스템 오브 레코드로 사용한다.
이유:
- Project/Task/Approval/Event/Artifact/Character 관계가 많고 정합성이 중요하다.
- ERP/WF 스타일 데이터는 관계형 모델이 유리하다.
- Event Log, Approval, Audit, Memory Reference도 SQL로 관리하기 좋다.

### 결정 5. 비동기 작업은 Redis + BullMQ 계열 큐를 사용한다.
이유:
- AI 작업, 승인 후 후속처리, 로그 집계, 재시도, 부모-자식 작업 흐름이 필요하다.
- 작업 실패/재시도/스케줄링/체인 처리가 중요하다.

### 결정 6. AI 호출은 앱 곳곳에서 직접 하지 않고 AI Router 계층 하나로 모은다.
이유:
- 모델 교체, 비용 제어, fallback, logging, structured output, timeout 정책을 중앙에서 통제해야 한다.
- 캐릭터마다 자아는 달라도 회사의 안전 규칙과 예산 규칙은 공통이어야 한다.

### 결정 7. 실시간은 “실시간처럼 보이게” 만들되, MVP는 완전 실시간 엔진으로 가지 않는다.
이유:
- MVP에서 진짜 게임급 동기화는 비용과 복잡도를 폭증시킨다.
- Active Core 중심의 주기적 스냅샷 + 이벤트 푸시 + 국소적 실시간 갱신이면 충분하다.

---

# 2. 기술 선택안과 채택 이유

## 2.1 Frontend

### 채택
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- Zustand (전역 클라이언트 상태 모달, 아이소메트릭 월드 동기화용)
- React Query 또는 SWR (서버 Snapshot Polling API 캐싱용)

### 채택 이유
- Next.js App Router는 파일 시스템 기반 라우팅과 레이아웃 구조를 제공하고, Server Components, Suspense, Server Functions를 포함한 최신 React 기능을 지원한다.
- `create-next-app` 기본 설정은 TypeScript, Tailwind CSS, ESLint, App Router, Turbopack까지 포함하며 Node.js 20.9 이상을 요구한다.
- Next.js는 TypeScript를 기본 지원한다.

### 왜 적합한가
BLOKS는 다음 두 축을 동시에 가져간다.
- 운영 화면(Projects, Approvals, Analytics, Knowledge)
- 시각 월드 화면(World)

즉, 전체 앱은 **복합 업무 웹앱**이고, 월드 뷰는 그 안에 포함되는 특수 UI다.
따라서 전체를 게임 엔진 중심으로 짜는 것보다, 웹앱 프레임워크 위에 렌더 레이어를 얹는 쪽이 더 맞다.

### 대안과 폐기 이유
#### 대안 A. Vite + React
- 장점: 가볍고 빠름
- 폐기 이유: 라우팅/서버 경계/운영 패널/SSR/서버 액션/프로덕션 구조에서 Next.js가 더 자연스럽다.

#### 대안 B. Phaser 중심 앱
- 장점: 게임 루프, 맵, 충돌, 카메라 제어에 강함
- 폐기 이유: BLOKS는 운영 시스템이 본체이지, 전투/맵 중심 게임이 본체가 아니다. UI/운영툴 복잡도가 더 크다.

#### 대안 C. Electron 우선
- 장점: 데스크톱 앱처럼 보일 수 있음
- 폐기 이유: MVP에서 배포 복잡도만 늘어난다. 웹 우선으로 검증 후 데스크톱 래핑 검토가 맞다.

---

## 2.2 World Rendering Layer

### 채택
- PixiJS
- React 래퍼는 최소화하고, canvas 계층은 얇게 유지

### 채택 이유
- PixiJS는 빠르고 유연한 2D WebGL 렌더링 엔진을 표방하고 있으며, 8.x 문서 기준으로 현재도 적극 제공된다.
- PixiJS 공식 Quick Start는 Node.js 20.0 이상을 전제로 새 프로젝트를 만드는 흐름을 제공한다.
- BLOKS 월드는 복잡한 물리 엔진보다 **스프라이트, 맵, 부드러운 이동, 상태 배지, 클릭/하이라이트, 레이어드 렌더링**이 중요하다.

### 왜 Phaser보다 PixiJS 우선인가
BLOKS MVP의 월드는 다음 특성을 가진다.
- 전투 없음
- 고난도 물리 없음
- 타일 맵 + 구역 이동 + 상태 연출 중심
- 운영 패널과의 상태 동기화가 더 중요

따라서 게임 엔진 전체보다는 **렌더링 중심 2D 엔진**이 맞다.
다만 이후 아래 조건이면 Phaser 재검토 가능하다.
- 타일맵 이벤트가 매우 복잡해짐
- 이동/충돌/경로탐색이 훨씬 무거워짐
- 미니게임 수준 상호작용이 추가됨

### 구현 원칙
- 월드 뷰는 “하나의 독립 렌더 모듈”로 취급한다.
- 앱 전체 상태를 월드 엔진이 소유하면 안 된다.
- World Renderer는 외부에서 받은 state snapshot만 시각화한다.

---

## 2.3 Backend API

### 채택
- Node.js + TypeScript
- Fastify 또는 Express 계열 중 **Fastify 우선 추천**

### 채택 이유
- 타입 공유, JSON API, 큐 연동, AI Router, 이벤트 처리, 내부 패키지 공유에 유리하다.
- 웹앱과 타입을 공유하기 쉽다.
- Worker와 동일 언어/런타임으로 유지 가능하다.

### 왜 NestJS는 지금 안 쓰나
- 장점은 크지만 초반엔 구조가 무거워질 수 있다.
- BLOKS는 이미 도메인 복잡도가 높아서 프레임워크 무게까지 더하면 오히려 초기 속도가 떨어질 수 있다.
- 팀이 커지거나 엔터프라이즈 복잡도가 더 올라가면 추후 검토 가능하다.

### API 서버의 책임
- 인증/세션
- CRUD API
- 상태 전이 요청 수신
- 권한 검증
- Project/Task/Approval/Event 조회
- 워커 job enqueue
- UI용 read model 제공

### API 서버의 금지 책임
- 긴 AI 생성 작업 직접 처리
- 대량 리포트 집계 직접 처리
- 큐 재시도 루프 직접 처리
- 장기 워크플로우 보관 로직 직접 처리

---

## 2.4 Database

### 채택
- PostgreSQL (Vector 데이터 검색을 위한 `pgvector` 확장 필수 적용)
- ORM은 Prisma 우선 추천

### 채택 이유
- Prisma ORM은 타입 안전한 접근을 제공하며 Postgres와 잘 맞는다.
- BLOKS는 ERD가 비교적 복잡하고, 개발 초기에 타입 안전성과 마이그레이션 편의성이 중요하다.

### PostgreSQL을 시스템 오브 레코드로 두는 이유
다음 데이터는 강한 정합성이 필요하다.
- Character
- Rank / Role / Department
- Project
- Task
- Approval
- Artifact
- Event Log
- KPI Snapshot
- Relationship
- Audit Log

이런 구조는 관계형 DB가 훨씬 낫다.

### DB 설계 원칙
- 상태값은 enum 또는 제한된 text domain으로 통제한다.
- Event Log는 append-only 성격을 유지한다.
- 캐릭터 런타임 상태는 snapshot 테이블과 event log를 분리한다.
- AI 원문 응답 전체는 직접 DB에 무제한 저장하지 않고, 요약본/참조본/원문 저장소 포인터를 나눠 저장한다.

### 장기 확장 여지
- 벡터 검색 레이어 추가
- 분석용 읽기 전용 리포팅 DB 분리
- 이벤트 스트림 별도 적재

---

## 2.5 Queue / Worker

### 채택
- Redis
- BullMQ

### 공식 근거 관점
- BullMQ는 Redis 위에 구축된 Node.js 큐 시스템으로 소개된다.
- Worker는 큐의 job을 처리하는 실제 실행자이며, 실패한 job은 재시도 전략을 둘 수 있다.
- BullMQ의 Flows는 부모-자식 작업 트리를 표현할 수 있다.
- Redis Pub/Sub은 공식 문서상 at-most-once delivery이므로, 중요한 업무 실행 경로를 Pub/Sub만으로 구성하는 것은 부적절하다.
- Redis Streams는 append-only log 성격의 구조를 제공한다.

### 왜 BullMQ가 BLOKS에 맞는가
BLOKS는 다음 작업이 많다.
- PRD 초안 생성
- 요약 생성
- 승인 후 하위 태스크 트리거
- QA 재검토
- 야간 KPI 집계
- 캐릭터 메모리 요약
- 리스크 스캔

이런 작업은 “바로 HTTP 응답에서 끝내는 일”이 아니라 **재시도 가능한 job**이다.

### 큐 사용 원칙
- 모든 AI 호출을 큐로 보내는 것은 아님
- 사용자 상호작용에 즉시 응답해야 하는 짧은 작업은 동기 호출 가능
- 3초 이상 걸릴 가능성이 높거나, 후속 단계가 있는 작업은 큐로 보낸다.

### 대표 큐 종류
- `project-lifecycle`
- `task-execution`
- `approval-processing`
- `artifact-generation`
- `analytics-rollup`
- `memory-maintenance`
- `world-state-refresh`

### BullMQ Flow가 특히 필요한 영역
예:
- Project kickoff
  - child: create planning tasks
  - child: assign PMO
  - child: notify relevant heads
- Approval success
  - child: mark artifact approved
  - child: open next task
  - child: log audit record

---

## 2.6 AI Layer

### 채택
- OpenAI Responses API 중심
- 내부 `ai-router` 패키지로 추상화
- structured outputs 우선

### 채택 이유
- OpenAI 공식 문서는 Responses API를 새 프로젝트에 권장한다.
- 최신 OpenAI 모델은 Responses API와 SDK를 통해 제공된다.
- Structured Outputs는 JSON mode보다 스키마 준수 측면에서 강하게 권장된다.

### AI Router 계층이 필요한 이유
AI를 각 화면/서비스에서 직접 부르면 안 된다.
다음 문제를 통제해야 하기 때문이다.
- 모델별 비용
- timeout
- retry
- structured output validation
- low-confidence fallback
- logging
- privacy / redaction
- character policy injection
- tool permission

### AI Router 기본 인터페이스
```ts
export type AgentRunInput = {
  characterId: string
  taskType: string
  objective: string
  contextRefs: string[]
  outputSchemaName: string
  maxBudgetUsd?: number
  maxLatencyMs?: number
}

export type AgentRunResult = {
  status: "success" | "failed" | "needs_review"
  model: string
  tokensIn: number
  tokensOut: number
  latencyMs: number
  confidenceScore: number
  output: unknown
  warnings: string[]
}
```

### AI Router 책임
- 모델 선택
- prompt composition
- policy 주입
- tool allowance 주입
- schema enforcement
- response validation
- cost logging
- failure classification

### AI Router 금지 책임
- Project/Task 직접 상태 변경
- 권한 판단 최종 결정
- UI용 HTML 생성
- DB schema를 우회한 임의 저장

---

# 3. 권장 모노레포 구조

## 3.1 모노레포 채택 이유
BLOKS는 다음 자산을 여러 레이어가 공유해야 한다.
- 타입
- 상태 enum
- event schema
- approval rule constants
- AI prompt templates
- UI component tokens
- shared validation schema

이런 시스템을 분리 레포로 시작하면 초반 오버헤드가 크다.
초기에는 **모노레포**가 훨씬 현실적이다.

## 3.2 권장 루트 구조
```text
BLOKS/
  apps/
    web/
    api/
    worker/
  packages/
    ui/
    types/
    config/
    db/
    engine/
    ai-router/
    prompts/
    world/
    analytics/
    auth/
  infra/
    docker/
    scripts/
    seeds/
  docs/
  .env.example
  package.json
  pnpm-workspace.yaml
  turbo.json
  README.md
```

## 3.3 package manager
- pnpm 권장

이유:
- 모노레포에서 의존성 관리 효율이 좋다.
- workspace 사용이 자연스럽다.
- Turborepo와 궁합이 좋다.

## 3.4 task runner
- Turborepo 권장

이유:
- package graph를 기준으로 task를 실행한다.
- 내부 패키지 의존성에 따라 build/test/lint 순서를 구성하기 좋다.
- BLOKS처럼 패키지 공유가 많은 구조에 적합하다.

---

# 4. 각 앱/패키지의 책임 정의

## 4.1 `apps/web`
### 역할
사용자가 실제로 보는 웹 애플리케이션.

### 포함 책임
- App Router 페이지
- 인증 후 UI shell
- World 화면
- Projects / Characters / Approvals / Analytics / Knowledge 화면
- 클라이언트 상호작용
- 서버 액션 또는 API 연동

### 포함하면 안 되는 것
- 긴 AI 생성 로직
- 장기 큐 처리
- DB business logic의 본체

### 예상 하위 구조
```text
apps/web/
  app/
    (dashboard)/
      world/
      projects/
      characters/
      approvals/
      analytics/
      knowledge/
    api/
  components/
  features/
  hooks/
  lib/
  styles/
```

---

## 4.2 `apps/api`
### 역할
REST API / internal API / read model 공급자

### 포함 책임
- 인증/세션 검증
- CRUD 엔드포인트
- 상태 전이 엔드포인트
- 승인 액션 엔드포인트
- queue enqueue
- read model assembling
- websocket/sse publisher

### 포함하면 안 되는 것
- 장시간 AI inference 본체
- 무거운 배치 집계

### 예상 하위 구조
```text
apps/api/
  src/
    routes/
    services/
    controllers/
    repositories/
    middleware/
    publishers/
    validators/
```

---

## 4.3 `apps/worker`
### 역할
비동기 작업 실행자

### 포함 책임
- 큐 consumer
- AI generation jobs
- approval 후속처리
- analytics 집계
- memory maintenance
- world snapshot refresh

### 포함하면 안 되는 것
- 사용자 인터랙티브 UI 처리
- 복잡한 인증 로직

### 예상 하위 구조
```text
apps/worker/
  src/
    jobs/
    processors/
    schedulers/
    orchestration/
    retries/
```

---

## 4.4 `packages/types`
### 역할
공유 타입, enum, DTO, schema type 선언

### 포함 항목
- ProjectState
- TaskState
- ApprovalState
- CharacterActivityState
- RiskState
- ReasonCode
- API request/response type
- event payload type

### 절대 금지
- DB access
- side effects

---

## 4.5 `packages/db`
### 역할
DB schema, ORM client, migrations, seed, repository helper

### 포함 항목
- Prisma schema
- generated client
- repository helper
- transaction helper
- seed scripts

### 절대 금지
- UI logic
- prompt logic

---

## 4.6 `packages/engine`
### 역할
BLOKS의 핵심 도메인 규칙 엔진

### 포함 항목
- workflow transition rules
- approval matrix evaluator
- SLA evaluator
- workload calculator
- recommendation rules
- state validators

### 왜 중요한가
이 패키지가 BLOKS의 “룰 북”이다.
web/api/worker가 이 룰을 공유해야 한다.

### 절대 금지
- DB 직접 접근
- HTTP dependency
- rendering dependency

---

## 4.7 `packages/ai-router`
### 역할
모든 AI 요청의 진입점 및 지식/기억 검색(RAG) 파이프라인 전담

### 포함 항목
- model selector
- prompt builder
- schema validator
- vector embedder & searcher (pgvector 쿼리 실행)
- retry/fallback/timeout
- usage logger (소모된 토큰을 실제 USD $ 비용으로 역산하여 DB에 업데이트)
- provider adapter

### 절대 금지
- 프로젝트 상태 직접 갱신
- 유저 권한 판단 직접 수행

---

## 4.8 `packages/prompts`
### 역할
캐릭터/부서/작업별 프롬프트 템플릿과 정책 문서 저장

### 구성 예시
```text
packages/prompts/
  system/
  company-policy/
  roles/
  departments/
  tasks/
  output-schemas/
```

### 원칙
- 프롬프트는 코드 안에 하드코딩하지 않는다.
- 최소한 system/company/role/task 레이어를 분리한다.

---

## 4.9 `packages/world`
### 역할
아이소메트릭 월드 렌더링 로직과 world-specific state adapter

### 포함 항목
- room layout config
- sprite registry
- world event mapper
- camera logic
- character marker rendering
- zone occupancy visualizer

### 절대 금지
- Project business logic 전체 소유
- 서버 권한 로직

---

## 4.10 `packages/ui`
### 역할
공통 UI 컴포넌트 시스템

### 포함 항목
- StatusBadge
- PriorityChip
- EntityCard
- SidebarLayout
- KPIWidget
- ApprovalQueueTable
- Drawer / Modal / Tabs

---

## 4.11 `packages/analytics`
### 역할
운영 지표 계산/집계 로직

### 포함 항목
- 리드타임 집계
- 승인 통과율 집계
- 부서별 workload rollup
- overload detection helper
- dashboard DTO builder

---

## 4.12 `packages/auth`
### 역할
인증/권한 공통 계층

### MVP 원칙
- Founder 단일 사용자 또는 소수 관리자 우선
- 복잡한 조직별 멀티테넌시는 후순위

---

# 5. 런타임 아키텍처

## 5.1 전체 그림
```text
Founder UI (web)
  -> API
    -> DB (record)
    -> Engine (rule check)
    -> Queue enqueue
      -> Worker
        -> AI Router
          -> Model provider
        -> DB update
        -> Event log append
        -> Publish update
  -> Web receives snapshot / event update
  -> World/UI refresh
```

## 5.2 핵심 원칙
- 사용자 요청과 장기 실행은 분리한다.
- 상태 전이는 Engine을 거쳐야 한다.
- AI 결과는 검증 없이 바로 확정하지 않는다.
- 모든 중요한 변경은 Event Log를 남긴다.
- UI는 DB truth + event feed를 혼합해서 보여준다.

---

# 6. 주요 도메인 플로우 상세

## 6.1 플로우 A — Founder가 새 프로젝트 생성

### 단계
1. Founder가 `Create Project` 실행
2. `apps/web`가 API 호출
3. `apps/api`는 입력 검증
4. `packages/engine`가 초기 상태와 priority rule 확인
5. DB에 Project `Intake` 생성
6. Event Log append: `project.created`
7. Queue에 `project.intake.process` enqueue
8. Worker가 COO/PMO 할당 후보 계산
9. Project owner assignment 업데이트
10. Event Log append: `project.assigned`
11. UI에 snapshot 반영

### 실패 시 처리
- 입력 누락: API 400
- rule invalid: API 422
- queue enqueue 실패: DB rollback 또는 retry-safe 보상 처리

---

## 6.2 플로우 B — AI 캐릭터가 PRD 초안을 생성

### 단계
1. PMO가 Task 생성
2. Task 상태 `Created -> Assigned`
3. assignee 수락 시 `Accepted`
4. API는 `task.execution.requested` job enqueue
5. Worker는 character profile, policy, project context, output schema 로드
6. AI Router가 모델 선택
7. Responses API 호출
8. structured output 검증
9. Artifact 초안 저장
10. Task 상태 `In Progress -> Pending Review`
11. Approval queue 생성
12. Event Log append

### 실패 시 처리
- schema mismatch: retry 1회 후 `needs_review`
- timeout: fallback model 또는 `Blocked`
- low confidence: auto-escalation to reviewer

---

## 6.3 플로우 C — 승인 처리

### 단계
1. Approval Center에서 승인 대상 조회
2. 검토자가 승인 또는 반려
3. API는 권한 검증
4. engine이 현재 승인 레벨/전이 가능성 확인
5. Approval 상태 변경
6. 결과에 따라 상위 승인 큐 또는 원작업 재작업 상태 전환
7. Audit Log append
8. Event Log append
9. UI feed 갱신

### 반려 시 추가 규칙
- reason_code 필수
- comment 최소 길이 설정 가능
- 관련 Task는 `Rejected` 또는 `Rework`로 이동

---

## 6.4 플로우 D — 월드 상태 반영

### 단계
1. Task/Approval/Character 상태 변경 발생
2. Event Log append
3. Projection updater가 world snapshot용 read model 갱신
4. Web은 SSE/WebSocket 또는 polling으로 최신 snapshot 수신
5. World renderer가 해당 캐릭터 위치/배지/구역 점유 상태 갱신

### 핵심 포인트
월드는 DB truth를 직접 조작하지 않는다.
월드는 read model을 **그려주는 소비자**다.

---

# 7. 이벤트 기반 설계

## 7.1 Event naming 규칙
`domain.entity.action`

예:
- `project.created`
- `project.state.changed`
- `task.assigned`
- `task.blocked`
- `approval.requested`
- `approval.approved`
- `artifact.generated`
- `character.activity.changed`
- `risk.raised`

## 7.2 최소 이벤트 payload 예시
```json
{
  "eventId": "evt_01",
  "eventName": "task.assigned",
  "occurredAt": "2026-03-20T10:00:00Z",
  "actorType": "system",
  "actorId": "sys_api",
  "entityType": "task",
  "entityId": "task_123",
  "projectId": "proj_001",
  "payload": {
    "assigneeCharacterId": "char_strategy_02",
    "previousState": "Created",
    "nextState": "Assigned"
  }
}
```

## 7.3 Event Log와 Audit Log 구분
### Event Log
- 시스템 변화의 기록
- UI feed, analytics, timeline, read model projection용

### Audit Log
- 누가 어떤 권한으로 어떤 결정을 내렸는지
- compliance / override / approval 추적용

둘은 겹치지만 동일하지 않다.

---

# 8. 상태 전이와 엔진 경계

## 8.1 전이 함수 예시
```ts
transitionTask({
  taskId,
  actor,
  requestedNextState,
  reasonCode,
  comment,
})
```

## 8.2 엔진이 해야 하는 검사
- 현재 상태에서 해당 전이가 합법인가
- actor 권한이 충분한가
- 필수 reason code가 있는가
- 선행 조건이 충족되는가
- 하위/상위 엔티티와 충돌하지 않는가
- 승인 상태와 모순되지 않는가

## 8.3 엔진이 반환해야 할 것
- success / failure
- normalized next state
- generated side effects
- events to append
- follow-up jobs to enqueue

---

# 9. AI 오케스트레이션 상세

## 9.1 캐릭터 실행 입력 구성 레이어
AI 캐릭터에게 전달되는 입력은 아래 순서로 조립한다.

1. System rules
2. Company policy
3. Department policy
4. Role spec
5. Character persona
6. Vector Memory RAG (과거 유사 업무 피드백 및 Knowledge 매칭 데이터)
7. Task objective
8. Context refs
9. Output schema
10. Budget / latency / safety limits

## 9.2 Prompt composition 예시 구조
```text
[system]
You are operating inside BLOKS under company rules...

[company-policy]
Never self-approve. Escalate if confidence is low...

[department-policy]
Planning artifacts must be structured and testable...

[role-spec]
You are a Senior Product Strategist...

[persona]
Tone: calm, sharp, user-focused...

[task]
Draft a PRD outline for ...

[output-schema]
Return JSON with fields...
```

## 9.3 캐릭터별 모델 프로필 필드
- `primaryModel`
- `fallbackModel`
- `maxBudgetUsdPerTask`
- `maxLatencyMs`
- `preferredTaskTypes`
- `reviewStrictness`
- `toolAccessLevel`
- `structuredOutputRequired`

## 9.4 low-confidence 규칙
AI Router는 다음 중 하나면 `needs_review`를 반환한다.
- schema는 맞았지만 내용 공백이 과다함
- self-reported uncertainty가 높음
- source/context 부족
- timeout 직전 truncated output
- internal validator score 미달

## 9.5 tool permission 원칙
캐릭터가 어떤 tool을 쓸 수 있는지 명시적으로 제한한다.
예:
- Research 계열: web search 허용
- Investment 계열: calculator, report tools 허용
- Planner 계열: knowledge vault read 허용
- QA 계열: validation tools 허용
- 일반 캐릭터: 임의 외부 호출 금지

## 9.6 retry 원칙
- 동일 입력 무한 재시도 금지
- 기본 1회 retry
- fallback model 1회 허용
- 그 이후 `Blocked` 또는 `needs_review`

## 9.7 비용 가드레일
- task 단위 예산 상한
- project 단위 일일 예산 상한
- high-reasoning 모델은 P0/P1 또는 승인된 경우만 허용
- idle chatter 금지
- background summarization은 저비용 모델 우선

---

# 10. 실시간 전략

## 10.1 목표
“진짜 실시간 게임”이 아니라 **“실시간처럼 느껴지는 운영 경험”**을 제공한다.

## 10.2 권장 전략
혼합형.
- DB truth는 서버에 있음
- UI는 snapshot 기반 렌더링
- 중요한 변화는 SSE 또는 WebSocket으로 push
- 덜 중요한 정보는 polling으로 갱신

## 10.3 왜 pure WebSocket-only가 아닌가
- 모든 패널을 초기에 완전 양방향 실시간화할 필요가 없다.
- read-heavy 화면이 많다.
- MVP는 구현 복잡도를 낮춰야 한다.

## 10.4 추천 갱신 모델
### World screen
- 2~5초 주기 snapshot refresh
- 중요한 이벤트는 push
- 캐릭터 이동은 로컬 interpolation 허용

### Project / Approval 화면
- mutation 후 즉시 refetch
- 중요 알림은 push

### Analytics
- 실시간보다 주기적 갱신

## 10.5 캐릭터 이동 전략
- DB에는 “정확한 픽셀 좌표” 대신 `zone`, `subzone`, `activityState`를 우선 저장
- 클라이언트 렌더러가 zone 안에서 부드럽게 배치/보간
- MVP에서는 진짜 pathfinding 최소화

---

# 11. 인증 / 권한 전략

## 11.1 MVP 원칙
- Founder 중심 단일 사용자 또는 소수 관리자
- 복잡한 RBAC 멀티테넌시는 후순위

## 11.2 기본 역할
- Founder
- Admin
- Observer

## 11.3 핵심 권한 체크 포인트
- project create/update/cancel
- approval action
- override action
- character assignment
- model policy change
- prompt template change

## 11.4 캐릭터 권한과 사용자 권한 구분
중요.
- 사람 사용자 권한
- AI 캐릭터 조직 권한

이 둘을 섞지 않는다.
예를 들어 캐릭터 CEO가 `approve`할 수 있어도, 실제 시스템 호출은 사용자/시스템 권한 모델 안에서 실행된다.

---

# 12. 환경 변수 설계

## 12.1 루트 `.env.example` 초안
```bash
NODE_ENV=development
NEXT_PUBLIC_APP_NAME=BLOKS
DATABASE_URL=
REDIS_URL=
OPENAI_API_KEY=
OPENAI_PROJECT_ID=
SESSION_SECRET=
APP_BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:4000
WORKER_CONCURRENCY_DEFAULT=4
AI_DEFAULT_TIMEOUT_MS=45000
AI_DEFAULT_MAX_BUDGET_USD=0.50
WORLD_SNAPSHOT_INTERVAL_MS=3000
LOG_LEVEL=info
```

## 12.2 보안 원칙
- 브라우저 노출 값은 `NEXT_PUBLIC_`만 허용
- AI key는 web 앱에 절대 직접 노출 금지
- worker 전용 환경 변수와 api 전용 변수 구분

---

# 13. API 설계 초안

## 13.1 Project
- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `POST /projects/:id/transition`
- `POST /projects/:id/hold`
- `POST /projects/:id/cancel`

## 13.2 Task
- `POST /tasks`
- `GET /tasks/:id`
- `POST /tasks/:id/assign`
- `POST /tasks/:id/accept`
- `POST /tasks/:id/transition`
- `POST /tasks/:id/request-review`

## 13.3 Approval
- `GET /approvals`
- `GET /approvals/:id`
- `POST /approvals/:id/approve`
- `POST /approvals/:id/reject`
- `POST /approvals/:id/return`

## 13.4 Characters
- `GET /characters`
- `GET /characters/:id`
- `POST /characters/:id/assign-task`
- `POST /characters/:id/set-activity`

## 13.5 World / Snapshot
- `GET /world/snapshot`
- `GET /world/events/stream`

## 13.6 Analytics
- `GET /analytics/overview`
- `GET /analytics/departments`
- `GET /analytics/characters`

## 13.7 Knowledge / Artifacts
- `GET /artifacts`
- `GET /artifacts/:id`
- `POST /artifacts/:id/request-approval`

---

# 14. Job type 설계 초안

## 14.1 Queue name / Job name

### `project-lifecycle`
- `project.intake.process`
- `project.qualify.evaluate`
- `project.archive.finalize`

### `task-execution`
- `task.execute.ai`
- `task.rework.ai`
- `task.assignment.recommend`

### `approval-processing`
- `approval.advance`
- `approval.rejection.handle`
- `approval.expiry.scan`

### `artifact-generation`
- `artifact.prd.generate`
- `artifact.report.generate`
- `artifact.copy.generate`
- `artifact.summary.generate`

### `analytics-rollup`
- `analytics.daily.rollup`
- `analytics.workload.refresh`
- `analytics.kpi.snapshot`

### `memory-maintenance`
- `memory.character.summarize`
- `memory.project.compact`

### `world-state-refresh`
- `world.snapshot.rebuild`
- `world.zone.occupancy.refresh`

---

# 15. 실패/예외 처리 전략

## 15.1 AI 실패
### 케이스
- provider timeout
- malformed output
- schema mismatch
- budget exceeded
- policy violation

### 처리
- classify failure
- retry once if transient
- fallback model once if allowed
- final failure 시 task status를 `Blocked` 또는 `Pending Review`로 이동
- reason code 저장

## 15.2 상태 전이 충돌
예:
- 이미 승인된 task를 다시 reject 시도
- cancelled project 하위 task 실행 시도

처리:
- engine에서 reject
- API 409
- audit log 남김

## 15.3 큐 중복 실행
처리:
- idempotency key 사용
- 동일 task 동일 단계 job은 dedupe

## 15.4 승인 만료
처리:
- `approval.expiry.scan`이 `Expired` 처리
- Risk 상태 상향 가능
- PMO/Founder 알림

## 15.5 월드 UI 지연
처리:
- snapshot stale indicator 표시
- 마지막 갱신 시각 노출
- 월드가 truth가 아니라는 점을 구조적으로 유지

---

# 16. 로깅 / 모니터링 전략

## 16.1 로그 종류
- app log
- job log
- ai usage log
- event log
- audit log
- error log

## 16.2 최소 추적 항목
- request id
- user id
- project id
- task id
- character id
- job id
- model name
- latency
- token usage
- cost estimate

## 16.3 대시보드에 반드시 보일 것
- failed jobs count
- stuck approvals count
- blocked tasks count
- AI timeout count
- top costly characters/tasks

---

# 17. 초기 DB / 패키지 / 앱 생성 순서

## 17.1 Day 1 scaffold
1. monorepo init
2. apps/web 생성
3. apps/api 생성
4. apps/worker 생성
5. packages/types 생성
6. packages/config 생성
7. packages/db 생성
8. packages/engine 생성
9. packages/ai-router 생성
10. turbo/pnpm 설정

## 17.2 Day 2 domain setup
1. enum/type 정의
2. prisma schema 초안
3. engine 전이 함수 초안
4. event payload type 정의
5. API health + basic CRUD

## 17.3 Day 3 async path
1. Redis 연결
2. BullMQ queue 생성
3. sample worker job
4. AI Router mock provider 연결
5. end-to-end sample flow 구현

---

# 18. 첫 커밋 시점에 필요한 실제 파일 목록

## 18.1 루트
- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `.gitignore`
- `.env.example`
- `README.md`

## 18.2 apps/web
- `app/layout.tsx`
- `app/page.tsx`
- `app/world/page.tsx`
- `components/app-shell.tsx`

## 18.3 apps/api
- `src/server.ts`
- `src/routes/health.ts`
- `src/routes/projects.ts`

## 18.4 apps/worker
- `src/worker.ts`
- `src/jobs/task-execute-ai.ts`

## 18.5 packages/types
- `src/states.ts`
- `src/events.ts`
- `src/entities.ts`

## 18.6 packages/db
- `prisma/schema.prisma`
- `src/client.ts`

## 18.7 packages/engine
- `src/transition-task.ts`
- `src/transition-project.ts`
- `src/approval-rules.ts`

## 18.8 packages/ai-router
- `src/run-agent.ts`
- `src/model-selector.ts`
- `src/provider/openai.ts`

---

# 19. MVP 절충안 — 반드시 버릴 것

## 19.1 이번 단계에서 버리는 것
- 3D
- 모든 캐릭터 상시 자율행동
- 전 캐릭터 고급 감정 시뮬레이션
- 실시간 pathfinding 정밀 구현
- 멀티유저 협업 우선 구현
- 여러 AI provider 동시 통합
- 자유 대화형 idle chatter

## 19.2 이유
이걸 다 붙이면 BLOKS는 멋있어지기 전에 무거워진다.
MVP는 **Founder가 통제 가능한 살아 있는 회사 운영 UI**를 먼저 증명해야 한다.

---

# 20. MVP 절충안 — 반드시 살릴 것

## 20.1 꼭 살릴 핵심
- World 화면에서 캐릭터가 살아 있는 느낌
- Project / Task / Approval 상태 전이
- Character별 역할/모델/성향 차이
- Approval Center
- Event Log
- 최소 1개 end-to-end AI 실행 흐름
- KPI overview

---

# 21. 구현 우선순위

## Phase A — Skeleton
- repo scaffold
- env/config/types
- db schema minimal
- web shell
- api health
- worker boot

## Phase B — Workflow core
- project/task/approval 엔진
- CRUD
- event log
- basic board UI

## Phase C — AI execution core
- ai-router
- 1~2개 character profile
- artifact generation path
- approval loop

## Phase D — World layer
- zone layout
- character sprite placement
- state badge
- click interaction
- basic animation

## Phase E — Analytics / polish
- KPI
- logs
- overload indicators
- retry / fallback hardening

---

# 22. 권장 실행 명령 초안

## 22.1 루트
```bash
pnpm install
pnpm dev
```

## 22.2 turbo task 예시
```json
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

## 22.3 예상 루트 scripts 예시
```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test"
  }
}
```

---

# 23. 완료 조건 (Definition of Done for 07)

이 문서 기준 07이 완료되었다고 볼 조건은 아래와 같다.

1. 기술 스택이 결정되었다.
2. 모노레포 구조가 결정되었다.
3. 각 앱/패키지 책임이 정의되었다.
4. 주요 런타임 플로우가 정의되었다.
5. AI Router와 Queue 경계가 정의되었다.
6. 실시간 전략이 정의되었다.
7. 첫 리포지토리 스캐폴드 시작이 가능하다.

---

# 24. 다음 문서 후보

이제 다음 문서는 아래 둘 중 하나가 가장 자연스럽다.

## 후보 A
**08_BLOKS_repo_scaffold_and_bootstrap_v0.1.md**
- 실제 폴더 생성
- package.json 예시
- turbo.json 예시
- pnpm workspace 예시
- prisma schema 초안
- docker/local infra 예시

## 후보 B
**08_BLOKS_world_runtime_and_isometric_rules_v0.1.md**
- 아이소메트릭 좌표/zone 규칙
- sprite 규격
- 배지 규칙
- 상호작용 규칙
- 카메라 규칙

### 우선 추천
후보 A.
이유: 이제부터는 문서도 문서지만 **실제 코드를 깔 수 있는 문서**가 우선이다.

---

# 25. 최종 결론

BLOKS MVP는 다음 조합으로 시작하는 것이 가장 현실적이다.

- **Frontend:** Next.js + React + TypeScript + Tailwind
- **World Layer:** PixiJS
- **Backend:** Node.js + TypeScript API server
- **Async:** Redis + BullMQ worker
- **Database:** PostgreSQL + Prisma
- **AI:** OpenAI Responses API + internal AI Router
- **Repo:** pnpm monorepo + Turborepo

이 구조는 “예쁜 회사 세계관”과 “실제 운영 시스템” 사이의 균형점이다.
너무 게임 쪽으로 기울지도 않고, 너무 ERP 쪽으로 메마르지도 않는다.

즉, BLOKS는 이 구조에서 처음으로 **종이 기획서에서 실행 가능한 공장 설계도**로 넘어간다.
