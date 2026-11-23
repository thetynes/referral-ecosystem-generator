import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { LLMError, type GenerateObjectOptions, type LLMProvider } from "./types";

/**
 * Anthropic Claude provider using structured outputs (JSON schema derived from Zod).
 * Server-side refusal fallbacks are enabled so a declined request is retried on a
 * fallback model inside the same call.
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
    private effort: "low" | "medium" | "high" = "medium",
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  async generateObject<T>({ system, prompt, schema, maxTokens = 16000 }: GenerateObjectOptions<T>): Promise<T> {
    try {
      const response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: maxTokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        output_config: { effort: this.effort, format: betaZodOutputFormat(schema) },
        messages: [{ role: "user", content: prompt }],
      });
      if (response.stop_reason === "refusal") {
        throw new LLMError("The AI provider declined this request.", "refusal");
      }
      if (response.stop_reason === "max_tokens") {
        throw new LLMError("The AI response was truncated.", "invalid_output", true);
      }
      if (response.parsed_output == null) {
        throw new LLMError("The AI response did not match the expected structure.", "invalid_output", true);
      }
      return response.parsed_output as T;
    } catch (err) {
      if (err instanceof LLMError) throw err;
      if (err instanceof Anthropic.AuthenticationError) {
        throw new LLMError("Anthropic API key was rejected.", "not_configured");
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new LLMError("Anthropic rate limit reached.", "provider_error", true);
      }
      if (err instanceof Anthropic.APIError) {
        throw new LLMError(`Anthropic API error (${err.status ?? "network"}).`, "provider_error", (err.status ?? 500) >= 500);
      }
      throw new LLMError(err instanceof Error ? err.message : "Unknown AI provider error.", "provider_error", true);
    }
  }
}
