#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function hasFile(path) {
  return existsSync(join(ROOT, path));
}

function fileContains(path, pattern) {
  const full = join(ROOT, path);
  if (!existsSync(full)) return false;
  const text = readFileSync(full, 'utf8');
  return pattern.test(text);
}

const checks = [
  { id: 'index-doc', label: '마스터 인덱스 문서 존재', md: '00_BLOKS_index_v0.1.md', pass: () => hasFile('00_BLOKS_index_v0.1.md') },
  { id: 'foundation-doc', label: 'Foundation 정본 문서 존재', md: '01_BLOKS_foundation_v0.1.md', pass: () => hasFile('01_BLOKS_foundation_v0.1.md') },

  { id: 'mono-repo', label: '모노레포 루트 설정', md: '08_BLOKS_repo_scaffold_and_bootstrap_v0.1.md', pass: () => hasFile('turbo.json') && hasFile('pnpm-lock.yaml') },
  { id: 'web-app', label: 'Web 앱 기본 구조', md: '07_BLOKS_build_stack_and_repo_structure_v0.1.md', pass: () => hasFile('apps/web/package.json') && hasFile('apps/web/src/app/layout.tsx') },
  { id: 'api-app', label: 'API 앱 기본 구조', md: '07_BLOKS_build_stack_and_repo_structure_v0.1.md', pass: () => hasFile('apps/api/package.json') && hasFile('apps/api/src/index.ts') },
  { id: 'worker-app', label: 'Worker 앱/패키지 분리', md: '07_BLOKS_build_stack_and_repo_structure_v0.1.md', pass: () => hasFile('apps/worker/package.json') || hasFile('packages/worker/package.json') },
  { id: 'db-package', label: 'DB 패키지 + Prisma 스키마', md: '04_BLOKS_data_model_ERD_v0.1.md', pass: () => hasFile('packages/db/package.json') && hasFile('packages/db/prisma/schema/base.prisma') },
  { id: 'shared-package', label: '공통 enum/shared 패키지', md: '07_BLOKS_build_stack_and_repo_structure_v0.1.md', pass: () => hasFile('packages/shared/src/index.ts') && hasFile('packages/shared/src/enums/project-state.ts') },
  { id: 'ai-router-package', label: 'AI Router 패키지', md: '09_BLOKS_API_contracts_and_job_specs_v0.1.md', pass: () => hasFile('packages/ai-router/src/index.ts') && hasFile('packages/ai-router/src/providers/openai.ts') },
  { id: 'world-package', label: 'packages/world 렌더링 계층', md: '11_BLOKS_canonical_alignment_and_P0_fixes_v0.1.md', pass: () => hasFile('packages/world/package.json') },
  { id: 'simulation-package', label: 'packages/simulation 상태 연산기', md: '11_BLOKS_canonical_alignment_and_P0_fixes_v0.1.md', pass: () => hasFile('packages/simulation/package.json') },
  { id: 'queue-infra', label: 'Redis/BullMQ 큐 인프라 코드', md: '07_BLOKS_build_stack_and_repo_structure_v0.1.md', pass: () => hasFile('apps/api/src/queues') || hasFile('apps/worker/src/queues') || hasFile('packages/queue') },

  { id: 'world-page', label: '월드 화면 엔트리', md: '05_BLOKS_UI_screen_spec_v0.1.md', pass: () => hasFile('apps/web/src/app/world/page.tsx') },
  { id: 'world-canvas', label: '아이소메트릭 캔버스 구현', md: '10_BLOKS_world_runtime_and_isometric_rules_v0.1.md', pass: () => hasFile('apps/web/src/components/world/IsometricWorldCanvas.tsx') },
  { id: 'world-sprite-mapper', label: 'code_name → sprite 매핑', md: '10_BLOKS_world_runtime_and_isometric_rules_v0.1.md', pass: () => fileContains('apps/web/src/components/world/world-sprites.ts', /codeNameToSpriteUrl/) },
  { id: 'board-page', label: '보드 화면 라우트', md: '05_BLOKS_UI_screen_spec_v0.1.md', pass: () => hasFile('apps/web/src/app/board/page.tsx') },
  { id: 'approval-center-page', label: '승인 센터 화면 라우트', md: '05_BLOKS_UI_screen_spec_v0.1.md', pass: () => hasFile('apps/web/src/app/approvals/page.tsx') },
  { id: 'analytics-page', label: 'Analytics 화면 라우트', md: '06_BLOKS_MVP_WBS_v0.1.md', pass: () => hasFile('apps/web/src/app/analytics/page.tsx') },
  { id: 'character-directory-page', label: 'Character Directory 화면 라우트', md: '05_BLOKS_UI_screen_spec_v0.1.md', pass: () => hasFile('apps/web/src/app/characters/page.tsx') },

  { id: 'api-projects', label: 'Projects API 라우트', md: '09_BLOKS_API_contracts_and_job_specs_v0.1.md', pass: () => hasFile('apps/api/src/routes/projects.ts') },
  { id: 'api-tasks', label: 'Tasks API 라우트', md: '09_BLOKS_API_contracts_and_job_specs_v0.1.md', pass: () => hasFile('apps/api/src/routes/tasks.ts') },
  { id: 'api-approvals', label: 'Approvals API 라우트', md: '09_BLOKS_API_contracts_and_job_specs_v0.1.md', pass: () => hasFile('apps/api/src/routes/approvals.ts') },
  { id: 'api-characters', label: 'Characters API 라우트', md: '09_BLOKS_API_contracts_and_job_specs_v0.1.md', pass: () => hasFile('apps/api/src/routes/characters.ts') },
  { id: 'api-artifacts', label: 'Artifacts API 라우트', md: '09_BLOKS_API_contracts_and_job_specs_v0.1.md', pass: () => hasFile('apps/api/src/routes/artifacts.ts') },
  { id: 'api-events', label: 'Event log API 라우트', md: '09_BLOKS_API_contracts_and_job_specs_v0.1.md', pass: () => hasFile('apps/api/src/routes/events.ts') },
  { id: 'api-jobs', label: 'AI Job API 라우트', md: '09_BLOKS_API_contracts_and_job_specs_v0.1.md', pass: () => hasFile('apps/api/src/routes/jobs.ts') },
  { id: 'api-auth-mw', label: '인증 미들웨어', md: '04-01_BLOKS_permissions_and_approval_matrix_v0.1.md', pass: () => hasFile('apps/api/src/middleware/auth.ts') },

  { id: 'seed-roster', label: '캐릭터 seed 데이터', md: '02_BLOKS_character_roster_v0.2_mingled.md', pass: () => hasFile('packages/db/src/seed-data/characters-a.ts') && hasFile('packages/db/src/seed-data/characters-b.ts') && hasFile('packages/db/src/seed-data/characters-c.ts') },
  { id: 'seed-ranks-roles', label: 'rank/role/org seed', md: '11_BLOKS_canonical_alignment_and_P0_fixes_v0.1.md', pass: () => hasFile('packages/db/src/seed-data/ranks.ts') && hasFile('packages/db/src/seed-data/roles.ts') && hasFile('packages/db/src/seed-data/orgs.ts') },
  { id: 'seed-runner', label: 'seed 실행 엔트리(prisma/seed.ts)', md: '08_BLOKS_repo_scaffold_and_bootstrap_v0.1.md', pass: () => hasFile('packages/db/prisma/seed.ts') },

  { id: 'docker-env', label: 'docker/env 부트스트랩 파일', md: '08_BLOKS_repo_scaffold_and_bootstrap_v0.1.md', pass: () => hasFile('docker-compose.yml') && hasFile('.env.example') },
  { id: 'state-enums', label: '상태머신 enum 기초', md: '03_BLOKS_workflow_state_machine_v0.1.md', pass: () => hasFile('packages/shared/src/enums/task-state.ts') && hasFile('packages/shared/src/enums/approval-state.ts') },
  { id: 'priority-reason', label: 'reason/priority enum', md: '03_BLOKS_workflow_state_machine_v0.1.md', pass: () => hasFile('packages/shared/src/enums/reason-code.ts') && hasFile('packages/shared/src/enums/priority.ts') },
  { id: 'event-types', label: '이벤트 타입 enum/상수', md: '09_BLOKS_API_contracts_and_job_specs_v0.1.md', pass: () => hasFile('packages/shared/src/enums/event-type.ts') || hasFile('packages/shared/src/constants/event-types.ts') },
  { id: 'id-prefix-enforced', label: 'ID prefix(char_/proj_/task_) 생성 유틸', md: '11_BLOKS_canonical_alignment_and_P0_fixes_v0.1.md', pass: () => hasFile('packages/shared/src/id.ts') || hasFile('packages/shared/src/utils/id.ts') },

  { id: 'sprite-audit-tool', label: '스프라이트 감사 도구', md: '06_BLOKS_MVP_WBS_v0.1.md', pass: () => hasFile('tools/sprite-audit.mjs') },
  { id: 'sprite-v2-assets', label: 'sprites-v2 에셋 축적', md: '10_BLOKS_world_runtime_and_isometric_rules_v0.1.md', pass: () => hasFile('apps/web/public/sprites-v2') },
  { id: 'spec-progress-tool', label: '문서 기준 진행률 대시보드', md: '06_BLOKS_MVP_WBS_v0.1.md', pass: () => hasFile('tools/spec-progress.mjs') },
];

const byMd = new Map();
let done = 0;
for (const c of checks) {
  const ok = c.pass();
  if (ok) done += 1;
  const arr = byMd.get(c.md) || [];
  arr.push({ ...c, ok });
  byMd.set(c.md, arr);
}

const total = checks.length;
const overall = (done / total) * 100;

console.log('# BLOKS Implementation Progress');
console.log(`- overall: ${done}/${total} (${overall.toFixed(2)}%)`);

for (const [md, items] of [...byMd.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const localDone = items.filter((i) => i.ok).length;
  const localPct = (localDone / items.length) * 100;
  console.log(`\n## ${md}`);
  console.log(`- progress: ${localDone}/${items.length} (${localPct.toFixed(2)}%)`);
  for (const item of items) {
    console.log(`  - [${item.ok ? 'x' : ' '}] ${item.label}`);
  }
}

const pending = checks.filter((c) => !c.pass());
if (pending.length) {
  console.log('\n## Next recommended tasks');
  for (const item of pending.slice(0, 7)) {
    console.log(`- ${item.md}: ${item.label}`);
  }
}
