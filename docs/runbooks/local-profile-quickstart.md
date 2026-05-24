# Local Profile Quickstart

`BLOKS_PROFILE=local`로 실행하면 Supabase 및 Redis 없이 서버를 기동할 수 있다.

## 기동 방법

```bash
# .env 파일에 설정 (또는 직접 export)
echo "BLOKS_PROFILE=local" >> .env

pnpm dev
# 또는
BLOKS_PROFILE=local pnpm dev
```

## Local Profile에서 동작하는 기능

| 기능 | 상태 | 비고 |
|------|------|------|
| API 서버 기동 | ✅ | Supabase 연결 없이 시작 |
| Worker 기동 | ✅ | Redis/BullMQ 없이 시작 |
| `POST /api/v1/runtime/execute` | ✅ | 정책 평가 → 도구 실행 → 감사 기록 |
| `GET /api/v1/runtime/audit` | ✅ | `.bloks-audit/audit.jsonl` 에서 읽기 |
| `GET /api/v1/runtime/audit/export` | ✅ | JSONL / CSV 내보내기 |
| `GET /api/v1/runtime/audit/verify` | ✅ | SHA-256 해시 체인 검증 |
| `POST /api/v1/runtime/execution/pause` | ✅ | 긴급 정지 |
| `POST /api/v1/runtime/execution/resume` | ✅ | 실행 재개 |
| 감사 로그 영구 보존 | ✅ | 서버 재시작 후에도 유지 (JSONL 파일) |
| 비밀값 마스킹 | ✅ | API key / Bearer token 자동 마스킹 |

## Local Profile에서 제한되는 기능

| 기능 | 상태 | 이유 |
|------|------|------|
| 캐릭터/태스크/프로젝트 조회 | ⚠️ 빈 결과 | Supabase stub이 빈 배열 반환 |
| 월드 틱 엔진 (자동 AI 행동) | ⚠️ 비활성 | 캐릭터 데이터 없음 |
| 잡 큐 처리 (POST /api/v1/jobs) | ⚠️ 인큐만 됨 | BullMQ Worker 없음, 처리 안 됨 |
| SSE 스트림 실시간 이벤트 | ⚠️ 부분 | Redis pub 없음, 기존 HTTP poll만 동작 |

## Local Profile 첫 번째 실행 검증

API가 기동된 후 아래 명령으로 runtime 경로를 검증한다:

```bash
# 1. 서버 상태 확인
curl http://localhost:4000/health

# 2. 도구 실행 (globalToolRegistry에 등록된 도구 필요)
curl -X POST http://localhost:4000/api/v1/runtime/execute \
  -H "Content-Type: application/json" \
  -H "x-dev-bypass-auth: 1" \
  -d '{"toolName":"ai.task.execute","input":{"characterId":"test","taskType":"test","prompt":"hello","systemPrompt":"you are helpful"},"characterId":"test-char"}'

# 3. 감사 로그 조회
curl http://localhost:4000/api/v1/runtime/audit \
  -H "x-dev-bypass-auth: 1"

# 4. 감사 로그 내보내기
curl "http://localhost:4000/api/v1/runtime/audit/export?format=jsonl" \
  -H "x-dev-bypass-auth: 1"
```

## 감사 로그 파일 위치

기본값: 프로세스 실행 디렉토리의 `.bloks-audit/audit.jsonl`

변경 방법:
```bash
BLOKS_AUDIT_DIR=/path/to/audit pnpm dev
```

## 다음 단계 (연결 모드)

캐릭터/태스크/프로젝트 기능 전체를 사용하려면 연결 모드가 필요하다:

```bash
# .env
BLOKS_PROFILE=connected
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=redis://localhost:6379
```

로컬 Docker로 실행:
```bash
docker compose up -d  # postgres + redis
pnpm db:migrate       # 스키마 적용
pnpm db:seed          # 초기 데이터
BLOKS_PROFILE=connected pnpm dev
```
