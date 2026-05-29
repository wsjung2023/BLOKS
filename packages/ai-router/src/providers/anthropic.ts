// Anthropic provider — wraps Anthropic SDK with BLOKS AiExecutionResult contract
import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, AiRequest, AiExecutionResult } from "../index.js";
import { toAnthropicTool } from "../tools.js";

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6":          { input: 3.00,  output: 15.00 },
  "claude-haiku-4-5-20251001":  { input: 0.80,  output: 4.00  },
  "claude-opus-4-7":            { input: 15.00, output: 75.00 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1M[model] ?? { input: 3.0, output: 15.0 };
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

const MAX_TOOL_ROUNDS = 6;

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
      const anthropicTools = (request.tools ?? []).map(toAnthropicTool);
      const hasTools = anthropicTools.length > 0;

      // messages 배열로 tool-use 대화 관리
      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: request.userPrompt },
      ];

      let totalInput = 0;
      let totalOutput = 0;
      let finalText = "";

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await this.client.messages.create({
          model,
          max_tokens: request.maxTokens ?? 2048,
          messages,
          ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
          ...(hasTools ? { tools: anthropicTools } : {}),
        });

        totalInput += response.usage.input_tokens;
        totalOutput += response.usage.output_tokens;

        // 텍스트 블록 추출
        const textBlock = response.content.find(b => b.type === "text");
        if (textBlock?.type === "text") finalText = textBlock.text;

        // tool_use가 없으면 종료
        const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
        if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") break;

        // AI의 응답 (tool_use 포함) messages에 추가
        messages.push({ role: "assistant", content: response.content });

        // 툴 실행 후 결과를 tool_result로 피드백
        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUseBlocks.map(async (block) => {
            if (block.type !== "tool_use") return null!;
            const tool = (request.tools ?? []).find(t => t.name === block.name);
            const result = tool
              ? await tool.execute(block.input as Record<string, unknown>).catch(e => `오류: ${String(e)}`)
              : `알 수 없는 툴: ${block.name}`;
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: result,
            };
          })
        );

        messages.push({ role: "user", content: toolResults });
      }

      const costUsdEstimate = estimateCost(model, totalInput, totalOutput);

      let output: T | null = null;
      if (request.responseFormat === "json" && finalText) {
        const jsonMatch = finalText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, finalText];
        const jsonStr = jsonMatch[1]?.trim() ?? finalText;
        try {
          output = JSON.parse(jsonStr) as T;
        } catch {
          return { ok: false, model, provider: this.name, costUsdEstimate, confidence: 0, output: null, rawText: finalText, errorCode: "JSON_PARSE_ERROR" };
        }
      } else {
        output = finalText as unknown as T;
      }

      return { ok: true, model, provider: this.name, costUsdEstimate, confidence: 0.9, output, rawText: finalText };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const isRateLimit = message.includes("rate_limit") || message.includes("529") || message.includes("overloaded");
      return { ok: false, model, provider: this.name, costUsdEstimate: 0, confidence: 0, output: null, errorCode: isRateLimit ? "RATE_LIMITED" : "PROVIDER_ERROR" };
    }
  }
}
