# 06_BLOKS_MVP_WBS_v0.1

## 문서 목적
이 문서는 BLOKS MVP를 실제로 개발 가능한 수준으로 쪼갠 **WBS(Work Breakdown Structure)**, 우선순위, 마일스톤, 산출물, 리스크를 정의하는 1차 실행 문서다.

이 문서의 핵심 목표는 다음과 같다.
- 무엇을 먼저 만들고 무엇을 나중에 미루는지 분명히 한다.
- 화면, 데이터, 상태머신, 오케스트레이션, 월드 뷰를 어떻게 순서대로 붙일지 정한다.
- 1인 또는 소수 개발 기준으로도 굴러가는 MVP 경로를 제시한다.
- “예쁜 회사 세계”보다 “실제로 돌아가는 회사 엔진”을 우선한다.

---

## 1. MVP 한 줄 정의

**BLOKS MVP는 Founder가 프로젝트를 생성하면, AI 캐릭터 조직이 기획·리서치·개발 업무를 상태머신과 승인 흐름에 따라 수행하고, 그 과정이 아이소메트릭 오피스 월드와 운영 패널에 시각화되는 데스크톱 웹 애플리케이션이다.**

---

## 2. MVP 포함 범위 / 제외 범위

### 2.1 반드시 포함
1. 회사 월드 메인 화면
2. 프로젝트 생성/조회/상태관리
3. 태스크 생성/배정/검토/완료 흐름
4. 승인 센터
5. 40인 roster + Active Core 운영
6. 캐릭터 상세 정보
7. 이벤트 로그
8. 기본 Analytics 대시보드
9. Knowledge/Artifact 저장 구조
10. 최소 수준의 AI 오케스트레이션

### 2.2 MVP에서 축소 허용
1. 고급 감정 정치 시뮬레이션
2. 완전 자율 에이전트 운영
3. 복잡한 경제 시스템
4. 다중 회사/멀티테넌시
5. 모바일 완성도
6. 고급 리스크 자동화 엔진
7. 고급 모델 라우팅 최적화

### 2.3 MVP 제외
1. 3D 월드
2. 실시간 멀티유저 협업
3. 외부 고객 포털
4. 정교한 ERP 회계 모듈
5. 음성 캐릭터 대화 시스템
6. 완전한 NPC 감정 시뮬레이션

---

## 3. 개발 원칙

### 3.1 우선순위 원칙
- 1순위: 상태와 데이터가 정확히 돈다
- 2순위: 운영 패널이 읽힌다
- 3순위: 월드가 움직인다
- 4순위: 귀엽고 예뻐진다

### 3.2 구현 원칙
- 먼저 CRUD + 상태 전이
- 다음 승인/로그
- 그 다음 캐릭터/월드 시각화
- 마지막에 고급 연출

### 3.3 기술 원칙
- Desktop Web 우선
- Isometric 뷰는 React + Canvas 계열 또는 게임엔진 경량 연결
- 상태와 권한은 백엔드 단일 진실원천(SSOT)
- AI 결과물은 항상 Artifact와 로그로 남긴다

---

## 4. MVP 전체 일정 프레임

### 4.1 권장 일정
- Phase 0: 기획 잠금 / 기술 베이스 확정
- Phase 1: 데이터 모델 + 백엔드 골격
- Phase 2: 프로젝트/태스크/승인 운영 UI
- Phase 3: 캐릭터/월드 시각화
- Phase 4: AI 오케스트레이션 연결
- Phase 5: Analytics / Knowledge / 마감 정리

### 4.2 권장 기간
**총 6~8주** 기준이 현실적이다.

- 빠른 프로토타입: 4주 압축 가능
- 안정적 MVP: 6~8주 권장
- 1인 개발 기준: 8주 이상이 더 현실적

---

## 5. Phase별 WBS

# Phase 0. 기획 잠금 / 개발 준비

## 5.0 목표
- 설계 문서 정렬
- 기술 스택 확정
- 저장소/개발 규칙 확정
- MVP 범위 잠금

## 5.0 주요 작업
### 5.0.1 문서 정렬
- [ ] 00 인덱스 정리
- [ ] 01~06 문서 기준선 확정
- [ ] Appendix 문서 분리 원칙 정리

### 5.0.2 기술 스택 확정
- [ ] Frontend 프레임워크 확정
- [ ] Backend 프레임워크 확정
- [ ] DB 확정
- [ ] Auth 방식 확정
- [ ] AI API 연동 방식 확정
- [ ] 배포 환경 확정

### 5.0.3 프로젝트 부트스트랩
- [ ] repo 생성
- [ ] 폴더 구조 생성
- [ ] lint / formatter / env 구조 세팅
- [ ] 공통 타입 구조 생성

## 5.0 산출물
- 기술 스택 결정서
- 초기 repo
- 환경 변수 정책
- 라우팅 골격

---

# Phase 1. 데이터 모델 + 백엔드 골격

## 5.1 목표
- BLOKS의 핵심 엔티티를 저장/조회/수정할 수 있는 최소 백엔드 확보

## 5.1 주요 작업
### 5.1.1 DB 스키마 구현
- [ ] company
- [ ] division / department
- [ ] rank / role
- [ ] character
- [ ] character_runtime_state
- [ ] project
- [ ] task
- [ ] task_dependency
- [ ] approval
- [ ] delegation (권한 위임)
- [ ] prompt_template (프롬프트 버전 마스터)
- [ ] artifact
- [ ] knowledge_document & memory_node (Vector/Embedding 포함)
- [ ] relationship
- [ ] event_log
- [ ] risk_register
- [ ] kpi_snapshot
*(💡 Vibe Coding Focus: `schema.prisma` 및 Migration Script 자동 생성 타겟. ERD 기반 1:1, 1:N 관계 파악 필수)*

### 5.1.2 시드 데이터
- [ ] BLOKS 기본 회사 데이터
- [ ] 40인 roster seed 
- [ ] Active Core seed
- [ ] 부서별 기본 컬러/zone seed
- [ ] 기본 프로젝트/태스크 예시 seed
*(💡 Vibe Coding Focus: `seed.ts` 작성 타겟. 02번 문서의 JSON 기반 맵핑)*

### 5.1.3 API 1차
- [ ] GET /projects
- [ ] POST /projects
- [ ] GET /projects/:id
- [ ] PATCH /projects/:id/state
- [ ] GET /tasks
- [ ] POST /tasks
- [ ] PATCH /tasks/:id/state
- [ ] GET /characters
- [ ] GET /characters/:id
- [ ] GET /approvals
- [ ] POST /approvals/:id/action
- [ ] GET /events
*(💡 Vibe Coding Focus: 상태가 업데이트되면 `Event_Log` 테이블에 무조건 INSERT 되도록 도메인 로직 강제)*

## 5.1 산출물
- DB schema v0.1
- seed script
- core CRUD API
- API 테스트 컬렉션

---

# Phase 2. 운영 UI 핵심 화면

## 5.2 목표
- Founder가 실제로 프로젝트를 만들고, 보고, 승인하고, 막힌 지점을 찾을 수 있는 운영 UI 확보

## 5.2 주요 작업
### 5.2.1 기본 레이아웃
- [ ] AppShell
- [ ] TopBar
- [ ] LeftNav
- [ ] RightContextPanel
- [ ] BottomEventFeed

### 5.2.2 Project 영역
- [ ] Project Board
- [ ] Project Detail
- [ ] Task Tree
- [ ] Project Header + Summary
- [ ] 상태 전이 액션 버튼

### 5.2.3 Approval & Governance 영역
- [ ] Approval Center 리스트
- [ ] Approval Detail 패널
- [ ] 승인/반려/수정 요청 UX
- [ ] reason code 선택 UI (블랙 코미디 페르소나 연동)
- [ ] 설정 / Governance (권한 위임 내역 제어)
- [ ] Model Routing & Prompt Console (프롬프트 편집기)

### 5.2.4 Character 영역
- [ ] Character Directory
- [ ] Character Detail
- [ ] 현재 상태 배지
- [ ] 업무 배정 진입 버튼

## 5.2 산출물
- 운영 가능한 UI 1차
- 상태 전이 가능한 프로젝트/태스크 화면
- 승인 흐름 동작 UI

---

# Phase 3. Company World / 아이소메트릭 뷰

## 5.3 목표
- 회사가 “살아 움직이는 세계”로 보이도록 월드 화면 구현

## 5.3 주요 작업
### 5.3.1 월드 기술 기반
- [ ] 아이소메트릭 좌표계 결정
- [ ] 카메라 이동/줌
- [ ] 충돌 체크 기본 구조
- [ ] zone 데이터 구조

### 5.3.2 월드 오브젝트
- [ ] Executive Zone
- [ ] Strategy Zone
- [ ] Marketing Zone
- [ ] Research Zone
- [ ] Engineering Zone
- [ ] Platform Ops Zone
- [ ] Meeting Room
- [ ] Founder Room
- [ ] Lounge

### 5.3.3 캐릭터 월드 연동
- [ ] 캐릭터 스프라이트 렌더링
- [ ] 상태별 애니메이션 최소 구현 (💡 Vibe Coding Focus: 피로도/번아웃 상태에 따른 글리치 및 모션 저하 시각화)
- [ ] 이동 목표 지정
- [ ] 회의실 점유 처리
- [ ] 선택/하이라이트

### 5.3.4 월드-운영 연결
- [ ] 프로젝트 핀 표시
- [ ] 긴급 이슈 핀 표시
- [ ] Active Core만 보기
- [ ] 부서 하이라이트
- [ ] 우측 상세 패널 연동
- [ ] Founder 파워 인터랙션 (💡 Vibe Coding Focus: 캐릭터 Drag&Drop 배정 지원)

## 5.3 산출물
- Home / Company World MVP
- 캐릭터 이동과 상태 표시
- 월드 기반 운영 인지

---

# Phase 4. AI 오케스트레이션 연결

## 5.4 목표
- 캐릭터들이 실제로 AI 결과물을 생성하고, 그 결과가 프로젝트/태스크/아티팩트에 연결되도록 구현

## 5.4 주요 작업
### 5.4.1 기본 오케스트레이션 레이어
- [ ] character -> model profile 매핑
- [ ] task type -> prompt template 매핑
- [ ] artifact generation pipeline
- [ ] event logging pipeline
- [ ] **RAG / Vector Search 파이프라인 (기억 추론 및 지식 검색 연동)**

### 5.4.2 AI 실행 흐름
- [ ] 기획 태스크용 기본 프롬프트
- [ ] 리서치 태스크용 기본 프롬프트
- [ ] 마케팅 태스크용 기본 프롬프트
- [ ] 코드 분업 태스크용 기본 프롬프트
- [ ] QA/review 태스크용 기본 프롬프트

### 5.4.3 실행 결과 저장
- [ ] 산출물 본문 저장
- [ ] 메타데이터 저장
- [ ] approval 연결
- [ ] 버전 히스토리 저장

### 5.4.4 안전장치
- [ ] 실패 재시도 규칙
- [ ] 예산 한도 체크 (Virtual Budget vs Real API 토큰 비용 동시 추적)
- [ ] 무한 루프 방지 및 모델 최대 토큰 Limit 제어
- [ ] timeout 처리
- [ ] low confidence 플래그

## 5.4 산출물
- 최소 AI 작업 실행 가능
- Artifact 생성 가능
- 승인 흐름에 AI 결과 연결

---

# Phase 5. Analytics / Knowledge / MVP 마감

## 5.5 목표
- 운영 성과와 회사 기억을 볼 수 있게 하고, MVP 데모 품질을 확보

## 5.5 주요 작업
### 5.5.1 Analytics
- [ ] KPI 카드
- [ ] 상태 분포 차트
- [ ] 부서별 업무량 차트
- [ ] overload 현황
- [ ] 승인 리드타임 요약

### 5.5.2 Knowledge Vault
- [ ] Artifact 목록
- [ ] 문서 타입 필터
- [ ] 프로젝트별 연결
- [ ] 캐릭터별 연결
- [ ] 중요 문서 고정

### 5.5.3 마감 품질
- [ ] 오류 상태 정리
- [ ] empty state 디자인
- [ ] loading / skeleton UI
- [ ] 데모 seed 시나리오 구성
- [ ] Founder 관점 시연 스크립트 작성

## 5.5 산출물
- Analytics Dashboard MVP
- Knowledge Vault MVP
- 데모 가능한 MVP 빌드

---

## 6. 기능 우선순위 매트릭스

### 6.1 Must Have
- 프로젝트 CRUD
- 태스크 상태 전이
- 승인 흐름
- 캐릭터 조회
- 이벤트 로그
- 기본 월드 화면
- 최소 AI 산출물 생성

### 6.2 Should Have
- Analytics
- Knowledge Vault
- 부서 하이라이트
- relationship summary
- risk 경고 UI

### 6.3 Could Have
- 감정/정치 초기 반영
- 회의 자동 생성
- 부서별 생산성 랭킹
- 모델 사용량 패널

### 6.4 Won’t Have Yet
- 모바일 완성형
- 멀티유저
- 외부 고객용 포털
- 정교한 경제 시스템
- 음성/보이스 캐릭터

---

## 7. MVP 사용자 시나리오 기준 완료 조건

### 시나리오 A — Founder가 프로젝트를 생성한다
완료 조건:
- Founder가 새 프로젝트를 등록할 수 있다.
- 프로젝트가 Intake로 생성된다.
- COO 또는 PMO가 담당된다.
- Event Log에 기록된다.

### 시나리오 B — Strategy 팀이 기획을 진행한다
완료 조건:
- PRD 관련 태스크가 생성된다.
- 담당 캐릭터가 Assigned → Accepted → In Progress로 이동한다.
- 산출물이 Artifact로 저장된다.

### 시나리오 C — Approval이 발생한다
완료 조건:
- Pending Review가 생긴다.
- Approval Center에서 승인/반려 가능하다.
- 반려 시 reason code가 저장된다.

### 시나리오 D — Company World에서 상황을 본다
완료 조건:
- 캐릭터들이 zone 안에서 보인다.
- 상태 뱃지가 보인다.
- 클릭 시 상세 패널이 뜬다.

### 시나리오 E — Analytics로 병목을 확인한다
완료 조건:
- 승인 지연 / overload / 상태 분포를 확인할 수 있다.

---

## 8. 기술 작업 분류 기준 WBS 코드

### FE
- FE-01 앱 셸
- FE-02 프로젝트 보드
- FE-03 프로젝트 상세
- FE-04 캐릭터 디렉토리
- FE-05 캐릭터 상세
- FE-06 승인 센터
- FE-07 월드 뷰
- FE-08 애널리틱스
- FE-09 지식 저장소

### BE
- BE-01 스키마/마이그레이션
- BE-02 프로젝트 API
- BE-03 태스크 API
- BE-04 승인 API
- BE-05 캐릭터 API
- BE-06 이벤트 로그 API
- BE-07 아티팩트 API

### AI
- AI-01 모델 프로필 정의
- AI-02 프롬프트 템플릿
- AI-03 task orchestration
- AI-04 artifact generation
- AI-05 review/QA flows

### DATA / OPS
- OP-01 seed data
- OP-02 env 관리
- OP-03 배포 설정
- OP-04 모니터링/로그
- OP-05 데모 시나리오 seed

---

## 9. 추천 개발 순서

### 1차 주행
- BE-01
- BE-02
- BE-03
- FE-01
- FE-02
- FE-03

### 2차 주행
- BE-04
- FE-06
- BE-05
- FE-04
- FE-05
- BE-06

### 3차 주행
- FE-07
- 월드 캐릭터 표시
- zone 클릭 / 선택 / 상세 연동

### 4차 주행
- AI-01 ~ AI-04
- Artifact 연동
- Approval 연결

### 5차 주행
- FE-08
- FE-09
- 마감 정리

---

## 10. 팀/리소스 관점 역할 분담 예시

### 1인 개발 기준
- 제품기획: Founder
- 프론트: 1
- 백엔드: 1
- AI/오케스트레이션: 1
- 디자인/아트: 최소 템플릿 기반

실제로는 1인이 병행 가능하되, 반드시 아래 순서를 지킨다.
- 데이터
- 화면
- 월드
- AI
- polish

### 소규모 팀 기준
- PM / Product
- FE
- BE
- AI Engineer
- UI/Pixel Artist

---

## 11. 리스크 및 대응

### 11.1 가장 큰 리스크
1. 월드 뷰에 시간을 너무 많이 씀
2. 캐릭터 설정만 하다가 엔진이 안 만들어짐
3. AI 호출 비용이 예측보다 빠르게 증가
4. 승인/상태머신이 UI와 분리되어 꼬임
5. 40인 전체를 동시에 활성화하려다가 성능 저하

### 11.2 대응
- 월드는 연출보다 기능 우선
- Active Core 14명만 먼저 운영
- AI 실행은 샘플/온디맨드 우선
- 상태 전이는 서버에서만 결정
- 후순위 기능은 초기에 숨김

---

## 12. Definition of Done

### 12.1 문서 기준 DoD
- 각 핵심 문서(01~06)가 존재한다
- 번호 체계가 고정된다
- MVP 범위가 잠긴다

### 12.2 제품 기준 DoD
- Founder가 새 프로젝트를 만들 수 있다
- 캐릭터에게 태스크를 배정할 수 있다
- 프로젝트/태스크/승인 상태가 실제로 전이된다
- 이벤트 로그가 남는다
- 월드 화면에서 캐릭터 상태를 볼 수 있다
- AI 산출물 1종 이상 생성된다
- Analytics에서 최소 3개 KPI를 볼 수 있다

---

## 13. 다음 문서 연결
다음 문서는 아래 둘 중 하나가 자연스럽다.

1. 07_BLOKS_appendix_character_schema_mapping_v0.1.md
2. 07_BLOKS_build_stack_and_repo_structure_v0.1.md

현재 실무상 더 추천하는 것은:

**07_BLOKS_build_stack_and_repo_structure_v0.1.md**

이유:
이제 문서 단계는 MVP 실행 수준까지 왔기 때문에,
다음은 실제 개발을 위한 repo 구조, 폴더 구조, 기술 스택, 환경변수, 배포 전략을 고정하는 것이 가장 실용적이다.
