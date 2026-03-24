// @bloks/ai-router — routeAI function with character model lookup and provider routing
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { OpenAiProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";

// ── Core types ────────────────────────────────────────────────────────────────

export interface AiRequest {
  taskType?: string;
  systemPrompt?: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
  characterId?: string;
}

export interface AiExecutionResult<T = unknown> {
  ok: boolean;
  model: string;
  provider: string;
  costUsdEstimate: number;
  confidence: number;
  output: T | null;
  rawText?: string;
  errorCode?: string;
}

export interface AiProvider {
  readonly name: string;
  execute<T = unknown>(request: AiRequest): Promise<AiExecutionResult<T>>;
}

// ── routeAI public interface ──────────────────────────────────────────────────

export interface RouteAIOptions {
  characterId: string;
  taskType: string;
  prompt: string;
  context?: Record<string, unknown>;
  systemPrompt?: string;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export interface RouteAIResult {
  output: string;
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
}

// ── Supabase singleton (lazy) ─────────────────────────────────────────────────

let _sb: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_sb) return _sb;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("[ai-router] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

// ── Character model profile lookup ───────────────────────────────────────────

interface ModelProfile {
  model_id: string;
  provider_name: string;
  display_name?: string;
}

async function fetchCharacterModelProfile(characterId: string): Promise<ModelProfile | null> {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from("characters")
      .select("model_profiles!default_model_profile_id(model_id, provider_name, display_name)")
      .eq("id", characterId)
      .single();

    if (!data) return null;
    const profiles = (data as Record<string, unknown>)["model_profiles"];
    if (!profiles) return null;
    return Array.isArray(profiles) ? (profiles[0] as ModelProfile) : (profiles as ModelProfile);
  } catch {
    return null;
  }
}

// ── Task type → default model mapping (doc 11: OpenAI primary in MVP) ────────

const TASK_MODEL_MAP: Record<string, string> = {
  planningDocument:  "gpt-4o",
  prd_draft:         "gpt-4o",
  research_summary:  "gpt-4o",
  marketing_copy:    "gpt-4o-mini",
  approval_analysis: "gpt-4o-mini",
  character_action:  "gpt-4o-mini",
  default:           "gpt-4o-mini",
};

function selectModel(taskType: string, profile: ModelProfile | null): string {
  // Per doc 11 P0 fix #8: OpenAI primary; character profile sets model but not provider
  if (profile?.model_id) return profile.model_id;
  return TASK_MODEL_MAP[taskType] ?? TASK_MODEL_MAP["default"]!;
}

// ── Provider resolution (doc 11: OpenAI primary, Anthropic optional) ─────────

let _openai: OpenAiProvider | null = null;
let _anthropic: AnthropicProvider | null = null;

function getOpenAi(): OpenAiProvider {
  _openai ??= new OpenAiProvider();
  return _openai;
}

function getAnthropic(): AnthropicProvider | null {
  if (_anthropic) return _anthropic;
  if (!process.env["ANTHROPIC_API_KEY"]) return null;
  try {
    _anthropic = new AnthropicProvider();
    return _anthropic;
  } catch {
    return null;
  }
}

function resolveProvider(providerName: string | undefined): AiProvider {
  if (providerName === "anthropic") {
    return getAnthropic() ?? getOpenAi();
  }
  return getOpenAi();
}

// ── Budget guard ──────────────────────────────────────────────────────────────

const MAX_COST_USD = parseFloat(process.env["AI_MAX_COST_PER_TASK_USD"] ?? "0.5");

function estimatedInputCost(model: string, promptLength: number): number {
  const inputTokens = Math.ceil(promptLength / 4);
  const ratePerM = model.includes("mini") ? 0.15 : 2.50;
  return (inputTokens / 1_000_000) * ratePerM;
}

// ── routeAI — main export ─────────────────────────────────────────────────────

export async function routeAI(options: RouteAIOptions): Promise<RouteAIResult> {
  const { characterId, taskType, prompt, context, systemPrompt, maxTokens, responseFormat } = options;

  // Fetch character model profile from Supabase
  const profile = await fetchCharacterModelProfile(characterId);
  const model = selectModel(taskType, profile);
  const provider = resolveProvider(profile?.provider_name);

  // Build contextual system prompt
  const resolvedSystem = systemPrompt
    ?? (context ? `Context: ${JSON.stringify(context)}` : undefined);

  const fullPromptLength = (resolvedSystem ?? "").length + prompt.length;

  // Pre-flight budget check
  if (estimatedInputCost(model, fullPromptLength) > MAX_COST_USD) {
    throw new Error(`AI_BUDGET_EXCEEDED: estimated cost exceeds ${MAX_COST_USD} USD`);
  }

  const request: AiRequest = {
    userPrompt: prompt,
    systemPrompt: resolvedSystem,
    taskType,
    model,
    maxTokens,
    responseFormat: responseFormat ?? "text",
    characterId,
  };

  let result = await provider.execute<string>(request);

  // Fallback on provider error
  if (!result.ok && result.errorCode !== "BUDGET_EXCEEDED" && result.errorCode !== "RATE_LIMITED") {
    const fallbackModel = "gpt-4o-mini";
    if (fallbackModel !== model) {
      console.warn(`[ai-router] ${model} failed (${result.errorCode}), falling back to ${fallbackModel}`);
      result = await getOpenAi().execute<string>({ ...request, model: fallbackModel });
    }
  }

  if (!result.ok) {
    throw new Error(`AI_MODEL_FAILURE: ${result.errorCode ?? "unknown"}`);
  }

  const outputText = typeof result.output === "string"
    ? result.output
    : JSON.stringify(result.output);

  // Approximate token count from raw text length
  const tokensUsed = Math.ceil((outputText.length + fullPromptLength) / 4);

  return {
    output: outputText,
    modelUsed: result.model,
    tokensUsed,
    costUsd: result.costUsdEstimate,
  };
}

// ── Legacy class API (backwards compat) ──────────────────────────────────────

export interface CharacterModelConfig {
  characterId: string;
  primaryModel: string;
  fallbackModel?: string;
  providerPreference?: "openai" | "anthropic";
}

export class AiRouter {
  async execute<T = unknown>(request: AiRequest, characterConfig?: CharacterModelConfig): Promise<AiExecutionResult<T>> {
    const model = request.model ?? characterConfig?.primaryModel ?? TASK_MODEL_MAP["default"]!;
    const provider = resolveProvider(characterConfig?.providerPreference);
    const result = await provider.execute<T>({ ...request, model });

    if (!result.ok && result.errorCode !== "BUDGET_EXCEEDED" && result.errorCode !== "RATE_LIMITED") {
      const fallback = characterConfig?.fallbackModel ?? "gpt-4o-mini";
      if (fallback !== model) {
        return getOpenAi().execute<T>({ ...request, model: fallback });
      }
    }
    return result;
  }
}

export function getAiRouter(): AiRouter {
  return new AiRouter();
}

export { OpenAiProvider, AnthropicProvider };
