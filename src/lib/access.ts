import type { Analysis, AnalysisView, ScoredCategory } from "./schema";
import { rankCategories, WEIGHT_PRESETS, presetForGrowthPriority } from "./scoring";
import type { Entitlement } from "./payments/entitlements";

/**
 * Choose the free-tier categories: highest priority first, but always including the best
 * upstream source (the core insight) and at most two categories per relationship type, so
 * the free map shows how the ecosystem actually works rather than one cluster.
 */
export function selectFreeCategories(ranked: ScoredCategory[], limit: number): ScoredCategory[] {
  const picked: ScoredCategory[] = [];
  const perType = new Map<string, number>();
  const take = (c: ScoredCategory) => {
    picked.push(c);
    perType.set(c.relationshipType, (perType.get(c.relationshipType) ?? 0) + 1);
  };
  const bestUpstream = ranked.find((c) => c.relationshipType === "upstream");
  if (bestUpstream && limit > 0) take(bestUpstream);
  for (const c of ranked) {
    if (picked.length >= limit) break;
    if (picked.includes(c)) continue;
    if ((perType.get(c.relationshipType) ?? 0) >= 2) continue;
    take(c);
  }
  for (const c of ranked) {
    if (picked.length >= limit) break;
    if (!picked.includes(c)) take(c);
  }
  return picked;
}

/**
 * Produce the client view of an analysis. Free access returns a limited set of categories
 * and a count of locked categories. It never returns fabricated placeholders.
 */
export function toView(full: Analysis, entitlement: Entitlement | null, freeLimit: number): AnalysisView {
  // Internal cost accounting never leaves the server.
  const analysis: Analysis = { ...full, engine: { ...full.engine, costUsd: undefined } };
  if (entitlement || analysis.isDemo) {
    return {
      ...analysis,
      access: { tier: entitlement?.tier ?? "comprehensive", lockedCategoryCount: 0, devUnlocked: Boolean(entitlement?.dev) },
    };
  }
  const weights = WEIGHT_PRESETS[presetForGrowthPriority(analysis.profile.growthPriority)].weights;
  const keep = new Set(selectFreeCategories(rankCategories(analysis.categories, weights), freeLimit).map((c) => c.id));
  return {
    ...analysis,
    categories: analysis.categories.filter((c) => keep.has(c.id)),
    access: { tier: "free", lockedCategoryCount: Math.max(0, analysis.categories.length - keep.size), devUnlocked: false },
  };
}
