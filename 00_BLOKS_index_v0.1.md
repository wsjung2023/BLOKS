> ⚠️ **[ARCHIVED 2026-05-21]** 구현 완료 — 더 이상 업데이트하지 않습니다.

# BLOKS 기획 및 아키텍처 문서 인덱스 (v0.1)

이 문서는 BLOKS MVP를 구축하기 위해 작성된 **전체 기획서 및 인프라 설계서의 마스터 목차(Index)**입니다.
각 문서는 앞선 문서의 논리적 뼈대를 그대로 물려받아 심화되며, **01번부터 11번까지 전체 세트를 읽을 경우 단 하나의 오차도 없는 완벽한 AI 시뮬레이션 개발 스펙**이 완성되도록 설계되었습니다.

---

## 🏛️ Phase 0. Supreme Court Precedent (절대 정본 선언서)
문서 간에 충돌이 발생하거나 코딩 중 혼란이 생길 때, **모든 설정에 우선하여 적용되는 절대 규칙(진실의 원천)**입니다.
- **[11_BLOKS_canonical_alignment_and_P0_fixes_v0.1.md](./11_BLOKS_canonical_alignment_and_P0_fixes_v0.1.md)**
  - 역할: 01~10 기획 문서의 역사적 잔재로 발생한 7가지 P0 설정 충돌(Roster/직급/ID Prefix/Queue명 등)을 하나로 통합고정.

---

## 📂 Phase 1. Foundation & World Building (세계관 및 코어 룰)
가장 근본적인 아이디어와 물리/시간 규칙, 그리고 활동할 AI 페르소나를 정의합니다.

- **[01_BLOKS_foundation_v0.1.md](./01_BLOKS_foundation_v0.1.md)**
  - 역할: 회사 기본 구조, 핵심 사업 영역, Cozy & Toxic 블랙 코미디 톤 설정.
  - 심화 보완: 시뮬레이션 엔진 코어 룰 (시간 흐름 배율, 4단 프롬프트 조립 파이프라인).
- **[02_BLOKS_character_roster_v0.2_mingled.md](./02_BLOKS_character_roster_v0.2_mingled.md)**
  - 역할: 40명의 전체 조직도(Founder, C-Level 실무진 등) 및 Active Core 명단 확정.
  - 심화 보완: 개별 캐릭터의 JSON 스키마 (권한 레벨, 성향치 등 ERD 연동용 속성).

---

## 📂 Phase 2. System Logic & Data Model (구조와 데이터)
위에서 정한 페르소나들이 실제로 굴러가기 위한 상태 전계(State) 규칙과 이를 저장할 DB 구조를 설계합니다.

- **[03_BLOKS_workflow_state_machine_v0.1.md](./03_BLOKS_workflow_state_machine_v0.1.md)**
  - 역할: Project, Task, Approval 등 핵심 객체들의 허용된 전이 방식(State Machine) 정의.
  - 심화 보완: 번아웃, 피로도 경고, 승인/반려 시 블랙 코미디 Reason Code 연동 논리.
- **[04_BLOKS_data_model_ERD_v0.1.md](./04_BLOKS_data_model_ERD_v0.1.md)**
  - 역할: BLOKS 내 데이터 엔티티 ERD 및 1:1, 1:N 관계 정의서 (DB 스키마 도면).
  - 심화 보완: `PromptTemplate`, `Delegation(권한 위임)`, `Virtual Budget`, `Vector_Embedding (RAG용 Memory)` 테이블 주입.

---

## 📂 Phase 3. UX/UI & Execution Plan (화면 단과 개발 일정)
위의 데이터 로직을 사용자가 어떻게 볼 수 있는지, 어떤 순서로 개발할 것인지 정의합니다.

- **[05_BLOKS_UI_screen_spec_v0.1.md](./05_BLOKS_UI_screen_spec_v0.1.md)**
  - 역할: Isometric World 뷰 화면, 칸반 보드, 승인 센터 등 데스크톱용 UX 컴포넌트 명세.
  - 심화 보완: 드래그 앤 드롭 개입, 멘탈 상태 변경 시의 붉은색 글리치 UI 등 동적 렌더링 규칙 포함.
- **[06_BLOKS_MVP_WBS_v0.1.md](./06_BLOKS_MVP_WBS_v0.1.md)**
  - 역할: MVP 전체 일정 및 리스크 관리 마일스톤 프레임워크 (DoD 포함).
  - 심화 보완: AI/엔지니어 바이브 코딩용 에픽(Epic) 쪼개기 및 `schema.prisma`, `Vector Search` 파이프라인 등 실제 산출물 명시.

---

## 📂 Phase 4. Architecture & Scaffolding (기술 스택 및 코딩 착수)
어떤 프레임워크와 스택으로 위 기획을 실제 폴더/환경 단위로 옮길 것인지 정의합니다.

- **[07_BLOKS_build_stack_and_repo_structure_v0.1.md](./07_BLOKS_build_stack_and_repo_structure_v0.1.md)**
  - 역할: Next.js(App Router), PostgreSQL(pgvector), Zustand, Turborepo 모노레포 등 기술 스택 확정.
  - 심화 보완: AI Router 패키지 격리 및 Redis/BullMQ Worker 기반 비동기 설계 원칙.
- **[08_BLOKS_repo_scaffold_and_bootstrap_v0.1.md](./08_BLOKS_repo_scaffold_and_bootstrap_v0.1.md)**
  - 역할: Day 1 ~ Day 3 폴더 구조(scaffolding) 생성 절차, 명령어, `.env` 및 `docker-compose`(pgvector 주입) 뼈대.

---

## 📂 Phase 5. Detailed Engineering Contracts (세부 엔지니어링 명세)
AI 파트너(Cursor/Claude)가 코딩을 수행할 때 오버엔지니어링을 하거나 변수명이 어긋나지 않도록 강제하는 절대 규칙입니다.

- **[09_BLOKS_API_contracts_and_job_specs_v0.1.md](./09_BLOKS_API_contracts_and_job_specs_v0.1.md)**
  - 역할: REST API의 정확한 JSON 페이로드 구조, 엔드포인트 URL, 비동기 Job Queue(BullMQ) 명칭 통제 명세서.
  - 심화 보완: 프론트/백엔드 간 통신 충돌(변수명 불일치)을 완벽 차단.
- **[10_BLOKS_world_runtime_and_isometric_rules_v0.1.md](./10_BLOKS_world_runtime_and_isometric_rules_v0.1.md)**
  - 역할: 아이소메트릭 맵 렌더링 한계점(Scope) 설정 및 시스템 상태(오버로드, 번아웃)와 시각 요소 간의 매핑 룰셋.
  - 심화 보완: 불필요한 3D 물리 엔진이나 무거운 A* 길찾기 알고리즘 도입을 막아 성능 안정성 확보.

---

## 📌 다음 단계 (Execution)
- [ ] 08번 문서에 명시된 `BLOKS` 모노레포 터미널 스캐폴딩 및 `schema.prisma` 작성 (실제 코딩 착수)
