# ABAP Design

- Generated: 2026-05-25T03:48:17.265Z
- Brief: BLOKS capability pack execution
- Source Scenario: program-result.json

## Reused Design Context

```markdown
# 시스템 설계 문서: bloks-cli

## 1. 아키텍처 개요
```
```
+-------------------+
|      CLI          |
| (bloks-cli)       |
+-------------------+
          |
          v
+-------------------+
|     FastAPI       |
| (API 서버)       |
+-------------------+
          |
          v
+-------------------+
|     SQLite        |
| (로컬 캐시)      |
+-------------------+
          |
          v
+-------------------+
|     BLOKS API     |
+-------------------+
```

## 2. 데이터 모델
### 2.1 Task 테이블
| 컬럼명       | 타입         | 제약조건                |
|--------------|--------------|-------------------------|
| id           | INTEGER      | PRIMARY KEY, AUTOINCREMENT |
| title        | TEXT         | NOT NULL                |
| description  | TEXT         |                         |
| status       | TEXT         | NOT NULL, DEFAULT 'pending' |
| created_at   | DATETIME     | DEFAULT CURRENT_TIMESTAMP |
| project_id   | INTEGER      | FOREIGN KEY REFERENCES Project(id) |

### 2.2 Project 테이블
| 컬럼명       | 타입         | 제약조건                |
|--------------|--------------|-------------------------|
| id           | INTEGER      | PRIMARY KEY, AUTOINCREMENT |
| name         | TEXT         | NOT NULL                |
| description  | TEXT         |                         |
| created_at   | DATETIME     | DEFAULT CURRENT_TIMESTAMP |

### 2.3 Character 테이블
| 컬럼명       | 타입         | 제약조건                |
|--------------|--------------|-------------------------|
| id           | INTEGER      | PRIMARY KEY, AUTOINCREMENT |
| name         | TEXT         | NOT NULL                |
| role         | TEXT         | NOT NULL                |
| project_id   | INTEGER      | FOREIGN KEY REFERENCES Project(id) |

## 3. API 엔드포인트 목록
| 메서드 | 경로                | 요청 형식                        | 응답 형식                        |
|--------|---------------------|----------------------------------|----------------------------------|
| GET    | /tasks              | 없음                             | Task 목록 (JSON)               |
| POST   | /tasks              | { title: string, description: string } | 생성된 Task (JSON)              |
| PUT    | /tasks/{id}/done    | 없음                             | 업데이트된 Task (JSON)          |
| GET    | /projects           | 없음                             | Project 목록 (JSON)            |
| POST   | /projects           | { name: string, description: string } | 생성된 Project (JSON)           |
| GET    | /characters         | 없음                             | Character 목록 (JSON)           |
| POST   | /characters         | { name: string, role: string }  | 생성된 Character (JSON)         |
| GET    | /tasks/{id}         | 없음                             | 특정 Task (JSON)                |

## 4. CLI 명령어 설계
- `bloks task list`: 모든 태스크 목록 조회
- `bloks task add --title "제목" --description "설명"`: 태스크 추가
- `bloks task done --id {task_id}`: 태스크 완료 처리
- `bloks task assign --id {task_id} --character {character_name}`: 태스크에 캐릭터 할당
- `bloks project list`: 모든 프로젝트 목록 조회
- `bloks project add --name "프로젝트명"`: 프로젝트 추가
- `bloks character list`: 모든 캐릭터 목록 조회
- `bloks character add --name "캐릭터명" --role "역할"`: 캐릭터 추가

## 5. 기술 스택 선정 이유
### FastAPI vs Flask vs Django
- **FastAPI**: 비동기 처리 지원, 높은 성능, 자동 문서화 기능으로 빠른 API 개발에 적합.
- **Flask**: 경량 프레임워크지만 비동기 지원 부족.
- **Django**: 강력하지만 과도한 기능으로 인해 경량화된 CLI 도구 개발에 비효율적.

### SQLite vs PostgreSQL
- **SQLite**: 경량화된 로컬 캐시로 개발 초기에는 적합.
- **PostgreSQL**: 확장성 및 성능이 뛰어나지만 초기 개발에는 필요하지 않음.

## 6. 디렉토리 구조
```
bloks-cli/
├── bloks_cli/
│   ├── __init__.py
│   ├── cli.py
│   ├── api.py
│   ├── models.py
│   └── database.py
├── tests/
│   ├── __init__.py
│   └── test_bloks_cli.py
├── requirements.txt
└── README.md
```

## 7. 개발 우선순위
### Phase 1 (MVP)
- 기본 CLI 기능 구현 (태스크 조회, 추가, 완료 처리)
- FastAPI 서버 구축
- SQLite 데이터베이스 설정 및 Task 모델 구현

### Phase 2 (확장)
- 프로젝트 및 캐릭터 관리 기능 추가
- API 엔드포인트 확장 및 문서화
- 성능 최적화 및 비동기 처리 추가
```

