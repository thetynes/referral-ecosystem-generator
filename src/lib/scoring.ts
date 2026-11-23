/**
 * Stage 4 — explainable weighted prioritisation.
 *
 * Scores are a strategic heuristic: a weighted average of 1–5 criterion ratings,
 * normalised to 0–100. They are NOT probabilities, volumes, or forecasts.
 */
import type { CriterionKey, PartnerCategory, ScoredCategory } from "./schema";
import { CRITERIA } from "./schema";

export type Weights = Record<CriterionKey, number>;

export const CRITERION_META: Record<CriterionKey, { label: string; question: string }> = {
  needEncounter: {
    label: "Need encounter",
    question: "How likely is this partner to encounter a customer who needs you?",
  },
  serviceRelevance: {
    label: "Service relevance",
    question: "How closely do the needs they see match what you actually sell?",
  },
  frequency: {
    label: "Referral frequency",
    question: "How often could relevant opportunities plausibly arise?",
  },
  commercialValue: {
    label: "Commercial value",
    question: "How valuable are the projects this channel tends to surface?",
  },
  accessibility: {
    label: "Decision-maker access",
    question: "How reachable are the people who decide who gets referred?",
  },
  recurring: {
    label: "Recurring potential",
    question: "Could this become an ongoing channel rather than a one-off?",
  },
  mutualBenefit: {
    label: "Mutual benefit",
    question: "How much genuine value can you offer them in return?",
  },
  geographicRelevance: {
    label: "Geographic fit",
    question: "How well does this partner type fit your service area?",
  },
  ease: {
    label: "Ease of establishing",
    question: "How easy is the relationship to start? (5 = easy, 1 = very hard)",
  },
};

export const WEIGHT_PRESETS: Record<string, { label: string; description: string; weights: Weights }> = {
  balanced: {
    label: "Balanced",
    description: "Even emphasis on volume, value, and feasibility.",
    weights: {
      needEncounter: 3, serviceRelevance: 3, frequency: 2, commercialValue: 2, accessibility: 2,
      recurring: 2, mutualBenefit: 2, geographicRelevance: 1, ease: 1,
    },
  },
  quick_wins: {
    label: "Quick wins",
    description: "Favour partners who are easy to reach and refer often.",
    weights: {
      needEncounter: 2, serviceRelevance: 2, frequency: 3, commercialValue: 1, accessibility: 3,
      recurring: 1, mutualBenefit: 2, geographicRelevance: 2, ease: 3,
    },
  },
  high_value: {
    label: "High-value projects",
    description: "Favour channels that surface larger engagements.",
    weights: {
      needEncounter: 2, serviceRelevance: 3, frequency: 1, commercialValue: 3, accessibility: 1,
      recurring: 2, mutualBenefit: 2, geographicRelevance: 1, ease: 1,
    },
  },
  recurring: {
    label: "Recurring channels",
    description: "Favour partners who could send work repeatedly.",
    weights: {
      needEncounter: 2, serviceRelevance: 2, frequency: 3, commercialValue: 2, accessibility: 2,
      recurring: 3, mutualBenefit: 2, geographicRelevance: 1, ease: 1,
    },
  },
};

export const DEFAULT_WEIGHTS = WEIGHT_PRESETS.balanced.weights;

/** Map the intake "growth priority" to a sensible starting preset. */
export function presetForGrowthPriority(priority: string | null | undefined): keyof typeof WEIGHT_PRESETS {
  switch (priority) {
    case "higher_value":
      return "high_value";
    case "recurring":
      return "recurring";
    case "more_leads":
      return "quick_wins";
    default:
      return "balanced";
  }
}

export function scoreCategory(category: PartnerCategory, weights: Weights = DEFAULT_WEIGHTS): number {
  let total = 0;
  let weightSum = 0;
  for (const key of CRITERIA) {
    const w = Math.max(0, weights[key] ?? 0);
    const rating = category.criteria[key];
    if (!rating || w === 0) continue;
    total += w * ((rating.score - 1) / 4);
    weightSum += w;
  }
  if (weightSum === 0) return 0;
  return Math.round((total / weightSum) * 100);
}

export function priorityBand(score: number): ScoredCategory["priority"] {
  if (score >= 70) return "High";
  if (score >= 52) return "Medium";
  return "Low";
}

export function rankCategories(categories: PartnerCategory[], weights: Weights = DEFAULT_WEIGHTS): ScoredCategory[] {
  return categories
    .map((c) => {
      const score = scoreCategory(c, weights);
      return { ...c, score, priority: priorityBand(score) };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** Per-criterion contribution, used to explain a score in the UI. */
export function explainScore(category: PartnerCategory, weights: Weights = DEFAULT_WEIGHTS) {
  const weightSum = CRITERIA.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0) || 1;
  return CRITERIA.map((key) => {
    const rating = category.criteria[key];
    const w = Math.max(0, weights[key] ?? 0);
    return {
      key,
      label: CRITERION_META[key].label,
      score: rating?.score ?? 0,
      rationale: rating?.rationale ?? "",
      basis: rating?.basis ?? "unknown",
      weight: w,
      contribution: rating ? Math.round(((w * ((rating.score - 1) / 4)) / weightSum) * 100) : 0,
    };
  });
}
