// Builds RAG memory context string for injection into AI prompts
import { searchMemories, searchMemoriesByScope, type MemorySearchResult } from "./store.js";

export interface MemoryContextOptions {
  characterId: string;
  query: string;
  companyId?: string;
  topK?: number;
  threshold?: number;
  maxTokens?: number;
}

export interface MemoryContext {
  contextBlock: string;
  memoryCount: number;
  tokenEstimate: number;
}

const MEMORY_TYPE_LABELS: Record<string, string> = {
  preference: "선호/스타일",
  lesson: "배운 교훈",
  warning: "주의 사항",
  relationship: "관계 정보",
  strategy: "전략/방향",
};

export async function buildMemoryContext(opts: MemoryContextOptions): Promise<MemoryContext> {
  const { characterId, query, companyId, topK = 5, threshold = 0.6, maxTokens = 800 } = opts;

  // Search character-specific memories + company-scope memories in parallel
  const searches: Promise<MemorySearchResult[]>[] = [
    searchMemories({ characterId, query, topK, threshold }),
  ];

  if (companyId) {
    searches.push(
      searchMemoriesByScope({ scope: "company", scopeId: companyId, query, topK: 3, threshold })
    );
  }

  const results = await Promise.all(searches);

  // Merge and deduplicate by memory_id, keep highest similarity
  const merged = new Map<string, MemorySearchResult>();
  for (const batch of results) {
    for (const mem of batch) {
      const existing = merged.get(mem.memory_id);
      if (!existing || mem.similarity > existing.similarity) {
        merged.set(mem.memory_id, mem);
      }
    }
  }

  if (merged.size === 0) {
    return { contextBlock: "", memoryCount: 0, tokenEstimate: 0 };
  }

  // Sort by importance * similarity descending
  const sorted = [...merged.values()].sort(
    (a, b) => b.importance_score * b.similarity - a.importance_score * a.similarity
  );

  // Build context block, respecting token budget
  const lines: string[] = ["--- 캐릭터 메모리 (관련도 순) ---"];
  let totalTokens = 8;

  for (const mem of sorted) {
    const label = MEMORY_TYPE_LABELS[mem.memory_type] ?? mem.memory_type;
    const line = `[${label}] ${mem.summary}`;
    const lineTokens = Math.ceil(line.length / 4);
    if (totalTokens + lineTokens > maxTokens) break;
    lines.push(line);
    totalTokens += lineTokens;
  }

  lines.push("---");

  const contextBlock = lines.join("\n");
  return {
    contextBlock,
    memoryCount: lines.length - 2, // exclude header/footer
    tokenEstimate: totalTokens,
  };
}

// ── Post-task memory extraction ───────────────────────────────────────────────
// Derive a short memory summary from task + AI output, to store for future use

export function deriveMemorySummary(opts: {
  taskTitle: string;
  taskType: string;
  aiOutputSnippet: string;
  characterName: string;
}): string {
  const { taskTitle, taskType, aiOutputSnippet, characterName } = opts;
  const snippet = aiOutputSnippet.slice(0, 300);
  return `${characterName}이(가) "${taskTitle}"(${taskType}) 태스크를 완료했습니다. 요약: ${snippet}`;
}
