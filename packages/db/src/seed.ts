// BLOKS 시드 러너 — 초기 데이터 삽입 (멱등, 중복 실행 안전)
import { getDb } from './local-stub.js';
import { COMPANY, DIVISIONS, DEPARTMENTS } from './seed-data/orgs.js';
import { RANKS_DATA } from './seed-data/ranks.js';
import { MODEL_PROFILES_DATA } from './seed-data/models.js';
import { ROLES_DATA } from './seed-data/roles.js';
import { CHARACTERS_A } from './seed-data/characters-a.js';
import { CHARACTERS_B } from './seed-data/characters-b.js';
import { CHARACTERS_C } from './seed-data/characters-c.js';

const db = getDb();

async function upsert(table: string, data: Record<string, unknown>[], _conflictCol = 'id') {
  const { error } = await db.from(table).upsert(data);
  if (error) throw new Error(`[seed] ${table} error: ${(error as { message?: string }).message}`);
}

async function main() {
  console.log('[seed] 시작');

  console.log('[seed] company...');
  await upsert('companies', [COMPANY]);

  console.log('[seed] divisions...');
  await upsert('divisions', DIVISIONS);

  console.log('[seed] departments...');
  await upsert('departments', DEPARTMENTS);

  console.log('[seed] ranks...');
  await upsert('ranks', RANKS_DATA, 'level');

  console.log('[seed] model_profiles...');
  await upsert('model_profiles', MODEL_PROFILES_DATA);

  console.log('[seed] roles...');
  await upsert('roles', ROLES_DATA);

  const allChars = [...CHARACTERS_A, ...CHARACTERS_B, ...CHARACTERS_C];
  console.log(`[seed] characters (${allChars.length}명)...`);
  await upsert('characters', allChars);

  const runtimeStates = allChars.map((c) => ({
    character_id: c.id,
    activity_status: 'Idle',
    workload_score: Math.random() * 40,
    fatigue_score: Math.random() * 30,
    focus_score: 60 + Math.random() * 40,
    stress_score: Math.random() * 25,
    burnout_triggered: false,
    reliability_live: 85 + Math.random() * 15,
  }));
  console.log('[seed] character_runtime_states...');
  await upsert('character_runtime_states', runtimeStates, 'character_id');

  console.log('[seed] 완료!');
  console.log(`  - 회사: 1`);
  console.log(`  - 부문: ${DIVISIONS.length}`);
  console.log(`  - 부서: ${DEPARTMENTS.length}`);
  console.log(`  - 직급: ${RANKS_DATA.length}`);
  console.log(`  - 모델 프로필: ${MODEL_PROFILES_DATA.length}`);
  console.log(`  - 역할: ${ROLES_DATA.length}`);
  console.log(`  - 캐릭터: ${allChars.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });



