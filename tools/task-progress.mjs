#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'docs/EXECUTION_PLAN.md';
const OUTPUT = 'docs/TASK_PROGRESS.md';

const md = readFileSync(SOURCE, 'utf8');
const lines = md.split(/\r?\n/);

const sections = [];
let current = null;
for (const line of lines) {
  const m = line.match(/^###\s+(.*)$/);
  if (m) {
    current = { title: m[1], done: 0, total: 0 };
    sections.push(current);
    continue;
  }

  const c = line.match(/^- \[([ x])\]\s+/);
  if (c && current) {
    current.total += 1;
    if (c[1] === 'x') current.done += 1;
  }
}

const totals = sections.reduce(
  (acc, s) => {
    acc.done += s.done;
    acc.total += s.total;
    return acc;
  },
  { done: 0, total: 0 },
);

const pct = totals.total ? ((totals.done / totals.total) * 100).toFixed(2) : '0.00';

const out = [
  '# TASK Progress (from EXECUTION_PLAN)',
  '',
  `- source: \`${SOURCE}\``,
  `- overall: **${totals.done}/${totals.total} (${pct}%)**`,
  '',
  '## Breakdown',
  ...sections.map((s) => {
    const sectionPct = s.total ? ((s.done / s.total) * 100).toFixed(2) : '0.00';
    return `- ${s.title}: ${s.done}/${s.total} (${sectionPct}%)`;
  }),
  '',
  '## Notes',
  '- 체크박스(`- [ ]`, `- [x]`)만 집계합니다.',
  '- `###` 헤더 단위로 섹션 집계를 수행합니다.',
  '',
].join('\n');

writeFileSync(OUTPUT, out, 'utf8');
console.log(out);
