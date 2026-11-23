import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { LLMError, type GenerateObjectOptions, type LLMProvider } from "./types";

/** OpenAI provider using the Responses API with structured outputs. */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    baseURL = "https://api.openai.com/v1",
    private effort: "low" | "medium" | "high" = "medium",
  ) {
    this.client = new OpenAI({ apiKey, baseURL, maxRetries: 2, timeout: 180_000 });
  }

  async generateObject<T>({ system, prompt, schema, schemaName, maxTokens = 16000, onUsage }: GenerateObjectOptions<T>): Promise<T> {
    try {
      const response = await this.client.responses.parse({
        model: this.model,
        instructions: system,
        input: prompt,
        max_output_tokens: maxTokens,
        // Reasoning models only; LLM_EFFORT trades depth for latency and cost.
        ...(/^(gpt-5|gpt-6|o\d)/.test(this.model) ? { reasoning: { effort: this.effort } } : {}),
        text: { format: zodTextFormat(schema, schemaName) },
      });
      onUsage?.({ inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 });
      if (response.status === "incomplete") {
        throw new LLMError("The AI response was truncated.", "invalid_output", true);
      }
      if (response.output_parsed == null) {
        throw new LLMError("The AI response did not match the expected structure.", "invalid_output", true);
      }
      return response.output_parsed as T;
    } catch (err) {
      if (err instanceof LLMError) throw err;
      if (err instanceof OpenAI.AuthenticationError) throw new LLMError("OpenAI API key was rejected.", "not_configured");
      if (err instanceof OpenAI.RateLimitError) throw new LLMError("OpenAI rate limit reached.", "provider_error", true);
      if (err instanceof OpenAI.APIError) {
        throw new LLMError(`OpenAI API error (${err.status ?? "network"}).`, "provider_error", (err.status ?? 500) >= 500);
      }
      throw new LLMError(err instanceof Error ? err.message : "Unknown AI provider error.", "provider_error", true);
    }
  }
}
