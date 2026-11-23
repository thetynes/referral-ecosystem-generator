/**
 * Pipeline orchestrator.
 *
 * Stage 1  normalise input                     (deterministic)
 * Stage 2  candidate partner categories        (AI, or curated knowledge base)
 * Stage 3  relationship & trigger analysis     (AI, or curated knowledge base)
 * Stage 4  scoring & prioritisation            (deterministic, client-adjustable — see lib/scoring.ts)
 * Stage 5  real-organisation research          (paid; lib/discovery)
 * Stage 6  verification & structuring          (lib/discovery/verify.ts)
 * Stage 7  network & report assembly           (client components + lib/narrative.ts)
 */
import { createHash, randomUUID } from "node:crypto";
import type { Analysis, BusinessInput } from "../schema";
import { AnalysisSchema } from "../schema";
import { normalizeInput } from "./normalize";
import { isExistingRelationshipName, runKnowledgeBase } from "./kb-engine";
import { runAiPipeline } from "./ai-engine";
import { getLLMProvider, LLMError, type TokenUsage } from "../llm";
import { checkAiAllowance, recordAiSpend } from "../ai-budget";
import { config } from "../config";
import { baseGuardrails } from "../knowledge/guardrails";
import { getStore } from "../store";

export const ENGINE_VERSION = "1.0.0";
const AI_CACHE_TTL = 60 * 60 * 24 * 7;

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export interface GenerateOptions {
  /** Skip the AI provider even if configured. */
  forceKnowledgeBase?: boolean;
  /**
   * AI policy for this request. AI runs only when `requested` is true AND the configured access policy
   * and spend caps allow it. Anonymous visitors get the curated analysis.
   */
  ai?: { requested: boolean; tester: string | null };
  /** Override the automatically matched industry profile (knowledge-base mode). */
  archetypeId?: string;
}

export async function generateAnalysis(input: BusinessInput, opts: GenerateOptions = {}): Promise<Analysis> {
  const profile = normalizeInput(input);
  const kb = runKnowledgeBase(profile, opts.archetypeId);
  const notes: string[] = [];
  let provider = opts.forceKnowledgeBase || !opts.ai?.requested ? null : getLLMProvider();
  const tester = opts.ai?.tester ?? null;
  const fallbackMode = config().llm.fallback;
  let costUsd: number | null = null;
  if (provider) {
    const allowance = await checkAiAllowance(tester);
    if (!allowance.allowed) {
      provider = null;
      if (!allowance.silent) {
        if (fallbackMode === "error") throw new AiUnavailableError(allowance.reason);
        notes.push(`${allowance.reason} Showing the curated analysis instead.`);
      }
    }
  }

  let categories = kb.categories;
  let mode: Analysis["engine"]["mode"] = "knowledge_base";
  let assumptions = kb.assumptions;

  if (provider) {
    // Cache key excludes name, website and named partners (they don't affect the AI stages).
    const cacheKey = createHash("sha256")
      .update(JSON.stringify({
        v: ENGINE_VERSION, p: provider.name, m: provider.model,
        industry: profile.industry, services: profile.services, area: profile.serviceArea,
        customer: profile.idealCustomer, value: profile.projectValue, targets: profile.targetIndustries,
        growth: profile.growthPriority, expand: profile.expansionMarkets,
      }))
      .digest("hex");
    const store = await getStore();
    try {
      let result = await store.get<Awaited<ReturnType<typeof runAiPipeline>>>("ai_cache", cacheKey);
      if (!result) {
        const reference = kb.match.confidence === "low" ? [] : kb.match.archetype.categories.map((c) => c.name);
        const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
        const onUsage = (u: TokenUsage) => {
          usage.inputTokens += u.inputTokens;
          usage.outputTokens += u.outputTokens;
        };
        try {
          result = await runAiPipeline(provider, profile, reference, { onUsage, maxOutputTokens: config().llm.maxOutputTokens, batchSize: config().llm.batchSize });
        } finally {
          // Record spend even when a later stage fails: the tokens were still billed.
          if (usage.inputTokens + usage.outputTokens > 0) costUsd = await recordAiSpend(usage, tester);
        }
        await store.set("ai_cache", cacheKey, result, AI_CACHE_TTL);
      } else {
        notes.push("Served from cache: an identical business description was analysed recently.");
      }
      // Re-evaluate existing-relationship flags against this user's own list.
      categories = result.categories.map((c) => ({
        ...c,
        existingRelationship: isExistingRelationshipName(c.name, profile.existingReferrals),
      }));
      mode = "ai";
      assumptions = [
        ...(result.customerJourney.length ? [`Customer journey used for the analysis: ${result.customerJourney.join(" → ")}.`] : []),
        ...kb.assumptions.filter((a) => !a.startsWith("Your industry did not match")),
      ];
    } catch (err) {
      console.error("AI pipeline failed; falling back to knowledge base:", err instanceof Error ? err.message : err);
      const reason = err instanceof LLMError ? err.message : "The AI analysis could not be completed.";
      if (fallbackMode === "error") throw new AiUnavailableError(reason);
      notes.push(`${reason} Showing the curated knowledge-base analysis instead.`);
    }
  }

  if (mode === "knowledge_base") {
    if (kb.match.confidence === "low") {
      notes.push(
        "Your industry did not closely match a curated industry profile. The ecosystem below uses universal partner roles. Add more detail about your services, choose the closest profile, or configure an AI provider for an industry-specific analysis.",
      );
    } else if (kb.match.alternatives.length > 0 && kb.match.confidence !== "high") {
      notes.push(
        `Your description also resembles: ${kb.match.alternatives.map((a) => a.label).join(", ")}. You can switch the industry profile if this one is not right.`,
      );
    }
  }

  const archetypeGuardrails = kb.match.confidence === "low" ? [] : kb.guardrails;
  const analysis: Analysis = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    isDemo: false,
    profile,
    engine: {
      mode,
      provider: mode === "ai" ? provider!.name : null,
      model: mode === "ai" ? provider!.model : null,
      archetypeId: kb.match.archetype.id,
      archetypeLabel: kb.match.secondary ? `${kb.match.archetype.label} + ${kb.match.secondary.label}` : kb.match.archetype.label,
      matchConfidence: mode === "ai" ? "high" : kb.match.confidence,
      notes,
      version: ENGINE_VERSION,
      costUsd,
    },
    categories,
    assumptions,
    guardrails: [...archetypeGuardrails, ...baseGuardrails(profile)],
  };

  return AnalysisSchema.parse(analysis);
}
