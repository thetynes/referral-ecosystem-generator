import type { z } from "zod";

export interface GenerateObjectOptions<T> {
  /** Stable instructions (cache-friendly). */
  system: string;
  /** Per-request content. Untrusted data must be wrapped and labelled by the caller. */
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
}

export interface LLMProvider {
  readonly name: "anthropic" | "openai" | "mock";
  readonly model: string;
  generateObject<T>(options: GenerateObjectOptions<T>): Promise<T>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly kind: "refusal" | "invalid_output" | "provider_error" | "not_configured",
    readonly retryable = false,
  ) {
    super(message);
    this.name = "LLMError";
  }
}
