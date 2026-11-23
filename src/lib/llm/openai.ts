import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { LLMError, type GenerateObjectOptions, type LLMProvider } from "./types";

/** OpenAI provider using the Responses API with structured outputs. */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor(apiKey: string, readonly model: string) {
    this.client = new OpenAI({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  async generateObject<T>({ system, prompt, schema, schemaName, maxTokens = 16000 }: GenerateObjectOptions<T>): Promise<T> {
    try {
      const response = await this.client.responses.parse({
        model: this.model,
        instructions: system,
        input: prompt,
        max_output_tokens: maxTokens,
        text: { format: zodTextFormat(schema, schemaName) },
      });
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
