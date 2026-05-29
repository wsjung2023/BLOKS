/**
 * Web search integration for grounding AI outputs in real-time data.
 *
 * Primary: Tavily API (TAVILY_API_KEY) — purpose-built for AI agents
 * Fallback: no-op (returns empty, AI uses training data only)
 *
 * Inject results via buildSearchContext() into system prompts.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

export interface SearchResponse {
  ok: boolean;
  results: SearchResult[];
  query: string;
  provider: string;
}

async function searchTavily(query: string, maxResults: number): Promise<SearchResult[]> {
  const apiKey = process.env["TAVILY_API_KEY"];
  if (!apiKey) return [];

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: false,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return [];

  const data = await res.json() as { results?: Array<{ title: string; url: string; content: string; score?: number }> };
  return (data.results ?? []).map(r => {
    const result: SearchResult = { title: r.title, url: r.url, snippet: r.content.slice(0, 500) };
    if (r.score !== undefined) result.score = r.score;
    return result;
  });
}

export async function searchWeb(query: string, maxResults = 5): Promise<SearchResponse> {
  try {
    const results = await searchTavily(query, maxResults);
    return { ok: true, results, query, provider: results.length > 0 ? "tavily" : "none" };
  } catch {
    return { ok: false, results: [], query, provider: "none" };
  }
}

/**
 * Builds a formatted context block from search results suitable for injection
 * into an AI system prompt.
 */
export function buildSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return "";

  const lines = results.map((r, i) =>
    `[${i + 1}] ${r.title}\n출처: ${r.url}\n${r.snippet}`
  );
  return `\n\n[실시간 웹 서치 결과 — 아래 정보를 근거로 활용하세요]\n${lines.join("\n\n")}`;
}

/**
 * Generate a focused search query from a task title and type.
 * Keeps queries concise so Tavily returns relevant results.
 */
export function deriveSearchQuery(taskTitle: string, taskType: string): string {
  const typeHints: Record<string, string> = {
    market_research: "시장 분석 트렌드",
    research_summary: "최신 동향 데이터",
    data_analysis: "통계 수치",
    strategy_memo: "전략 사례",
    marketing_copy: "마케팅 사례",
    planningDocument: "",
    code_development: "",
    web_development: "",
  };
  const hint = typeHints[taskType] ?? "";
  return hint ? `${taskTitle} ${hint}` : taskTitle;
}
