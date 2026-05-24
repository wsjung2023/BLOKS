// Scenario C — BLOKS 내부 CLI 도구 개발

const BLOKS_CONTEXT = `
[프로젝트 배경]
BLOKS 팀 내부에서 사용할 태스크 관리 CLI 도구를 개발한다.
- 도구명: bloks-cli
- 목적: BLOKS API와 연동하여 터미널에서 태스크를 조회·생성·완료 처리할 수 있는 개발자용 CLI
- 주요 사용자: BLOKS 개발팀 및 파트너 에이전시 개발자
- 기술 스택: Python 3.11+, FastAPI(API 서버), Click(CLI), SQLite(로컬 캐시), HTML/JS(웹 UI)
`.trim();

export const programScenario = {
  name: "program",
  projectTitle: "bloks-cli 태스크 관리 도구 개발",
  projectBrief: "BLOKS 팀 내부용 태스크 관리 CLI+API 도구를 설계·개발·QA까지 완성한다. Python FastAPI 서버, CLI 인터페이스, 웹 UI를 포함한다.",
  projectPriority: "High",
  tasks: [
    {
      codeName: "arch",
      title: "시스템 설계 문서",
      taskType: "planningDocument",
      priority: "High",
      description: `${BLOKS_CONTEXT}

bloks-cli 도구의 전체 시스템 설계 문서를 작성한다.

반드시 아래 내용을 포함할 것:
1. 아키텍처 개요: 컴포넌트 구성도 (CLI → FastAPI → SQLite → BLOKS API 흐름을 ASCII 다이어그램으로)
2. 데이터 모델: Task, Project, Character 테이블 스키마 (컬럼명·타입·제약조건 포함)
3. API 엔드포인트 목록: 메서드, 경로, 요청/응답 형식 (최소 8개 엔드포인트)
4. CLI 명령어 설계: bloks task list / add / done / assign 등 주요 명령어 + 옵션 플래그
5. 기술 스택 선정 이유: FastAPI vs Flask vs Django, SQLite vs PostgreSQL 비교
6. 디렉토리 구조: 파일 트리 형태로 프로젝트 구조 제시
7. 개발 우선순위: Phase 1 (MVP) / Phase 2 (확장) 구분

완성된 설계 문서를 마크다운 형태로 출력한다.`,
    },
    {
      codeName: "forge",
      title: "FastAPI REST 서버 구현",
      taskType: "code_development",
      priority: "High",
      description: `${BLOKS_CONTEXT}

bloks-cli의 백엔드 REST API를 Python FastAPI로 구현한다.

반드시 아래 엔드포인트를 모두 포함한 완성된 Python 코드를 출력할 것:
- GET    /tasks              — 태스크 목록 조회 (필터: status, project_id)
- POST   /tasks              — 태스크 생성
- GET    /tasks/{id}         — 태스크 단건 조회
- PATCH  /tasks/{id}         — 태스크 수정 (status, assignee 등)
- DELETE /tasks/{id}         — 태스크 삭제
- GET    /projects           — 프로젝트 목록
- POST   /projects           — 프로젝트 생성
- GET    /health             — 헬스체크

구현 요구사항:
- SQLite + SQLAlchemy ORM 사용 (데이터 영속성)
- Pydantic 모델로 요청/응답 스키마 정의
- 적절한 HTTP 상태코드 반환 (404, 422 등)
- CORS 미들웨어 포함 (웹 UI 연동용)
- 앱 시작 시 테이블 자동 생성

완성된 실행 가능한 Python 코드를 \`\`\`python 코드블록으로 출력한다. 파일은 main.py 하나로 모든 코드를 포함한다.`,
    },
    {
      codeName: "glitch",
      title: "웹 UI 구현",
      taskType: "web_development",
      priority: "Medium",
      description: `${BLOKS_CONTEXT}

bloks-cli 도구의 웹 인터페이스를 단일 HTML 파일로 구현한다.
API 서버는 http://localhost:8000 에서 실행 중이라고 가정한다.

반드시 아래 기능을 모두 포함한 완성된 HTML 파일을 출력할 것:
1. 태스크 목록 화면: 카드 형태로 표시, 상태별 색상 구분 (Todo/InProgress/Done)
2. 태스크 추가 폼: 제목, 프로젝트, 우선순위 입력
3. 태스크 상태 변경: 카드 클릭 → 상태 토글 (Todo → InProgress → Done)
4. 태스크 삭제: 삭제 버튼
5. 실시간 API 연동: fetch()로 FastAPI 서버와 통신, 페이지 로드 시 자동 조회
6. 로딩/에러 상태 처리: 서버 미응답 시 에러 메시지 표시

디자인 요구사항:
- BLOKS 브랜드 컬러: 딥 다크(#0f0f1a) 배경, 네온 퍼플(#7c3aed) 포인트
- 인라인 CSS 포함, 외부 라이브러리 없이 순수 HTML/CSS/JS만 사용
- 반응형 레이아웃 (모바일 지원)

완성된 단일 HTML 파일을 \`\`\`html 코드블록으로 출력한다. 실제로 브라우저에서 열어 사용 가능해야 한다.`,
    },
    {
      codeName: "stack",
      title: "공통 유틸리티 모듈 작성",
      taskType: "code_development",
      priority: "Medium",
      description: `${BLOKS_CONTEXT}

bloks-cli에서 공통으로 사용하는 Python 유틸리티 모듈을 작성한다.

반드시 아래 함수들을 모두 구현한 완성된 Python 코드를 출력할 것:
1. format_date(dt: datetime) → str — "2024-01-15 (월) 오후 3:30" 형태 한국식 날짜 포맷
2. format_relative(dt: datetime) → str — "3시간 전", "2일 전", "방금 전" 상대 시간
3. sort_tasks(tasks: list, key: str, reverse: bool) → list — 우선순위/날짜/제목 정렬
4. validate_task(data: dict) → tuple[bool, list[str]] — 필수 필드·타입 검증, 오류 메시지 반환
5. truncate(text: str, max_len: int, suffix: str = "...") → str — 텍스트 말줄임
6. priority_color(priority: str) → str — "High"→"🔴", "Medium"→"🟡", "Low"→"🟢" 이모지 반환
7. parse_cli_date(text: str) → datetime | None — "오늘", "내일", "2024-01-15" 파싱
8. mask_id(id: str, visible: int = 8) → str — ID 앞 N자만 표시

각 함수에 타입 힌트, docstring(1줄), 사용 예시 주석을 포함한다.
완성된 utils.py 모듈을 \`\`\`python 코드블록으로 출력한다.`,
    },
    {
      codeName: "debug",
      title: "테스트 케이스 문서 작성",
      taskType: "document",
      priority: "Medium",
      description: `${BLOKS_CONTEXT}

bloks-cli FastAPI 서버의 테스트 케이스 문서와 실제 pytest 코드를 작성한다.

반드시 아래 내용을 포함할 것:
1. 테스트 전략 요약 (단위/통합/E2E 범위 정의)
2. 엔드포인트별 테스트 케이스 목록 (Happy path + Edge case 각 3개씩):
   - POST /tasks: 정상 생성 / 필수 필드 누락 / 잘못된 타입
   - GET /tasks: 목록 조회 / 빈 결과 / 필터 적용
   - PATCH /tasks/{id}: 정상 수정 / 존재하지 않는 ID / 부분 업데이트
   - DELETE /tasks/{id}: 정상 삭제 / 없는 ID 삭제 시도
3. 실제 실행 가능한 pytest 코드: TestClient를 사용한 통합 테스트

pytest 코드는 \`\`\`python 코드블록으로 출력한다.
테스트 케이스 목록은 표 형태(| 테스트명 | 입력 | 기대 결과 | 상태코드 |)로 작성한다.`,
    },
    {
      codeName: "nexus",
      title: "코드 리뷰 메모",
      taskType: "strategy_memo",
      priority: "High",
      description: `${BLOKS_CONTEXT}

bloks-cli의 FastAPI 서버 코드와 유틸리티 모듈에 대한 코드 리뷰 메모를 작성한다.

반드시 아래 관점에서 구체적인 개선 제안을 포함할 것:
1. 보안 검토:
   - SQL Injection 위험 여부 (SQLAlchemy ORM 사용 시 안전한지)
   - 입력 검증 누락 포인트
   - CORS 설정의 프로덕션 환경 위험성
2. 성능 최적화:
   - N+1 쿼리 문제 가능성
   - 페이지네이션 미적용 시 대용량 데이터 처리 이슈
   - 인덱스 필요 컬럼 제안
3. 코드 품질:
   - 에러 핸들링 개선 포인트 (구체적 코드 예시 포함)
   - 중복 코드 리팩터링 제안
   - 타입 힌트 강화 포인트
4. 프로덕션 체크리스트:
   - 환경변수 관리 (DATABASE_URL, SECRET_KEY 등)
   - 로깅 설정
   - 헬스체크 개선
5. 종합 평가: 현재 코드 완성도 점수 (10점 만점) + 다음 스프린트 우선순위 3가지

각 섹션에 구체적인 코드 예시(개선 전/후)를 \`\`\`python 블록으로 포함한다.`,
    },
  ],
};
