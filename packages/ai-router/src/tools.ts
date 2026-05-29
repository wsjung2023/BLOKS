/**
 * BLOKS MCP Tool Registry
 *
 * 각 툴은 AI가 직접 호출 가능한 함수입니다.
 * task type에 따라 적절한 툴 세트가 AI에게 제공됩니다.
 */

import { searchWeb } from "./search.js";
import { generateImage } from "./image.js";
import { generateVideo } from "./video.js";

// ── Tool interface ────────────────────────────────────────────────────────────

export interface BloksTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
  execute(input: Record<string, unknown>): Promise<string>;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const webSearchTool: BloksTool = {
  name: "web_search",
  description: "인터넷에서 최신 정보를 검색합니다. 시장 조사, 경쟁사 분석, 트렌드, 통계, 최신 뉴스를 찾을 때 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "검색할 내용. 구체적이고 명확하게 작성하세요." },
      num_results: { type: "string", description: "반환할 결과 수 (기본 5)", enum: ["3", "5", "8"] },
    },
    required: ["query"],
  },
  async execute(input) {
    const query = String(input["query"] ?? "");
    const num = parseInt(String(input["num_results"] ?? "5"), 10);
    const result = await searchWeb(query, num);
    if (result.results.length === 0) return `"${query}" 검색 결과 없음. (Tavily API 키가 설정되지 않았거나 결과가 없습니다.)`;
    return result.results
      .map((r, i) => `[${i + 1}] ${r.title}\n출처: ${r.url}\n${r.snippet}`)
      .join("\n\n");
  },
};

const fetchUrlTool: BloksTool = {
  name: "fetch_url",
  description: "특정 웹페이지의 내용을 가져옵니다. 경쟁사 웹사이트, 뉴스 기사, 참고 자료를 읽을 때 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "가져올 웹페이지 URL" },
    },
    required: ["url"],
  },
  async execute(input) {
    const url = String(input["url"] ?? "");
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; BLOKS-AI/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      // HTML 태그 제거, 최대 3000자
      const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);
      return `[${url}]\n${clean}`;
    } catch {
      return `URL 접근 실패: ${url}`;
    }
  },
};

const getDatetimeTool: BloksTool = {
  name: "get_current_datetime",
  description: "현재 날짜와 시간을 반환합니다. 보고서 날짜, 일정 계산, 유효 기간 설정에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      format: { type: "string", description: "출력 형식", enum: ["full", "date", "year_month"] },
    },
    required: [],
  },
  async execute(input) {
    const now = new Date();
    const fmt = String(input["format"] ?? "full");
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    if (fmt === "date") return kst.toISOString().slice(0, 10);
    if (fmt === "year_month") return kst.toISOString().slice(0, 7);
    return `${kst.toISOString().slice(0, 10)} (${["일","월","화","수","목","금","토"][kst.getDay()]}요일)`;
  },
};

const generateImageTool: BloksTool = {
  name: "generate_image",
  description: "AI로 이미지를 생성합니다. 광고 배너, 포스터, 쿠폰, 제품 이미지를 만들 때 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "생성할 이미지를 영어로 상세히 설명하세요." },
      style: { type: "string", description: "스타일", enum: ["photorealistic", "illustration", "minimalist", "vintage"] },
    },
    required: ["prompt"],
  },
  async execute(input) {
    const prompt = String(input["prompt"] ?? "");
    const style = String(input["style"] ?? "");
    const fullPrompt = style ? `${prompt}, ${style} style` : prompt;
    const result = await generateImage({ prompt: fullPrompt });
    if (!result.ok) return `이미지 생성 실패: ${result.errorCode}`;
    const src = result.imageUrl ?? `data:${result.mimeType};base64,${result.imageBase64}`;
    return `![generated](${src})\n> ${result.provider} / ${result.modelUsed}`;
  },
};

const generateVideoTool: BloksTool = {
  name: "generate_video",
  description: "AI로 광고 영상을 생성합니다. 릴스, 쇼츠, 유튜브 광고 영상에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "영상 내용을 영어로 상세히 설명하세요." },
      aspect_ratio: { type: "string", description: "화면 비율", enum: ["16:9", "9:16", "1:1"] },
      duration: { type: "string", description: "영상 길이(초)", enum: ["5", "10"] },
    },
    required: ["prompt"],
  },
  async execute(input) {
    const prompt = String(input["prompt"] ?? "");
    const ratio = String(input["aspect_ratio"] ?? "16:9") as "16:9" | "9:16" | "1:1";
    const dur = String(input["duration"] ?? "5") as "5" | "10";
    const result = await generateVideo({ prompt, aspectRatio: ratio, duration: dur, model: "kling-2.6" });
    if (!result.ok || !result.videoUrl) return `영상 생성 실패: ${result.errorCode}`;
    return `[VIDEO](${result.videoUrl})\n> ${result.provider} / ${result.modelUsed}`;
  },
};

// ── Tool registry ─────────────────────────────────────────────────────────────

export const TOOL_REGISTRY: Record<string, BloksTool> = {
  web_search:            webSearchTool,
  fetch_url:             fetchUrlTool,
  get_current_datetime:  getDatetimeTool,
  generate_image:        generateImageTool,
  generate_video:        generateVideoTool,
};

// ── Task type → tool set mapping ─────────────────────────────────────────────

const TASK_TOOL_MAP: Record<string, string[]> = {
  // 리서치 & 분석
  market_research:   ["web_search", "fetch_url", "get_current_datetime"],
  research_summary:  ["web_search", "fetch_url", "get_current_datetime"],
  data_analysis:     ["web_search", "get_current_datetime"],
  // 전략 & 기획
  strategy_memo:     ["web_search", "get_current_datetime"],
  project_plan:      ["web_search", "get_current_datetime"],
  proposal_draft:    ["web_search", "get_current_datetime"],
  planningDocument:  ["web_search", "get_current_datetime"],
  prd_draft:         ["web_search", "get_current_datetime"],
  // 광고 대행
  ad_banner:         ["generate_image", "web_search"],
  ad_copy:           ["web_search", "get_current_datetime"],
  ad_strategy:       ["web_search", "get_current_datetime"],
  ad_video:          ["generate_video"],
  coupon_design:     ["generate_image", "get_current_datetime"],
  promo_page:        ["web_search", "get_current_datetime"],
  // 마케팅 콘텐츠
  marketing_copy:    ["web_search"],
  online_content:    ["web_search", "get_current_datetime"],
  // 미디어 제작
  image_production:  ["generate_image"],
  video_production:  ["generate_video"],
  media_pipeline:    ["generate_image", "generate_video"],
  // 개발
  code_development:  ["fetch_url", "get_current_datetime"],
  web_development:   ["fetch_url", "get_current_datetime"],
  // 문서
  document:          ["get_current_datetime"],
  memo:              ["get_current_datetime"],
  // 기타
  default:           ["web_search", "get_current_datetime"],
};

export function getToolsForTask(taskType: string): BloksTool[] {
  const toolNames = TASK_TOOL_MAP[taskType] ?? TASK_TOOL_MAP["default"]!;
  return toolNames.map(n => TOOL_REGISTRY[n]).filter(Boolean) as BloksTool[];
}

// OpenAI function definition 형식으로 변환
export function toOpenAITool(tool: BloksTool) {
  return {
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  };
}

// Anthropic tool definition 형식으로 변환
export function toAnthropicTool(tool: BloksTool) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}
