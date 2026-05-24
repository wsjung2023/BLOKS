#!/usr/bin/env node
/**
 * Demo report generator
 * Usage: node tools/demo/generate-report.mjs --scenario=homepage|ppt|program
 *
 * Reads: tools/demo/reports/{scenario}-result.json
 *        tools/demo/reports/screenshots/*.png
 * Writes: tools/demo/reports/{scenario}-report.md
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, "reports");
const SCREENSHOTS_DIR = path.join(REPORTS_DIR, "screenshots");

function parseArgs() {
  const scenarioArg = process.argv.find((a) => a.startsWith("--scenario="));
  if (!scenarioArg) {
    console.error("Usage: node generate-report.mjs --scenario=homepage|ppt|program");
    process.exit(1);
  }
  return scenarioArg.replace("--scenario=", "");
}

function screenshotRef(filename) {
  const full = path.join(SCREENSHOTS_DIR, filename);
  if (!existsSync(full)) return null;
  return `screenshots/${filename}`;
}

function formatDuration(startedAt, completedAt) {
  const ms = new Date(completedAt) - new Date(startedAt);
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

function formatCost(costUsd) {
  if (!costUsd || costUsd === 0) return "-";
  return `$${Number(costUsd).toFixed(4)}`;
}

function formatTokens(tokens) {
  if (!tokens) return "-";
  return Number(tokens).toLocaleString();
}

function stateLabel(state) {
  const labels = { Done: "완료", Approved: "승인 완료", InProgress: "진행 중", InReview: "검토 중", Blocked: "블로킹", Created: "생성", Assigned: "배정" };
  return labels[state] ?? state;
}

function parseAiOutput(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

function generateReport(scenario, result) {
  // Normalize aiOutput — DB stores it as JSON string in TEXT column
  result.tasks = result.tasks.map((t) => ({ ...t, aiOutput: parseAiOutput(t.aiOutput) }));

  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const duration = result.completedAt ? formatDuration(result.startedAt, result.completedAt) : "-";

  const totalTokens = result.tasks.reduce((s, t) => s + (t.aiOutput?.tokens_used ?? t.aiOutput?.tokensUsed ?? 0), 0);
  const totalCost = result.tasks.reduce((s, t) => s + (t.aiOutput?.cost_usd ?? t.aiOutput?.costUsd ?? 0), 0);
  const doneCount = result.tasks.filter((t) => ["Done", "Approved", "InReview"].includes(t.state)).length;

  const lines = [];

  lines.push(`# 시나리오 실행 리포트: ${result.projectTitle}`);
  lines.push(`\n> 생성일시: ${now}`);
  lines.push(`> 시나리오: \`${scenario}\``);
  lines.push(`> 프로젝트 ID: \`${result.projectId}\``);
  lines.push(`> 소요 시간: ${duration}`);
  lines.push(`> 완료율: ${doneCount}/${result.tasks.length} (${Math.round((doneCount / result.tasks.length) * 100)}%)`);

  // Characters table
  lines.push("\n## 참여 캐릭터\n");
  lines.push("| 캐릭터 | 코드명 | ID |");
  lines.push("|--------|--------|----|");
  for (const c of result.characters ?? []) {
    lines.push(`| ${c.name} | \`${c.codeName}\` | \`${c.id.slice(0, 8)}...\` |`);
  }

  // Screenshots
  lines.push("\n## 진행 스크린샷\n");
  const shots = [
    { file: "board-initial.png", label: "초기 보드 (태스크 생성 직후)" },
    { file: "world-working.png", label: "월드 캔버스 (AI 실행 중)" },
    { file: "board-in-progress.png", label: "보드 진행 중" },
    { file: "board-done.png", label: "완료 보드" },
    { file: "analytics.png", label: "Analytics 대시보드" },
  ];
  let hasSshots = false;
  for (const { file, label } of shots) {
    const ref = screenshotRef(file);
    if (ref) {
      lines.push(`### ${label}`);
      lines.push(`\n![${label}](${ref})\n`);
      hasSshots = true;
    }
  }
  if (!hasSshots) {
    lines.push("_스크린샷 없음. `pnpm demo:capture` 실행 후 리포트를 재생성하세요._\n");
  }

  // Tasks and outputs
  lines.push("\n## 태스크별 산출물\n");
  for (let i = 0; i < result.tasks.length; i++) {
    const t = result.tasks[i];
    const tokens = t.aiOutput?.tokens_used ?? t.aiOutput?.tokensUsed ?? null;
    const cost = t.aiOutput?.cost_usd ?? t.aiOutput?.costUsd ?? null;
    const model = t.aiOutput?.model_used ?? t.aiOutput?.modelUsed ?? "";
    const outputText = t.aiOutput?.text ?? t.aiOutput?.output_text ?? t.aiOutput?.outputText ?? "";

    lines.push(`### Task ${i + 1}: ${t.title}`);
    lines.push(`\n**상태:** ${stateLabel(t.state)} | **토큰:** ${formatTokens(tokens)} | **비용:** ${formatCost(cost)}${model ? ` | **모델:** ${model}` : ""}\n`);

    if (outputText) {
      lines.push("---\n");
      lines.push(outputText.trim());
      lines.push("\n---\n");
    } else if (t.artifacts && t.artifacts.length > 0) {
      for (const art of t.artifacts) {
        lines.push(`**[산출물] ${art.title ?? art.artifact_type}**\n`);
        if (art.content_markdown) {
          lines.push(art.content_markdown.trim());
        } else if (art.content) {
          lines.push(art.content.trim());
        }
        lines.push("\n---\n");
      }
    } else {
      lines.push("_AI 출력 없음_\n");
    }
  }

  // Summary stats
  lines.push("\n## 요약 통계\n");
  lines.push("| 항목 | 값 |");
  lines.push("|------|-----|");
  lines.push(`| 소요 시간 | ${duration} |`);
  lines.push(`| 완료 태스크 | ${doneCount} / ${result.tasks.length} |`);
  lines.push(`| 총 토큰 | ${formatTokens(totalTokens)} |`);
  lines.push(`| 총 AI 비용 | ${formatCost(totalCost)} |`);
  lines.push(`| 참여 캐릭터 | ${result.characters?.length ?? 0}명 |`);

  return lines.join("\n");
}

function main() {
  const scenario = parseArgs();
  const resultFile = path.join(REPORTS_DIR, `${scenario}-result.json`);

  if (!existsSync(resultFile)) {
    console.error(`Result file not found: ${resultFile}`);
    console.error(`Run: pnpm demo:${scenario} first`);
    process.exit(1);
  }

  const result = JSON.parse(readFileSync(resultFile, "utf8"));
  const report = generateReport(scenario, result);

  const outFile = path.join(REPORTS_DIR, `${scenario}-report.md`);
  writeFileSync(outFile, report);
  console.log(`✓ Report generated: ${outFile}`);
}

main();
