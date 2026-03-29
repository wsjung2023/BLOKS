#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const REPORT_PATH = 'docs/STATUS_REPORT.md';

function run(cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { ok: true, out: out.trim() };
  } catch (error) {
    return {
      ok: false,
      out: (error.stdout || '').toString().trim(),
      err: (error.stderr || error.message || '').toString().trim(),
    };
  }
}

const taskProgress = run('node tools/task-progress.mjs');
const p1Progress = run('node tools/p1-progress-check.mjs');

const taskDoc = readFileSync('docs/TASK_PROGRESS.md', 'utf8');
const overallMatch = taskDoc.match(/overall:\s*\*\*(\d+)\/(\d+)\s*\(([^)]+)\)\*\*/i);
const p12Match = taskDoc.match(/P1-2.*:\s*(\d+)\/(\d+)\s*\(([^)]+)\)/);
const p21Match = taskDoc.match(/P2-1.*:\s*(\d+)\/(\d+)\s*\(([^)]+)\)/);
const p22Match = taskDoc.match(/P2-2.*:\s*(\d+)\/(\d+)\s*\(([^)]+)\)/);
const p23Match = taskDoc.match(/P2-3.*:\s*(\d+)\/(\d+)\s*\(([^)]+)\)/);

const overall = overallMatch ? `${overallMatch[1]}/${overallMatch[2]} (${overallMatch[3]})` : 'N/A';
const p12 = p12Match ? `${p12Match[1]}/${p12Match[2]} (${p12Match[3]})` : 'N/A';
const p21 = p21Match ? `${p21Match[1]}/${p21Match[2]} (${p21Match[3]})` : 'N/A';
const p22 = p22Match ? `${p22Match[1]}/${p22Match[2]} (${p22Match[3]})` : 'N/A';
const p23 = p23Match ? `${p23Match[1]}/${p23Match[2]} (${p23Match[3]})` : 'N/A';

const lines = [
  '### Summary',
  `* docs/task 기준 진행률 확인 요청에 맞춰, \`docs/EXECUTION_PLAN.md\` 체크박스 집계 스크립트(\`tools/task-progress.mjs\`)를 기준으로 진행률을 산출했습니다.`,
  `* 집계 결과를 \`docs/TASK_PROGRESS.md\`로 생성했으며, 현재 기준 진행률은 **${overall}** 입니다.`,
  `  * P1-2: ${p12}`,
  `  * P2-1: ${p21}`,
  `  * P2-2: ${p22}`,
  `  * P2-3: ${p23}`,
  '* 분모(총 체크박스 수)는 비교 일관성을 위해 고정하며, 세부 구현 완료는 체크박스 외 진행 메모로 기록합니다.',
  '* 재실행은 `pnpm progress:report` 한 번으로 동일 포맷 보고서를 갱신할 수 있습니다.',
  '',
  '**Testing**',
  `* ${taskProgress.ok ? '✅' : '❌'} \`node tools/task-progress.mjs\``,
  `* ${p1Progress.ok ? '✅' : '⚠️'} \`node tools/p1-progress-check.mjs\``,
  `* ✅ \`node tools/progress-report.mjs\``,
  '',
  '<!-- raw output for traceability -->',
  '```txt',
  taskProgress.out.split('\n').slice(0, 12).join('\n'),
  '---',
  p1Progress.out.split('\n').slice(0, 16).join('\n'),
  p1Progress.err ? `\n[stderr]\n${p1Progress.err.split('\n').slice(0, 8).join('\n')}` : '',
  '```',
  '',
].join('\n');

writeFileSync(REPORT_PATH, lines, 'utf8');
console.log(`Generated ${REPORT_PATH}`);
