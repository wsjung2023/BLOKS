// Anthropic provider — wraps Anthropic SDK with BLOKS AiExecutionResult contract
import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, AiRequest, AiExecutionResult } from "../index.js";

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6":          { input: 3.00,  output: 15.00 },
  "claude-haiku-4-5-20251001":  { input: 0.80,  output: 4.00  },
  "claude-opus-4-7":            { input: 15.00, output: 75.00 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1M[model] ?? { input: 3.0, output: 15.0 };
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor() {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY env var is required");
    this.client = new Anthropic({ apiKey });
  }

  async execute<T = unknown>(request: AiRequest): Promise<AiExecutionResult<T>> {
    const model = request.model ?? "claude-haiku-4-5-20251001";

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 2048,
        messages: [{ role: "user", content: request.userPrompt }],
        ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
      });

      const block = response.content[0];
      const rawText = block?.type === "text" ? block.text : "";
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const costUsdEstimate = estimateCost(model, inputTokens, outputTokens);

      let output: T | null = null;
      if (request.responseFormat === "json" && rawText) {
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, rawText];
        const jsonStr = jsonMatch[1]?.trim() ?? rawText;
        try {
          output = JSON.parse(jsonStr) as T;
        } catch {
          return { ok: false, model, provider: this.name, costUsdEstimate, confidence: 0, output: null, rawText, errorCode: "JSON_PARSE_ERROR" };
        }
      } else {
        output = rawText as unknown as T;
      }

      return { ok: true, model, provider: this.name, costUsdEstimate, confidence: 0.9, output, rawText };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const isRateLimit = message.includes("rate_limit") || message.includes("529") || message.includes("overloaded");
      return { ok: false, model, provider: this.name, costUsdEstimate: 0, confidence: 0, output: null, errorCode: isRateLimit ? "RATE_LIMITED" : "PROVIDER_ERROR" };
    }
  }
}
