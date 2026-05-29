// OpenAI provider — Chat Completions with tool calling + Responses API fallback
import OpenAI from "openai";
import type { AiProvider, AiRequest, AiExecutionResult } from "../index.js";
import { toOpenAITool } from "../tools.js";

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4o":             { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":        { input: 0.15,  output: 0.60  },
  "gpt-4.1":            { input: 2.00,  output: 8.00  },
  "gpt-4-turbo":        { input: 10.00, output: 30.00 },
  "o1":                 { input: 15.00, output: 60.00 },
  "o1-mini":            { input: 3.00,  output: 12.00 },
  "o3-mini":            { input: 1.10,  output: 4.40  },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1M[model] ?? { input: 10.0, output: 30.0 };
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

const MAX_TOOL_ROUNDS = 6;

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor() {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OPENAI_API_KEY env var is required");
    this.client = new OpenAI({
      apiKey,
      organization: process.env["OPENAI_ORG_ID"],
      project: process.env["OPENAI_PROJECT_ID"],
    });
  }

  async execute<T = unknown>(request: AiRequest): Promise<AiExecutionResult<T>> {
    const model = request.model ?? "gpt-4o-mini";
    const hasTools = (request.tools ?? []).length > 0;

    try {
      if (hasTools) {
        return await this.executeWithTools<T>(request, model);
      }
      return await this.executeResponsesApi<T>(request, model);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const isRateLimit = message.includes("rate_limit") || message.includes("429");
      const isContextLength = message.includes("context_length") || message.includes("maximum context");
      return {
        ok: false, model, provider: this.name, costUsdEstimate: 0, confidence: 0, output: null,
        errorCode: isRateLimit ? "RATE_LIMITED" : isContextLength ? "CONTEXT_TOO_LONG" : "PROVIDER_ERROR",
      };
    }
  }

  // Tool calling via Chat Completions API
  private async executeWithTools<T>(request: AiRequest, model: string): Promise<AiExecutionResult<T>> {
    const openaiTools = (request.tools ?? []).map(toOpenAITool);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...(request.systemPrompt ? [{ role: "system" as const, content: request.systemPrompt }] : []),
      { role: "user", content: request.userPrompt },
    ];

    let totalInput = 0;
    let totalOutput = 0;
    let finalText = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: request.maxTokens ?? 2048,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: openaiTools as any,
        tool_choice: "auto" as const,
        ...(request.responseFormat === "json" ? { response_format: { type: "json_object" as const } } : {}),
      });

      totalInput += response.usage?.prompt_tokens ?? 0;
      totalOutput += response.usage?.completion_tokens ?? 0;

      const choice = response.choices[0];
      const msg = choice?.message;
      if (!msg) break;

      finalText = msg.content ?? "";

      // tool_calls가 없으면 종료
      if (!msg.tool_calls || msg.tool_calls.length === 0 || choice?.finish_reason === "stop") break;

      // AI 응답 messages에 추가
      messages.push(msg);

      // 툴 실행 후 결과 피드백
      for (const tc of msg.tool_calls) {
        const tool = (request.tools ?? []).find(t => t.name === tc.function.name);
        let result = `알 수 없는 툴: ${tc.function.name}`;
        if (tool) {
          try {
            const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
            result = await tool.execute(args);
          } catch (e) {
            result = `툴 실행 오류: ${String(e)}`;
          }
        }
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
    }

    const costUsdEstimate = estimateCost(model, totalInput, totalOutput);

    let output: T | null = null;
    if (request.responseFormat === "json" && finalText) {
      try {
        output = JSON.parse(finalText) as T;
      } catch {
        return { ok: false, model, provider: this.name, costUsdEstimate, confidence: 0, output: null, rawText: finalText, errorCode: "JSON_PARSE_ERROR" };
      }
    } else {
      output = finalText as unknown as T;
    }

    return { ok: true, model, provider: this.name, costUsdEstimate, confidence: 0.9, output, rawText: finalText };
  }

  // No-tool path via Responses API (original implementation)
  private async executeResponsesApi<T>(request: AiRequest, model: string): Promise<AiExecutionResult<T>> {
    const params: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
      model,
      input: request.userPrompt,
      max_output_tokens: request.maxTokens ?? 2048,
      ...(request.systemPrompt ? { instructions: request.systemPrompt } : {}),
      ...(request.jsonSchema
        ? { text: { format: { type: "json_schema", name: "output", schema: request.jsonSchema, strict: true } } }
        : request.responseFormat === "json"
          ? { text: { format: { type: "json_object" } } }
          : {}),
    };

    const response = await this.client.responses.create(params);
    const rawText = response.output_text ?? "";
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const costUsdEstimate = estimateCost(model, inputTokens, outputTokens);

    if (!request.jsonSchema && request.responseFormat !== "json") {
      return { ok: true, model, provider: this.name, costUsdEstimate, confidence: 0.9, output: rawText as unknown as T, rawText };
    }

    try {
      return { ok: true, model, provider: this.name, costUsdEstimate, confidence: 0.9, output: JSON.parse(rawText) as T, rawText };
    } catch {
      // Retry with correction
      const retry = await this.client.responses.create({ ...params, input: request.userPrompt + "\n\n반드시 유효한 JSON만 반환하세요." });
      const retryText = retry.output_text ?? "";
      const retryCost = estimateCost(model, retry.usage?.input_tokens ?? 0, retry.usage?.output_tokens ?? 0);
      try {
        return { ok: true, model, provider: this.name, costUsdEstimate: costUsdEstimate + retryCost, confidence: 0.7, output: JSON.parse(retryText) as T, rawText: retryText };
      } catch {
        return { ok: false, model, provider: this.name, costUsdEstimate: costUsdEstimate + retryCost, confidence: 0, output: null, rawText, errorCode: "JSON_PARSE_ERROR" };
      }
    }
  }
}
