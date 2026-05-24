#!/usr/bin/env node
/**
 * BLOKS p95 응답 지연 측정 도구
 *
 * 사용법:
 *   pnpm perf:p95                         # 기본 설정 (50 요청, 5 동시)
 *   PERF_REQUESTS=200 pnpm perf:p95       # 요청 수 조정
 *   PERF_CONCURRENCY=10 pnpm perf:p95     # 동시 연결 수 조정
 *   PERF_TARGET=http://prod.example.com pnpm perf:p95  # 대상 서버
 *
 * 목표: p95 ≤ 2000ms (GA 릴리즈 게이트)
 * 종료 코드: 0=통과, 1=측정 실패, 2=p95 초과
 */

const API_BASE = process.env.PERF_TARGET ?? "http://localhost:4000";
const TOTAL_REQUESTS = parseInt(process.env.PERF_REQUESTS ?? "50", 10);
const CONCURRENCY = parseInt(process.env.PERF_CONCURRENCY ?? "5", 10);
const P95_THRESHOLD_MS = parseInt(process.env.PERF_P95_THRESHOLD ?? "2000", 10);
const AUTH_TOKEN = process.env.PERF_AUTH_TOKEN ?? "dev-bypass";

// 측정할 엔드포인트 목록 (GET only)
const ENDPOINTS = [
  { path: "/api/v1/characters", weight: 3 },
  { path: "/api/v1/projects", weight: 3 },
  { path: "/api/v1/world/snapshot", weight: 2 },
  { path: "/api/v1/runtime/audit", weight: 1 },
  { path: "/api/v1/runtime/execution/status", weight: 1 },
];

// 가중치 기반 랜덤 엔드포인트 선택
const WEIGHTED_ENDPOINTS = ENDPOINTS.flatMap((e) => Array(e.weight).fill(e.path));

function pickEndpoint() {
  return WEIGHTED_ENDPOINTS[Math.floor(Math.random() * WEIGHTED_ENDPOINTS.length)];
}

// 단일 요청 실행 및 응답 시간 측정
async function measureRequest(path) {
  const url = `${API_BASE}${path}`;
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "x-dev-bypass-auth": "1",
        Accept: "application/json",
      },
    });
    const durationMs = performance.now() - start;
    return { path, status: res.status, durationMs, error: null };
  } catch (err) {
    const durationMs = performance.now() - start;
    return { path, status: 0, durationMs, error: err.message };
  }
}

// 동시 요청 배치 실행
async function runBatch(batchSize) {
  const requests = Array.from({ length: batchSize }, () => measureRequest(pickEndpoint()));
  return Promise.all(requests);
}

// 퍼센타일 계산
function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// 결과 출력
function formatMs(ms) {
  return `${Math.round(ms)}ms`;
}

function printReport(results) {
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const errors = results.filter((r) => r.error !== null || r.status === 0);
  const non2xx = results.filter((r) => r.status !== 0 && (r.status < 200 || r.status >= 300));

  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const min = durations[0];
  const max = durations[durations.length - 1];

  const endpointStats = {};
  for (const r of results) {
    if (!endpointStats[r.path]) endpointStats[r.path] = [];
    endpointStats[r.path].push(r.durationMs);
  }

  console.log("\n" + "═".repeat(60));
  console.log("  BLOKS p95 응답 지연 측정 결과");
  console.log("═".repeat(60));
  console.log(`  대상: ${API_BASE}`);
  console.log(`  총 요청: ${results.length}개 | 동시: ${CONCURRENCY}개`);
  console.log(`  오류: ${errors.length}개 | 비-2xx: ${non2xx.length}개`);
  console.log("─".repeat(60));
  console.log(`  최소값:  ${formatMs(min)}`);
  console.log(`  평균:    ${formatMs(avg)}`);
  console.log(`  p50:     ${formatMs(p50)}`);
  console.log(`  p95:     ${formatMs(p95)}  ← 목표: ≤ ${P95_THRESHOLD_MS}ms`);
  console.log(`  p99:     ${formatMs(p99)}`);
  console.log(`  최대값:  ${formatMs(max)}`);
  console.log("─".repeat(60));
  console.log("  엔드포인트별 p95:");
  for (const [path, times] of Object.entries(endpointStats)) {
    const sorted = times.slice().sort((a, b) => a - b);
    const ep95 = percentile(sorted, 95);
    const marker = ep95 > P95_THRESHOLD_MS ? " ⚠️" : " ✓";
    console.log(`    ${marker} ${path.padEnd(40)} p95=${formatMs(ep95)}`);
  }
  console.log("═".repeat(60));

  const passed = p95 <= P95_THRESHOLD_MS && errors.length === 0;
  if (passed) {
    console.log(`  ✅ PASS — p95 ${formatMs(p95)} ≤ ${P95_THRESHOLD_MS}ms`);
  } else {
    if (errors.length > 0) console.log(`  ❌ FAIL — 오류 ${errors.length}개 발생`);
    if (p95 > P95_THRESHOLD_MS) console.log(`  ❌ FAIL — p95 ${formatMs(p95)} > ${P95_THRESHOLD_MS}ms (목표 초과)`);
  }
  console.log("═".repeat(60) + "\n");

  return { p95, passed, errors: errors.length };
}

async function main() {
  console.log(`\n[perf:p95] 측정 시작 — ${TOTAL_REQUESTS}개 요청, 동시 ${CONCURRENCY}개`);
  console.log(`[perf:p95] 대상: ${API_BASE}`);

  // 연결 확인
  try {
    const healthRes = await fetch(`${API_BASE}/api/v1/runtime/execution/status`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}`, "x-dev-bypass-auth": "1" },
    });
    if (!healthRes.ok && healthRes.status !== 401) {
      throw new Error(`서버 응답 오류: ${healthRes.status}`);
    }
    console.log(`[perf:p95] 서버 연결 확인 ✓ (${healthRes.status})`);
  } catch (err) {
    console.error(`[perf:p95] 서버에 연결할 수 없습니다: ${err.message}`);
    console.error(`[perf:p95] '${API_BASE}'에서 API 서버가 실행 중인지 확인하세요.`);
    process.exit(1);
  }

  // 워밍업 (3 요청)
  console.log("[perf:p95] 워밍업 중...");
  await runBatch(3);

  // 본 측정
  const results = [];
  let completed = 0;
  const batches = Math.ceil(TOTAL_REQUESTS / CONCURRENCY);

  process.stdout.write("[perf:p95] 측정 중 ");
  for (let i = 0; i < batches; i++) {
    const batchSize = Math.min(CONCURRENCY, TOTAL_REQUESTS - completed);
    const batchResults = await runBatch(batchSize);
    results.push(...batchResults);
    completed += batchSize;
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  const { passed, errors } = printReport(results);

  if (errors > 0) process.exit(1);
  if (!passed) process.exit(2);
  process.exit(0);
}

main().catch((err) => {
  console.error("[perf:p95] 예상치 못한 오류:", err.message);
  process.exit(1);
});
