> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

# 05_BLOKS_UI_screen_spec_v0.1 (Vibe Coding Ready)

## 문서 목적
이 문서는 BLOKS MVP의 프론트엔드 파트(React/Next.js 기반 웹 뷰)를 **'바이브 코딩' 방식으로 즉시 생성하기 위한 초정밀 화면/컴포넌트 설계서**입니다.
단순히 "이런 화면이 있다"는 수준을 넘어, **각 컴포넌트가 어떤 ERD 데이터 소스를 참조하며, 사용자가 액션을 취할 때 어떤 API를 트리거하는지, 상태(State) 값에 따라 시각적 렌더링이 어떻게 변이하는지(블랙 코미디적 연출 포함)**를 구체적으로 명시합니다.

---

## 1. 전역 디자인 시스템 및 시각 변이 (Global Design System)

### 1.1 시각적 테마: "Cozy Tactical & Toxic Corporate"
- **기본 팔레트(Cozy):** 부드럽고 따뜻한 톤(아이보리, 파스텔톤 우드, 플랫 디자인). 시각적으로는 편안한 경영 타이쿤 게임.
- **경고 팔레트(Toxic):** 하지만 `burnout_triggered == true`, `budget_limit exceeded`, `Overload` 상태 발생 시 모달, 테두리, 캐릭터 말풍선이 위협적인 형광 레드 또는 흑백 글리치(Glitch) 효과로 국소적 오염을 일으켜 사내 긴장감을 극대화합니다.

### 1.2 Layout & AppShell 컴포넌트 구조
*   `<TopGlobalNav>` : 최소한의 요약 정보(현재 예산, 알림, 시각)를 보여주는 상단 바.
*   `<LeftSidebarNav>` : 메뉴 이동(World, Board, Directory, Approval, Analytics, Prompt Console).
*   `<MainContentView>` : 화면별 핵심 작업 영역.
*   `<RightContextPanel>` : 어떤 객체(프로젝트, 승인, 캐릭터)를 클릭하든 동적으로 열려 상세 정보와 퀵 액션을 제공하는 드로어(Drawer).
*   `<BottomLiveTicker>` : `Event_Log`의 최근 10건을 롤링(Rolling) 형태로 보여주는 전광판.

---

## 2. Screen 01 — Home / Isometric Company World

### 2.1 [Component: IsometricWorldCanvas]
2.5D 아이소메트릭 기반의 다이내믹 맵 뷰. 회사가 살아 움직이는 것을 보여주는 메인 무대.

- **데이터 소스 매핑:** `Character_Runtime_State` (초당 Polling 또는 WebSocket 실시간 구독), `Task` 진행 상태.
- **UI 렌더링 규칙 (Visual States):**
  - **캐릭터 아바타(Sprite):** 캐릭터별 `fatigue_score`가 높을수록 걷는 애니메이션 프레임 속도가 느려지고, 고개가 꺾인 그래픽 노출.
  - **번아웃 (Burnout Trigger):** `burnout_triggered == true` 시, 캐릭터 머리 위에 **'붉은 먹구름(파티클)' 플로팅 아이콘** 고정 노출.
  - **Overloaded:** 캐릭터 책상(Desk) 주변에 서류 뭉치 그래픽이 쌓이는 이펙트 활성화.
  - **부서 구역 (Zone):** 해당 부서의 Task가 몰리면 해당 구역 전체 조명이 어두운 주황색으로 은은하게 깜빡임.
- **인터랙션/API 액션 (Founder God Mode):**
  - **Drag & Drop 강제 배정:** 파운더가 화면 하단 '대기 큐'의 Task 카드를 집어서 월드 내 특정 캐릭터에게 던져 넣으면 -> `Task_Assign` API 즉시 호출 (SLA 무시 배정).
  - **우클릭 퀵 메뉴:** 자리에 있는 캐릭터 우클릭 시 `[상세 보기]`, `[면담 호출]`, `[강제 휴식(Rest)]` 메뉴 팝업.

---

## 3. Screen 02 — Project Kanban Board

### 3.1 [Component: KanbanBoard]
전체 프로젝트 또는 태스크를 칸반 형태로 나열한 관리자 뷰.

- **데이터 소스 매핑:** `Project` 테이블의 `project_state`(컬럼), `Task` 테이블의 `task_state`.
- **렌더링 레이아웃:** 
  - `Idea` | `Intake` | `In Planning` | `In Execution` | `Review` | `Blocked / Hold` | `Released`
- **UI 컴포넌트: `<ProjectCard>`**
  - `[Title]` 프로젝트명 (project_title)
  - `[Badge]` 위험도 (risk_state: Warning 시 노란색 테두리, Incident 시 붉은색 점멸)
  - `[Progress Bar]` 진행률 게이지
  - `[Avatars]` Owner 및 주요 Assignee 미니 아바타 아이콘 렌더링 (최대 3인).

### 3.2 [Component: ApprovalQueueBanner] (보드 상단 플로팅)
- **역할:** 현재 유저(Founder)가 즉시 처리해야 할 `Waiting L4` 결재 건수를 붉은색 배지로 강력하게 어필하여 클릭을 유도. (클릭 시 Approval Center로 라우팅).

---

## 4. Screen 03 — Project Context Drawer (상세 패널)

### 4.1 [Component: ProjectHeaderPanel]
- **데이터 소스:** `Project`, `Approval`
- **렌더링 필드:**
  - **[지표 A] 가상 예산 소진율 (Virtual Budget):** `virtual_budget_consumed / virtual_budget_allocated` 퍼센트 링 차트. 90% 초과 시 "Budget Warning" 붉은 라벨 표시.
  - **[지표 B] 실 누적 API 비용 (Real Cost):** `api_cost_accumulated` 필드값을 텍스트로 노출 (예: `$24.50 consumed`).

### 4.2 [Component: TaskDependencyGraph]
- **데이터 소스:** `Task`, `Task_Dependency`
- **시각적 형태:** 수직 타임라인 또는 미니 DAG(방향성 비순환 그래프) 노드 뷰.
- **인터랙션:** 선행 태스크가 `Blocked` 상태일 경우, 종속된 후행 태스크들까지 회색(Disabled) 타선으로 이어지며 "연쇄 지연" 경고 툴팁 제공.

---

## 5. Screen 04 — Character Directory

### 5.1 [Component: RosterGrid]
- **데이터 소스:** `Character`, `Rank`, `Role` 테이블 JOIN 결과.
- **렌더링 규칙:**
  - 40개의 카드로 구성. `active_mode`가 'Specialist' 인 경우 카드가 잠긴(Locked) 형태의 UI로 노출 (이벤트 발생 시 해제).
- **UI 컴포넌트: `<CharacterMiniCard>`**
  - **[Text]** 이름 / 직급 / 핵심 성향(`persona_summary` 첫 키워드).
  - **[Icons]** 사용 주력 모델 (`mod_gpt4o`, `mod_claude3` 등 모델 로고 소형 뱃지 표시).
  - **[Data]** 현재 맡은 티켓 수 (숫자 배지).

---

## 6. Screen 05 — Character Detail (에이전트 딥 커스텀 화면)

### 6.1 [Component: Persona & Capability Radar]
- **데이터 소스:** `Character` 내 속성값 (`trust_base`, `influence_base`, Capability scores).
- **시각적 형태:** 6각 레이더 차트 (논리, 창의, 속도, 꼼꼼함, 협업성, 정치력).

### 6.2 [Component: Setup_Model_And_Prompt] (핵심 바이브 코딩 연동)
- **데이터 소스:** `Prompt_Template`, `Model_Profile`
- **UI 렌더링:**
  - 현재 캐릭터가 연결되어 있는 `Primary Model` 드롭다운 선택기.
  - 적용 중인 `Prompt_Template` 버전 노출 창. (우측 '수정' 버튼 클릭 시 Prompt Console 다이얼로그 팝업).
  - *비고:* 시스템에서 가장 자주 수정이 일어날 "로직 주입구"이므로 개발 시 `textarea` 또는 코드 에디터 UI 적용 필요.

### 6.3 [Component: Memory_And_RAG_Trace]
- **데이터 소스:** `Character_Memory_Link`, `Memory_Node`
- **시각적 형태:** 수직 로그 형식.
- **출력 데이터:** "최근 24시간 내 이 캐릭터가 의사결정을 위해 RAG로 꺼내본 주요 기억(Vector 유사도 매칭된 과거 로그)"의 앞 3줄 미리보기 제공. "왜 이 캐릭터가 이런 행동(반려/승인)을 했는지" 추적하는 시뮬레이션의 디버거 역할.

---

## 7. Screen 06 — Approval Center (최종 결재처)

### 7.1 [Component: ApprovalQueueTable]
- **데이터 소스:** `Approval` (where `approval_state` == 'Waiting' AND `approval_level` == User's Level).
- **UI 렌더링:**
  - 행(Row) 클릭 시 우측에 `<ApprovalContextDrawer>` 오픈.
- **[Component: ApprovalContextDrawer] 인터랙션:**
  - `[승인 (Approve)]` 버튼 (초록색)
  - `[반려 (Reject)]` 버튼 (붉은색) -> 클릭 시 반드시 `reason_code` (e.g., OVERLOAD_REJECTION, LOGIC_INSUFFICIENT) 를 드롭다운으로 강제 선택해야 API Submit 됨. 선택지에는 업무 사유와 정치적 타겟 사유가 혼재되어 노출됨.

---

## 8. Screen 07 — Analytics & Governance Dashboard

### 8.1 [Component: SimulationMetricsGrid]
최상위 관리자(Founder)가 회사 운영 상황을 판단하는 지표 패널.

- **UI 패널 A (Burnout Tracker):** `Character_Runtime_State` 기반, 번아웃이 가장 심한 5명 랭킹 차트 (수시로 강제 휴식을 컨트롤해야 함).
- **UI 패널 B (Cost vs Budget Graph):** X축(시간), Y축(비용). `virtual_budget_consumed` (점선)과 `api_cost_accumulated` (실선)을 겹쳐서 보여줘 서버 비용 관리 지원.
- **UI 패널 C (Delegation Rules):** 특정 임원진(Twin 등)에게 결재를 위임(Delegation)한 내역 리스트 표기. 언제 위임 만료되는지 Time-left 노출.

---

## 9. 프론트엔드 개발 시 유의사항 (UX 가드레일)

1. **폴링(Polling) 과부하 방지:** 캐릭터 런타임 및 아이소메트릭 월드 뷰의 갱신은 웹소켓 이벤트를 기본으로 하되, 잦은 리렌더링 방지를 위해 React `useMemo`, `useCallback` 처리가 강제되어야 함.
2. **모달/드로어 패턴 일관성:** 화면 이동(`라우팅`) 뎁스를 최소화하고, 모든 상세 작업은 현재 문맥을 잃지 않는 우측 패널(Drawer) 호출로 처리하여 "게임 관리창" 느낌을 유지.
3. **블랙 코미디적 피드백:** 반려 사유(`reason_code`) 텍스트가 노출될 때, 딱딱한 업무 용어가 아닌 캐릭터 페르소나 설정에 따른 대사(Dialog) 필드가 팝오버 툴팁으로 부드럽게(`tooltip fade-in`) 노출되도록 연출.
