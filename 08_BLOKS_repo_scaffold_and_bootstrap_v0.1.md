# 08_BLOKS_repo_scaffold_and_bootstrap_v0.1

## 문서 성격
이 문서는 BLOKS MVP를 실제로 착수하기 위한 **Build-Spec** 문서다.
기획 요약이 아니라, 개발자가 이 문서를 보고 바로 저장소를 만들고, 패키지를 설치하고, 폴더를 생성하고, 첫 실행까지 갈 수 있도록 작성한다.

본 문서는 다음 문서를 전제로 한다.
- 01_BLOKS_foundation_v0.1.md
- 03_BLOKS_workflow_state_machine_v0.1.md
- 04_BLOKS_data_model_ERD_v0.1.md
- 05_BLOKS_UI_screen_spec_v0.1.md
- 06_BLOKS_MVP_WBS_v0.1.md
- 07_BLOKS_build_stack_and_repo_structure_v0.1.md

---

## 1. 목적

이 문서의 목적은 아래 5가지를 확정하는 데 있다.

1. 저장소(Repo) 구조
2. 앱/패키지 초기 생성 순서
3. 개발 환경 변수(env) 구조
4. 실행 명령과 로컬 구동 순서
5. 첫 주차에 만들어야 할 최소 뼈대 파일 목록

즉, 이 문서는 “무슨 기술을 쓸까”가 아니라,
**“오늘부터 어떻게 만들기 시작할까”**를 다룬다.

---

## 2. MVP 부트스트랩 원칙

### 2.1 먼저 만들 것
BLOKS MVP는 아래 순서로 조립한다.

1. 모노레포 뼈대
2. 공통 타입 패키지
3. API 서버 뼈대
4. Web UI 셸
5. DB 스키마/마이그레이션
6. Worker/Queue 뼈대
7. AI Router 초안
8. World UI 기본 캔버스

### 2.2 나중에 만들 것
아래는 1차 부트스트랩에서 제외한다.

- 복잡한 감정 시뮬레이션
- 모든 캐릭터 상시 자율행동
- 다중 사용자 권한 체계
- 복잡한 결제/빌링
- 모바일 앱 래핑
- 세부 아트 파이프라인 자동화

### 2.3 핵심 전략
MVP는 **“실시간처럼 보이는 운영툴”**로 가고,
진짜 게임 엔진처럼 모든 엔티티를 실시간 시뮬레이션하지 않는다.

즉:
- World 화면은 생동감 있게 보이게 만든다.
- 상태 변경의 진실 원장은 DB/Event Log다.
- UI는 이벤트/스냅샷을 읽어 “살아 있는 것처럼” 보여준다.

---

## 3. 권장 개발 환경

### 3.1 필수 버전
- Node.js: 22 LTS 권장
- pnpm: 9 이상
- PostgreSQL: 16 권장
- Redis: 7 이상
- Git: 최신 안정 버전

### 3.2 로컬 환경 전제
- macOS / Windows / Linux 가능
- Docker Desktop 설치 권장
- VS Code 또는 Cursor/Codex 호환 편집기 권장

### 3.3 권장 도구
- package manager: pnpm
- formatter: Prettier
- lint: ESLint
- ORM: Prisma
- queue: BullMQ
- validation: Zod
- test: Vitest + Playwright
- UI: Tailwind CSS
- world rendering: PixiJS

---

## 4. 최종 모노레포 구조

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
    engine/
    ai-router/
    prompts/
    simulation/
  prisma/
  infra/
    docker/
    scripts/
  docs/
  .github/
```

### 4.1 apps/web
역할:
- Founder가 사용하는 메인 웹앱
- Home / Company World / Projects / Characters / Approvals / Analytics / Knowledge UI
- Next.js App Router 기반

넣을 것:
- app/
- components/
- lib/
- hooks/
- world/
- styles/

넣지 말 것:
- DB 직접 접근 로직
- 장기 실행 AI 작업
- 무거운 workflow rule engine

### 4.2 apps/api
역할:
- REST API 또는 route handlers 집합
- Project / Task / Approval / Character / Analytics / Knowledge 엔드포인트
- 인증, 권한, validation, orchestration entrypoint

넣을 것:
- src/modules/
- src/routes/
- src/services/
- src/repositories/
- src/events/

넣지 말 것:
- UI 컴포넌트
- 실제 장기 AI job 처리 본체

### 4.3 apps/worker
역할:
- 큐 소비
- 장기 작업 처리
- AI 라우팅 호출
- 요약/리서치/산출물 생성
- 상태 전이 후속 처리

넣을 것:
- job handlers
- queue registration
- retry policy
- failure policy

넣지 말 것:
- 화면 렌더링
- 직접적인 사용자 인터랙션

### 4.4 packages/ui
역할:
- 공통 UI 컴포넌트
- 카드, 배지, 패널, 테이블, 로그피드, KPI 위젯

### 4.5 packages/types
역할:
- 공통 타입/DTO/enum/schema
- ProjectState, TaskState, ApprovalLevel, CharacterStatus 등

### 4.6 packages/config
역할:
- 공통 설정
- lint 규칙, tsconfig 베이스, env schema, constants

### 4.7 packages/engine
역할:
- 상태머신/권한/전이 규칙 코어
- workflow rule evaluation
- reason code validation

### 4.8 packages/ai-router
역할:
- 모델 공급자 adapter
- routing policy
- fallback logic
- response normalization
- cost guardrails (달러 환산 로깅)
- RAG 파이프라인 (Vector DB 임베딩 및 검색)

### 4.9 packages/prompts
역할:
- 캐릭터 role spec
- company policy prompt
- task templates
- structured output schemas

### 4.10 packages/simulation
역할:
- world snapshot 생성
- character zone movement
- event-driven view model 생성
- lightweight simulation helper

### 4.11 prisma
역할:
- schema.prisma
- migrations/
- seed scripts

### 4.12 infra/docker
역할:
- postgres/redis/docker-compose
- local dev infra

### 4.13 docs
역할:
- md 문서 보관
- ADR(Architecture Decision Record)

---

## 5. 1차 생성 우선 폴더 상세

### 5.1 1일차에 반드시 생성할 폴더
```text
BLOKS/
  apps/web
  apps/api
  apps/worker
  packages/types
  packages/config
  packages/engine
  prisma
  infra/docker
```

### 5.2 2일차에 생성해도 되는 폴더
```text
packages/ui
packages/ai-router
packages/prompts
packages/simulation
```

이유:
1차 목표는 “돌아가는 뼈대”이지 “모든 설계의 완성”이 아니기 때문이다.

---

## 6. 초기 생성 명령 예시

### 6.1 루트 초기화
```bash
mkdir BLOKS && cd BLOKS
pnpm init
mkdir -p apps packages prisma infra/docker docs .github
```

### 6.2 pnpm workspace 설정
루트에 `pnpm-workspace.yaml` 생성:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 6.3 루트 package.json 예시
```json
{
  "name": "bloks-monorepo",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9",
  "scripts": {
    "dev:web": "pnpm --filter web dev",
    "dev:api": "pnpm --filter api dev",
    "dev:worker": "pnpm --filter worker dev",
    "dev": "concurrently \"pnpm dev:web\" \"pnpm dev:api\" \"pnpm dev:worker\"",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "format": "pnpm -r format",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "typescript": "^5.8.0",
    "tsx": "^4.0.0",
    "prisma": "^6.0.0"
  }
}
```

### 6.4 web 앱 생성
```bash
cd apps
pnpm create next-app@latest web --ts --eslint --app --src-dir --tailwind --import-alias "@/*"
```

### 6.5 api 앱 생성
```bash
mkdir -p apps/api/src
cat > apps/api/package.json <<'JSON'
{
  "name": "api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "lint": "eslint .",
    "test": "vitest"
  }
}
JSON
```

### 6.6 worker 앱 생성
```bash
mkdir -p apps/worker/src
cat > apps/worker/package.json <<'JSON'
{
  "name": "worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/worker.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/worker.js",
    "lint": "eslint .",
    "test": "vitest"
  }
}
JSON
```

---

## 7. 루트 설정 파일 목록

루트에 아래 파일을 둔다.

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
.eslintrc.cjs
.prettierrc
.gitignore
.env.example
README.md
```

### 7.1 tsconfig.base.json 예시
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "baseUrl": ".",
    "paths": {
      "@bloks/types/*": ["packages/types/src/*"],
      "@bloks/config/*": ["packages/config/src/*"],
      "@bloks/engine/*": ["packages/engine/src/*"],
      "@bloks/ai-router/*": ["packages/ai-router/src/*"],
      "@bloks/ui/*": ["packages/ui/src/*"],
      "@bloks/simulation/*": ["packages/simulation/src/*"]
    }
  }
}
```

### 7.2 .gitignore 예시
```gitignore
node_modules
.pnpm-store
.next
coverage
dist
.env
.env.*
!.env.example
prisma/dev.db
.DS_Store
```

---

## 8. .env 설계

### 8.1 루트 .env.example
```env
# App
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
WORKER_CONCURRENCY=4

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bloks

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=
OPENAI_PROJECT_ID=
OPENAI_ORG_ID=

# App Auth (MVP founder-only)
FOUNDER_EMAIL=
FOUNDER_PASSWORD=
SESSION_SECRET=

# Queue / Limits
AI_MAX_RETRIES=2
AI_TASK_TIMEOUT_MS=120000
AI_MAX_COST_PER_TASK_USD=0.5
AI_DAILY_BUDGET_USD=20

# Logging
LOG_LEVEL=debug
ENABLE_EVENT_LOG=true
ENABLE_AUDIT_LOG=true
```

### 8.2 env 분리 원칙
- web는 공개 가능한 값만 `NEXT_PUBLIC_*` 사용
- API key는 web에 절대 두지 않는다
- cost limit와 retry policy는 worker/api에서만 읽는다

### 8.3 env validation 필수
`packages/config`에 Zod 기반 env schema를 만든다.

예시 필드:
- DATABASE_URL
- REDIS_URL
- OPENAI_API_KEY
- SESSION_SECRET
- AI_MAX_COST_PER_TASK_USD
- AI_TASK_TIMEOUT_MS

---

## 9. Docker 로컬 인프라

### 9.1 docker-compose.yml 예시
`infra/docker/docker-compose.yml`

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16 # RAG 구현을 위한 pgvector 확장 이미지 필수
    container_name: bloks-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: bloks
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    container_name: bloks-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 9.2 구동 명령
```bash
cd infra/docker
docker compose up -d
```

### 9.3 확인 명령
```bash
docker ps
```

---

## 10. Prisma 초기 구조

### 10.1 schema.prisma 1차 목표 엔티티
아래 엔티티만 우선 넣는다.

- Company
- Department
- Character
- ModelProfile
- Project
- Task
- Approval
- Artifact
- EventLog
- Relationship
- PromptTemplate (프롬프트 버전 마스터)
- MemoryNode (RAG용 Vector 전담 테이블)

### 10.2 1차 절충
MVP 부트스트랩에서는 모든 세부 컬럼을 한 번에 넣지 않는다.
먼저 “흐름이 도는 최소 테이블”만 만든다.

예:
- Character는 full persona 이전에 core identity + org fields + runtime state만
- Project는 title, state, priority, owner 정도부터
- Task는 projectId, assigneeId, state, title 정도부터

### 10.3 seed 데이터 목표
최소 seed:
- 부서 5개
- Active Core 캐릭터 14명
- 프로젝트 3개
- 태스크 12개
- 승인 5개
- 이벤트 로그 20개

---

## 11. packages/types 초기 파일 목록

### 11.1 구조
```text
packages/types/
  src/
    enums/
      project-state.ts
      task-state.ts
      approval-state.ts
      character-status.ts
      priority.ts
      reason-code.ts
    dto/
      project.dto.ts
      task.dto.ts
      approval.dto.ts
      character.dto.ts
    index.ts
```

### 11.2 반드시 먼저 만들 enum
- ProjectState
- TaskState
- ApprovalState
- CharacterStatus
- Priority
- ReasonCode

### 11.3 규칙
상태값 enum은 UI/app/api/worker가 공용으로 사용한다.
각 앱이 자기 enum을 따로 들고 있으면 반드시 꼬인다.

---

## 12. packages/engine 초기 책임

### 12.1 engine이 해야 할 일
- 상태 전이 허용 여부 판단
- reason code 검증
- 승인 레벨 계산
- task done 시 project 상태 반영 여부 결정
- blocked / rework 규칙 처리

### 12.2 engine이 하면 안 되는 일
- 외부 API 직접 호출
- DB 직접 연결
- UI 렌더링
- 프롬프트 생성

### 12.3 추천 파일 구조
```text
packages/engine/
  src/
    transitions/
      project-transition.ts
      task-transition.ts
      approval-transition.ts
    guards/
      permission.guard.ts
      state.guard.ts
    policies/
      approval.policy.ts
      workflow.policy.ts
    index.ts
```

---

## 13. apps/api 초기 구조

### 13.1 구조
```text
apps/api/src/
  server.ts
  app.ts
  routes/
    health.route.ts
    project.route.ts
    task.route.ts
    character.route.ts
    approval.route.ts
  modules/
    project/
      project.controller.ts
      project.service.ts
      project.repository.ts
      project.schema.ts
    task/
    character/
    approval/
  lib/
    prisma.ts
    redis.ts
    logger.ts
  events/
    event-log.service.ts
```

### 13.2 최초 엔드포인트
- GET /health
- GET /projects
- POST /projects
- GET /projects/:id
- GET /tasks
- POST /tasks
- PATCH /tasks/:id/state
- GET /characters
- GET /approvals
- POST /approvals/:id/approve
- POST /approvals/:id/reject

### 13.3 최초 API 원칙
- body validation은 Zod
- 모든 상태 변경은 Event Log 남김
- 승인/반려는 reason code 필수
- 삭제보다 soft-delete / archived 선호

---

## 14. apps/worker 초기 구조

### 14.1 구조
```text
apps/worker/src/
  worker.ts
  queues/
    queue-registry.ts
  jobs/
    create-artifact.job.ts
    summarize-project.job.ts
    character-action.job.ts
    approval-followup.job.ts
  services/
    ai-task.service.ts
    workflow-followup.service.ts
```

### 14.2 1차 queue 목록
- project-events
- character-actions
- artifact-generation
- approval-followups
- analytics-rollups

### 14.3 1차 job 타입
- CREATE_PRD_DRAFT
- GENERATE_MARKETING_COPY
- GENERATE_RESEARCH_SUMMARY
- UPDATE_CHARACTER_STATE
- APPROVAL_POST_PROCESS
- BUILD_WORLD_SNAPSHOT

### 14.4 retry 정책 초안
- 네트워크 오류: 최대 2회 재시도
- 모델 응답 포맷 오류: 최대 1회 재시도
- 비용 상한 초과: 재시도 금지
- 권한 오류: 즉시 실패
- 구조화 스키마 실패: fallback model 1회 후 실패

---

## 15. packages/ai-router 초기 구조

### 15.1 책임
- 모델 선택
- fallback
- 응답 normalize
- 비용 추정
- structured output enforcement
- low-confidence 시 escalation flag 생성

### 15.2 구조
```text
packages/ai-router/src/
  providers/
    openai.provider.ts
  routing/
    choose-model.ts
    fallback-policy.ts
    budget-policy.ts
  schemas/
    artifact.schema.ts
    research.schema.ts
    approval.schema.ts
  index.ts
```

### 15.3 MVP 정책
초기엔 provider를 하나로 제한해도 된다.
즉, OpenAI 우선 단일 adapter로 가고,
미래 확장을 위해 provider interface만 미리 둔다.

### 15.4 호출 결과 표준화 예시
```ts
export type AiExecutionResult<T> = {
  ok: boolean;
  model: string;
  provider: string;
  costUsdEstimate: number;
  confidence: number;
  output: T | null;
  rawText?: string;
  errorCode?: string;
};
```

---

## 16. apps/web 초기 구조

### 16.1 구조
```text
apps/web/src/
  app/
    page.tsx
    projects/
    characters/
    approvals/
    analytics/
    knowledge/
  components/
    layout/
    project/
    character/
    approval/
    analytics/
    shared/
  world/
    canvas/
    entities/
    overlays/
    hooks/
  lib/
    api-client.ts
    query-client.ts
  hooks/
  styles/
```

### 16.2 첫 화면 우선순위
1. AppShell
2. Home / Company World 더미 버전
3. Project Board 기초 버전
4. Character Directory 기초 버전
5. Approval Center 기초 버전

### 16.3 World UI 첫 주차 범위
- 아이소메트릭 룸 배경은 정적이어도 됨
- 캐릭터 5~8명만 먼저 표시
- 상태 배지 표시
- 클릭 시 우측 패널 오픈
- 실시간 pathfinding 대신 zone jump 또는 간단 tween

---

## 17. 최초 파일 생성 체크리스트

### 17.1 루트
- [ ] package.json
- [ ] pnpm-workspace.yaml
- [ ] tsconfig.base.json
- [ ] .env.example
- [ ] README.md

### 17.2 prisma
- [ ] schema.prisma
- [ ] seed.ts

### 17.3 api
- [ ] src/server.ts
- [ ] src/app.ts
- [ ] health.route.ts
- [ ] project route/service/repository
- [ ] task route/service/repository

### 17.4 worker
- [ ] src/worker.ts
- [ ] queue-registry.ts
- [ ] character-action.job.ts
- [ ] create-artifact.job.ts

### 17.5 web
- [ ] app/page.tsx
- [ ] app/projects/page.tsx
- [ ] app/characters/page.tsx
- [ ] components/layout/AppShell.tsx
- [ ] world/canvas/WorldCanvas.tsx

### 17.6 packages
- [ ] types enums
- [ ] engine transition files
- [ ] config env schema
- [ ] ai-router interface

---

## 18. Day 1 / Day 2 / Day 3 계획

### Day 1
목표: 저장소 생성 + 로컬 인프라 + 앱 셸
- repo init
- pnpm workspace
- docker compose up
- next app 생성
- api/worker skeleton 생성
- root scripts 구성

완료 조건:
- web/api/worker가 모두 dev로 뜬다
- postgres/redis 컨테이너가 정상 구동된다

### Day 2
목표: DB + 공통 타입 + 최소 API
- prisma schema 1차
- migrate
- seed
- enums/type 패키지 생성
- GET /projects, GET /characters 구현

완료 조건:
- DB에 seed 데이터가 들어간다
- web에서 프로젝트/캐릭터 목록 조회 가능

### Day 3
목표: 상태 전이 + world 첫 화면
- task/project 상태 전이 API
- event log 생성
- world view에서 character 상태 노출
- 우측 상세 패널 연결

완료 조건:
- UI에서 프로젝트/캐릭터 데이터가 연결된다
- 상태 바꾸면 로그가 쌓인다

---

## 19. 실패하기 쉬운 포인트와 예방책

### 19.1 web에 비즈니스 로직 과적재
예방:
- 상태 전이 규칙은 engine으로
- API는 orchestration entrypoint로 유지

### 19.2 worker 없는 상태에서 AI 호출을 API가 다 처리
예방:
- 3초 이상 걸릴 수 있는 작업은 worker로
- API는 job enqueue 중심

### 19.3 enum 중복 선언
예방:
- 모든 상태값은 packages/types 단일 출처

### 19.4 world 화면을 너무 빨리 고급화
예방:
- 1차는 정적 맵 + 상태 아이콘 + 클릭 패널이면 충분

### 19.5 AI 비용 폭주
예방:
- active agent 수 제한
- task당 cost ceiling
- idle chatter 금지
- structured output 실패 시 무한 재시도 금지

---

## 20. README 초안에 반드시 들어갈 문장

루트 README에는 아래를 넣는다.

1. BLOKS가 무엇인지
2. 현재 MVP 범위
3. 요구 Node/pnpm 버전
4. 로컬 인프라 실행법
5. env 설정법
6. 개발 서버 실행법
7. seed 데이터 넣는 법
8. 주요 앱/패키지 설명

---

## 21. 첫 커밋 단위 추천

### Commit 1
`chore: initialize monorepo workspace and root config`

### Commit 2
`feat(web): bootstrap next app shell and navigation`

### Commit 3
`feat(api): bootstrap api server with health route`

### Commit 4
`feat(worker): bootstrap queue worker skeleton`

### Commit 5
`feat(db): add prisma schema and seed data`

### Commit 6
`feat(types): add shared workflow enums and dto types`

### Commit 7
`feat(engine): add initial project and task transition rules`

---

## 22. Definition of Done for 08 단계

08 단계가 끝났다고 말하려면 아래가 충족되어야 한다.

- [ ] monorepo 구조가 생성되었다
- [ ] web/api/worker가 각각 부팅된다
- [ ] postgres/redis가 로컬에서 뜬다
- [ ] 최소 schema/migration/seed가 있다
- [ ] 공통 enum/type이 단일 출처로 정리되었다
- [ ] 첫 화면 셸이 렌더링된다
- [ ] 최소 API health/projects/characters가 응답한다
- [ ] worker queue가 최소 1개 등록된다

---

## 23. 다음 문서 후보

08 다음에는 아래 둘 중 하나가 자연스럽다.

### 후보 A
`09_BLOKS_world_runtime_and_isometric_rules_v0.1.md`
- 월드 룸 구조
- zone 이동 규칙
- 상태 배지 규칙
- 이벤트 핀 규칙
- world snapshot 구조

### 후보 B
`09_BLOKS_api_contracts_and_job_specs_v0.1.md`
- endpoint 상세 명세
- request/response schema
- queue payload schema
- error code
- retry contract

### 추천
실무상으로는 **후보 B**가 더 먼저 와도 좋다.
이유는 web/api/worker를 실제로 잇는 데 가장 직접적이기 때문이다.

---

## 24. 최종 결론

BLOKS는 처음부터 거대한 게임처럼 만들면 실패할 확률이 높다.
대신 아래 원칙으로 가야 한다.

- 모노레포로 시작한다.
- web/api/worker를 분리한다.
- DB와 Event Log를 진실 원장으로 삼는다.
- World는 예쁘게 보이되, 복잡한 실시간성은 뒤로 미룬다.
- 공통 타입과 상태머신을 단일 출처로 둔다.
- AI는 직접 난사하지 말고 ai-router와 worker를 통해 통제한다.

즉, 08의 목표는 “BLOKS를 만들 수 있게 만드는 것”이다.
기술 선택을 끝내고, 손이 코드로 들어가게 만드는 첫 번째 실제 제작 문서가 바로 이 단계다.
