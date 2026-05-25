# BLOKS Incident Response Runbook

## 1. API 서버 응답 없음

**증상:** `GET /health` 타임아웃, 프론트엔드 로딩 불가

**진단:**
```bash
curl http://localhost:4000/health
docker compose ps          # api 컨테이너 상태
docker compose logs api    # 마지막 에러 확인
```

**조치:**
```bash
docker compose restart api
# 또는 PM2 사용 시:
pm2 restart bloks-api
```

**재발 방지:** `/metrics/p95` 엔드포인트로 P95 > 2000ms 트렌드 확인

---

## 2. DB 연결 실패

**증상:** `[BLOKS API] Supabase init failed` 또는 `Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`

**코드 위치:** `apps/api/src/index.ts:143` (init check), `packages/db/src/supabase.ts`

**진단:**
```bash
# 환경변수 확인
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
# .env 파일 확인
cat apps/api/.env | grep SUPABASE
```

**조치:**
1. `.env` 파일에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 설정 확인
2. Supabase 대시보드에서 프로젝트 상태 확인 (일시정지 여부)
3. API 서버 재시작

---

## 3. Redis 연결 실패

**증상:** `[ioredis] Unhandled error event: connect ECONNREFUSED 127.0.0.1:6379`, BullMQ 작업 처리 안됨, SSE 스트림 미작동

**진단:**
```bash
docker compose ps redis
redis-cli ping             # PONG이면 정상
```

**조치:**
```bash
docker compose up -d redis
# 컨테이너 외부 Redis 사용 시:
systemctl status redis
systemctl restart redis
```

**참고:** Redis 없어도 API HTTP 라우트는 동작함. SSE와 BullMQ만 영향 받음.

---

## 4. Outbox 적체 (Outbox 발행 미완료)

**증상:** DB `outbox_events` 테이블에 `published_at IS NULL` 행이 다수 쌓임

**코드 위치:** `apps/worker/src/tick-engine.ts:1067` (`phaseRelayOutbox`)

**진단:**
```sql
-- Supabase SQL Editor에서 실행
SELECT COUNT(*), MIN(created_at) FROM outbox_events WHERE published_at IS NULL;
```

**조치:**
1. tick-engine(worker)이 실행 중인지 확인: `docker compose ps worker`
2. worker를 재시작하면 다음 tick(60s)에 Phase 13이 자동으로 발행 처리
3. Redis 연결 문제가 원인인 경우 → 3번 시나리오 먼저 해결

**자동 복구:** tick-engine Phase 13은 60초 이상 된 미발행 행을 매 tick마다 자동 재발행함

---

## 5. AI 비용 초과 (`AI_BUDGET_EXCEEDED`)

**증상:** 태스크 실행 시 `AI_BUDGET_EXCEEDED: estimated cost exceeds X USD` 에러

**코드 위치:** `packages/ai-router/src/index.ts:271` (budget guard)

**진단:**
```bash
# 현재 설정값 확인
echo $AI_MAX_COST_PER_TASK_USD   # 기본값: 0.50
```

**조치 (단기):** `.env`에서 임시로 한도 상향
```
AI_MAX_COST_PER_TASK_USD=1.0
```

**조치 (근본):** 해당 태스크의 `systemPrompt`나 `prompt` 길이 확인, 불필요한 컨텍스트 제거

**모니터링:** `/api/v1/metrics/costs`로 프로젝트별 누적 비용 확인

---

## 6. BullMQ 큐 적체

**증상:** 작업이 큐에 쌓이지만 처리 안됨, `/metrics/queues`에서 depth > 50

**코드 위치:** `apps/worker/src/tick-engine.ts:1147` (`phaseSnapshotQueues`)

**진단:**
```bash
docker compose ps worker
docker compose logs worker --tail 50
# Redis에서 직접 확인
redis-cli keys "bull:*:wait" | xargs redis-cli llen
```

**조치:**
```bash
# worker 재시작
docker compose restart worker

# WORKER_CONCURRENCY 조정 (기본 5)
# .env에서:
WORKER_CONCURRENCY=10
```

**주의:** `analyticsRollups`, `notifications` 큐 적체는 우선순위 낮음. `aiActions`, `workflowTransitions` 적체가 즉각 대응 대상.

---

## 7. RuntimeEngine — 모든 실행이 denied

**증상:** `/api/v1/runtime/execute` 가 항상 `{ status: "denied" }` 반환

**코드 위치:** `packages/policy-engine/src/evaluate.ts` (정책 평가), `packages/agent-runtime/src/runtime-engine.ts`

**진단:**
```bash
# 감사 로그에서 denied 패턴 확인
curl http://localhost:4000/api/v1/runtime/audit | jq '.data[] | select(.execution.status == "denied")'

# policy-engine 기본 정책 확인 (deny-unknown-tools가 동작 중인지)
```

**조치:**
1. `toolName`이 `globalToolRegistry`에 등록되었는지 확인 — `apps/worker/src/tools.ts` 또는 `apps/runtime-daemon/src/tool-adapters.ts`
2. L3(destructive) 정책이 의도치 않게 적용된 경우 `packages/policy-engine/src/evaluate.ts` 의 riskLevel 매핑 확인
3. character `ai_enabled = false` 상태 확인

---

## 8. 로컬 모드 데몬(4001) 응답 없음

**증상:** `bloks-os doctor` 에서 `런타임 데몬 (4001) 응답 없음`

**코드 위치:** `apps/runtime-daemon/src/index.ts`

**진단:**
```bash
# Windows
netstat -ano | findstr :4001
# macOS/Linux
lsof -i :4001

# 수동 헬스체크
curl http://localhost:4001/health
```

**조치:**
```bash
# 직접 시작 (dev 모드)
pnpm --filter runtime-daemon dev

# 또는 bloks-os start 로 전체 스택 재시작
pnpm bloks-os start
```

**참고:** 데몬은 L0/L1 자동실행, L2 승인 대기 도구만 처리함. 데몬 없이도 API(4000)를 통한 RuntimeEngine은 동작함.

---

## 9. 승인 대기 실행이 처리 안 됨

**증상:** `/api/v1/runtime/approvals` 에 항목이 계속 남아 있음, 에이전트가 멈춘 것처럼 보임

**코드 위치:** `apps/api/src/routes/runtime-approvals.ts`, `apps/api/src/runtime-store.ts`

**진단:**
```bash
# 대기 중인 실행 목록 확인
curl http://localhost:4000/api/v1/runtime/approvals | jq '.data.items'

# 실행 ID로 승인 처리
EXEC_ID="exec_xxx"
curl -X POST http://localhost:4000/api/v1/runtime/approvals/$EXEC_ID/approve
```

**조치:**
1. 대기 항목이 L2(shell.exec, git.push)인지 확인 — 정상적인 승인 요청임
2. 웹 UI → `/approvals` 페이지에서 승인 버튼 클릭
3. 서버가 재시작된 경우 인메모리 상태가 초기화되어 대기 항목이 사라질 수 있음 (Wave 8에서 DB 영속화 예정)

**현재 제약:** 승인 상태는 인메모리(`apps/api/src/runtime-store.ts`). 서버 재시작 시 초기화됨.

---

## 체크리스트 (전체 장애 시)

1. `GET /health` → API 생존 확인
2. `docker compose ps` → 컨테이너 상태 확인
3. `docker compose logs api --tail 100` → 에러 패턴 확인
4. `redis-cli ping` → Redis 확인
5. Supabase 대시보드 → DB 상태 확인
6. `GET /api/v1/metrics/p95?hours=1` → 최근 응답시간 확인
