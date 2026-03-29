#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const API_BASE = process.env.BLOKS_API_BASE_URL || 'http://localhost:4000';

const fileChecks = [
  {
    id: 'progress-tool',
    label: '파일 존재 체크 + 동작 검증 체크 분리 스크립트 존재',
    pass: () => existsSync(join(ROOT, 'tools/p1-progress-check.mjs')),
  },
  {
    id: 'tasks-route',
    label: 'tasks 라우트 파일 존재',
    pass: () => existsSync(join(ROOT, 'apps/api/src/routes/tasks.ts')),
  },
  {
    id: 'approvals-route',
    label: 'approvals 라우트 파일 존재',
    pass: () => existsSync(join(ROOT, 'apps/api/src/routes/approvals.ts')),
  },
  {
    id: 'health-entry',
    label: 'health 엔트리 파일 존재',
    pass: () => existsSync(join(ROOT, 'apps/api/src/index.ts')),
  },
];

async function fetchJson(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-dev-bypass-auth': '1',
      Authorization: 'Bearer dev-local-smoke',
    },
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    ok: res.ok,
    status: res.status,
    body,
  };
}

const behaviorChecks = [
  {
    id: 'health',
    label: 'GET /health',
    run: async () => {
      const r = await fetchJson(`${API_BASE}/health`);
      return r.ok;
    },
  },
  {
    id: 'tasks',
    label: 'GET /api/v1/tasks?pageSize=1',
    run: async () => {
      const r = await fetchJson(`${API_BASE}/api/v1/tasks?pageSize=1`);
      if (!r.ok || !r.body || typeof r.body !== 'object') return false;
      return 'ok' in r.body && 'data' in r.body;
    },
  },
  {
    id: 'approvals',
    label: 'GET /api/v1/approvals?pageSize=1',
    run: async () => {
      const r = await fetchJson(`${API_BASE}/api/v1/approvals?pageSize=1`);
      if (!r.ok || !r.body || typeof r.body !== 'object') return false;
      return 'ok' in r.body && 'data' in r.body;
    },
  },
];

function printSection(title) {
  console.log(`\n## ${title}`);
}

function printItem(ok, label) {
  console.log(`- [${ok ? 'x' : ' '}] ${label}`);
}

console.log('# BLOKS P1-2 Progress Check');
console.log(`- API base: ${API_BASE}`);

printSection('A. 파일 존재 체크');
let filePassed = 0;
for (const check of fileChecks) {
  const ok = check.pass();
  if (ok) filePassed += 1;
  printItem(ok, check.label);
}

printSection('B. 동작 검증 체크 (Smoke)');
let behaviorPassed = 0;
let behaviorExecuted = 0;
for (const check of behaviorChecks) {
  try {
    const ok = await check.run();
    behaviorExecuted += 1;
    if (ok) behaviorPassed += 1;
    printItem(ok, check.label);
  } catch (error) {
    printItem(false, `${check.label} (실행 실패: ${error.message})`);
  }
}

printSection('요약');
console.log(`- 파일 존재 체크: ${filePassed}/${fileChecks.length}`);
console.log(`- 동작 검증 체크: ${behaviorPassed}/${behaviorChecks.length} (실행 ${behaviorExecuted}건)`);

const success = filePassed === fileChecks.length && behaviorPassed === behaviorChecks.length;
if (!success) {
  process.exitCode = 1;
}
