#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const seedFiles = [
  'packages/db/src/seed-data/characters-a.ts',
  'packages/db/src/seed-data/characters-b.ts',
  'packages/db/src/seed-data/characters-c.ts',
];

const spriteDirs = [
  'apps/web/public/sprites',
  'apps/web/public/sprites-v2',
  'client-assets/sprites',
];

const planPath = 'sprite-plan.json';

function normalizeCodeName(codeName) {
  return codeName.toLowerCase().replace(/_/g, '-');
}

function readCodeNames() {
  const names = new Set();
  const pattern = /code_name:\s*'([^']+)'/g;

  for (const file of seedFiles) {
    const full = join(ROOT, file);
    const content = readFileSync(full, 'utf8');
    let match;
    while ((match = pattern.exec(content)) !== null) {
      names.add(normalizeCodeName(match[1]));
    }
  }
  return [...names].sort();
}

function readSprites(dir) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((name) => name.startsWith('char-') && name.endsWith('.png'))
    .map((name) => name.replace(/^char-/, '').replace(/\.png$/, ''))
    .sort();
}

function readAllFiles(dir) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full).sort();
}

function readPlan() {
  const full = join(ROOT, planPath);
  if (!existsSync(full)) {
    return { total_required: null };
  }

  try {
    return JSON.parse(readFileSync(full, 'utf8'));
  } catch {
    return { total_required: null };
  }
}

function resolveCoveredCodeNames(sprites, codeNames) {
  const sortedCodes = [...codeNames].sort((a, b) => b.length - a.length);
  const covered = new Set();
  const unmatched = [];

  for (const sprite of sprites) {
    const exact = sortedCodes.find((code) => sprite === code);
    if (exact) {
      covered.add(exact);
      continue;
    }
    const prefixed = sortedCodes.find((code) => sprite.startsWith(`${code}-`));
    if (prefixed) {
      covered.add(prefixed);
      continue;
    }
    unmatched.push(sprite);
  }

  return { covered, unmatched };
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

const codeNames = readCodeNames();
const plan = readPlan();

const spriteByDir = new Map(
  spriteDirs.map((dir) => [dir, readSprites(dir)])
);

printSection('Character code_name coverage');
console.log(`- unique code_name (seed): ${codeNames.length}`);

for (const [dir, sprites] of spriteByDir.entries()) {
  const { covered, unmatched } = resolveCoveredCodeNames(sprites, codeNames);
  const missing = codeNames.filter((name) => !covered.has(name));
  const extras = unmatched;

  console.log(`\n[${dir}]`);
  console.log(`- char sprite files: ${sprites.length}`);
  console.log(`- covered code_name: ${covered.size}/${codeNames.length}`);
  console.log(`- missing for code_name: ${missing.length}`);
  if (missing.length) console.log(`  -> ${missing.join(', ')}`);
  console.log(`- extras (not in code_name): ${extras.length}`);
  if (extras.length) console.log(`  -> ${extras.join(', ')}`);
}

if (typeof plan.total_required === 'number' && plan.total_required > 0) {
  const primaryDir = plan.primary_sprite_dir || 'apps/web/public/sprites-v2';
  const mode = plan.progress_mode === 'all_files' ? 'all_files' : 'char_only';
  const produced = mode === 'all_files'
    ? readAllFiles(primaryDir).length
    : (spriteByDir.get(primaryDir) || []).length;
  const progress = Math.min(100, (produced / plan.total_required) * 100);

  printSection('Plan progress');
  console.log(`- target total sprites: ${plan.total_required}`);
  console.log(`- mode: ${mode}`);
  console.log(`- produced (${primaryDir}): ${produced}`);
  console.log(`- progress: ${progress.toFixed(2)}%`);
}
