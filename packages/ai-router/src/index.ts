// @bloks/ai-router — model selection, provider routing, cost guardrails (doc 11 P0 fix #8: OpenAI primary)
import { OpenAiProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";

// ── Core types ────────────────────────────────────────────────────────────────

export interface AiRequest {
  /** Task type — used for model selection heuristics */
  taskType?: string;
  /** System/role prompt */
  systemPrompt?: string;
  /** User-facing prompt */
  userPrompt: string;
  /** Preferred model ID (overrides routing policy) */
  model?: string;
  /** Max output tokens */
  maxTokens?: number;
  /** Sampling temperature */
  temperature?: number;
  /** Expected response format */
  responseFormat?: "text" | "json";
  /** Character ID for per-character model config */
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

// ── Character model config (per-character overrides) ─────────────────────────

export interface CharacterModelConfig {
  characterId: string;
  /** Primary model ID — default "gpt-4o-mini" per doc 11 P0 fix #8 */
  primaryModel: string;
  /** Fallback model ID */
  fallbackModel?: string;
  /** Provider preference — currently always "openai" per MVP policy */
  providerPreference?: "openai" | "anthropic";
}

// ── Model selection policy ────────────────────────────────────────────────────

const TASK_MODEL_MAP: Record<string, string> = {
  prd_draft:         "gpt-4o",
  research_summary:  "gpt-4o",
  marketing_copy:    "gpt-4o-mini",
  approval_analysis: "gpt-4o-mini",
  character_action:  "gpt-4o-mini",
  default:           "gpt-4o-mini",
};

function selectModel(request: AiRequest, config?: CharacterModelConfig): string {
  // Explicit override takes highest priority
  if (request.model) return request.model;
  // Per-character config
  if (config?.primaryModel) return config.primaryModel;
  // Task-type heuristic
  return TASK_MODEL_MAP[request.taskType ?? "default"] ?? TASK_MODEL_MAP["default"]!;
}

// ── Budget guardrail ──────────────────────────────────────────────────────────

const MAX_COST_PER_TASK_USD = parseFloat(
  process.env["AI_MAX_COST_PER_TASK_USD"] ?? "0.5"
);

function estimatedInputCost(model: string, promptLength: number): number {
  // Rough estimate: 4 chars per token, $2.50/1M input tokens for gpt-4o
  const inputTokens = Math.ceil(promptLength / 4);
  const ratePerM = model.includes("mini") ? 0.15 : 2.50;
  return (inputTokens / 1_000_000) * ratePerM;
}

// ── AiRouter ──────────────────────────────────────────────────────────────────

export class AiRouter {
  private openai: OpenAiProvider;
  private anthropic: AnthropicProvider | null = null;

  constructor() {
    this.openai = new OpenAiProvider();
    // Anthropic provider initialized lazily (API key optional in MVP)
    if (process.env["ANTHROPIC_API_KEY"]) {
      try {
        this.anthropic = new AnthropicProvider();
      } catch {
        // Non-fatal — Anthropic is non-primary in MVP
      }
    }
  }

  async execute<T = unknown>(
    request: AiRequest,
    characterConfig?: CharacterModelConfig
  ): Promise<AiExecutionResult<T>> {
    const model = selectModel(request, characterConfig);
    const fullPrompt = (request.systemPrompt ?? "") + request.userPrompt;

    // Budget pre-check
    const estimatedCost = estimatedInputCost(model, fullPrompt.length);
    if (estimatedCost > MAX_COST_PER_TASK_USD) {
      return {
        ok: false,
        model,
        provider: "none",
        costUsdEstimate: 0,
        confidence: 0,
        output: null,
        errorCode: "BUDGET_EXCEEDED",
      };
    }

    // Per doc 11 P0 fix #8: OpenAI is primary provider in MVP
    const provider = this.resolveProvider(characterConfig);
    const enrichedRequest: AiRequest = { ...request, model };

    const result = await provider.execute<T>(enrichedRequest);

    // Fallback on retryable errors
    if (!result.ok && result.errorCode !== "BUDGET_EXCEEDED" && result.errorCode !== "RATE_LIMITED") {
      const fallbackModel = characterConfig?.fallbackModel ?? "gpt-4o-mini";
      if (fallbackModel !== model) {
        console.warn(`[AiRouter] Primary model ${model} failed (${result.errorCode}), falling back to ${fallbackModel}`);
        return this.openai.execute<T>({ ...enrichedRequest, model: fallbackModel });
      }
    }

    return result;
  }

  private resolveProvider(config?: CharacterModelConfig): AiProvider {
    // MVP policy: always use OpenAI unless Anthropic explicitly configured and available
    if (config?.providerPreference === "anthropic" && this.anthropic) {
      return this.anthropic;
    }
    return this.openai;
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

let _router: AiRouter | null = null;

export function getAiRouter(): AiRouter {
  _router ??= new AiRouter();
  return _router;
}

export { OpenAiProvider, AnthropicProvider };
