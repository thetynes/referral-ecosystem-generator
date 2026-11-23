import type { Archetype } from "./types";
import { siteConstruction } from "./archetypes/construction";
import { immigrationLaw, generalLegal } from "./archetypes/legal";
import { softwareAgency } from "./archetypes/software";
import { homeTrades } from "./archetypes/trades";
import { accountingFinancial, marketingAgency } from "./archetypes/professional";
import { healthcarePractice } from "./archetypes/health";
import { genericFramework } from "./archetypes/generic";

export const ARCHETYPES: Archetype[] = [
  siteConstruction,
  immigrationLaw,
  generalLegal,
  softwareAgency,
  homeTrades,
  accountingFinancial,
  marketingAgency,
  healthcarePractice,
];

export const GENERIC_ARCHETYPE = genericFramework;

export function getArchetype(id: string): Archetype | undefined {
  if (id === GENERIC_ARCHETYPE.id) return GENERIC_ARCHETYPE;
  return ARCHETYPES.find((a) => a.id === id);
}

export interface ArchetypeMatch {
  archetype: Archetype;
  confidence: "high" | "medium" | "low";
  score: number;
  matchedTerms: string[];
  alternatives: { id: string; label: string; score: number }[];
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word / whole-phrase containment, tolerant of a trailing plural "s". */
export function containsTerm(text: string, term: string): boolean {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(term.toLowerCase())}s?($|[^a-z0-9])`, "i");
  return re.test(text);
}

/**
 * Match free-text business information to a curated archetype.
 * The primary industry field is weighted twice as heavily as other fields.
 */
export function matchArchetype(fields: { industry: string; services?: string; other?: string }): ArchetypeMatch {
  const primary = fields.industry.toLowerCase();
  const secondary = `${fields.services ?? ""} ${fields.other ?? ""}`.toLowerCase();

  const scored = ARCHETYPES.map((archetype) => {
    let score = 0;
    const matchedTerms: string[] = [];
    for (const kw of archetype.keywords) {
      const inPrimary = containsTerm(primary, kw);
      const inSecondary = containsTerm(secondary, kw);
      if (inPrimary) score += 6;
      else if (inSecondary) score += 3;
      if (inPrimary || inSecondary) matchedTerms.push(kw);
    }
    for (const kw of archetype.weakKeywords ?? []) {
      const inPrimary = containsTerm(primary, kw);
      const inSecondary = containsTerm(secondary, kw);
      if (inPrimary) score += 2;
      else if (inSecondary) score += 1;
      if (inPrimary || inSecondary) matchedTerms.push(kw);
    }
    return { archetype, score, matchedTerms };
  });

  // Specialised archetypes (e.g. immigration law) take precedence over their general parent.
  for (const s of scored) {
    if (s.archetype.specializes && s.score >= 3) {
      const parent = scored.find((p) => p.archetype.id === s.archetype.specializes);
      if (parent && parent.score <= s.score + 6) parent.score = Math.min(parent.score, Math.floor(s.score * 0.6));
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const [top, second] = scored;
  const alternatives = scored
    .slice(1, 3)
    .filter((s) => s.score >= 3)
    .map((s) => ({ id: s.archetype.id, label: s.archetype.label, score: s.score }));

  if (!top || top.score < 3) {
    return { archetype: GENERIC_ARCHETYPE, confidence: "low", score: top?.score ?? 0, matchedTerms: [], alternatives };
  }
  const ambiguous = second && second.score >= 3 && second.score >= top.score * 0.8;
  const confidence: ArchetypeMatch["confidence"] = top.score >= 6 && !ambiguous ? "high" : "medium";
  return { archetype: top.archetype, confidence, score: top.score, matchedTerms: top.matchedTerms, alternatives };
}
