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
import { getLLMProvider, LLMError } from "../llm";
import { baseGuardrails } from "../knowledge/guardrails";
import { getStore } from "../store";

export const ENGINE_VERSION = "1.0.0";
const AI_CACHE_TTL = 60 * 60 * 24 * 7;

export interface GenerateOptions {
  /** Skip the AI provider even if configured. */
  forceKnowledgeBase?: boolean;
  /** Override the automatically matched industry profile (knowledge-base mode). */
  archetypeId?: string;
}

export async function generateAnalysis(input: BusinessInput, opts: GenerateOptions = {}): Promise<Analysis> {
  const profile = normalizeInput(input);
  const kb = runKnowledgeBase(profile, opts.archetypeId);
  const provider = opts.forceKnowledgeBase ? null : getLLMProvider();
  const notes: string[] = [];

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
        result = await runAiPipeline(provider, profile, reference);
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
      archetypeLabel: kb.match.archetype.label,
      matchConfidence: mode === "ai" ? "high" : kb.match.confidence,
      notes,
      version: ENGINE_VERSION,
    },
    categories,
    assumptions,
    guardrails: [...archetypeGuardrails, ...baseGuardrails(profile)],
  };

  return AnalysisSchema.parse(analysis);
}
