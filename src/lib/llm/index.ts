import { config } from "../config";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { LLMError, type GenerateObjectOptions, type LLMProvider } from "./types";

export { LLMError };
export type { LLMProvider, GenerateObjectOptions };

let override: LLMProvider | null | undefined;

/** Test hook: inject a provider (or null to force "not configured"). */
export function setLLMProviderForTesting(provider: LLMProvider | null | undefined) {
  override = provider;
}

/** Returns the configured provider, or null when no AI credentials are present. */
export function getLLMProvider(): LLMProvider | null {
  if (override !== undefined) return override;
  const { llm } = config();
  if (llm.provider === "anthropic" && llm.anthropicKey) return new AnthropicProvider(llm.anthropicKey, llm.anthropicModel, llm.effort);
  if (llm.provider === "openai" && llm.openaiKey) return new OpenAIProvider(llm.openaiKey, llm.openaiModel);
  return null;
}

/** Calls the provider with one extra attempt for retryable failures (exponential backoff). */
export async function generateWithRetry<T>(provider: LLMProvider, options: GenerateObjectOptions<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await provider.generateObject(options);
    } catch (err) {
      lastError = err;
      const retryable = err instanceof LLMError ? err.retryable : true;
      if (!retryable || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastError;
}
