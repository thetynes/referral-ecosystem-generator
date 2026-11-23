/**
 * Knowledge-base engine: produces a category-level ecosystem from curated industry
 * profiles, adapted to the user's profile. Requires no external services.
 *
 * Everything this engine outputs is strategic inference. It never claims verified facts
 * about specific companies.
 */
import type { CriterionKey, CriterionRating, PartnerCategory, BusinessProfile } from "../schema";
import { CRITERIA } from "../schema";
import { containsTerm, getArchetype, matchArchetype, type ArchetypeMatch } from "../knowledge";
import type { KBCategory } from "../knowledge/types";
import { profileText } from "./normalize";

const LEVEL_TEXT: Record<CriterionKey, [string, string, string, string, string]> = {
  needEncounter: [
    "Rarely encounters customers who need your services.",
    "Occasionally encounters relevant customer needs.",
    "Encounters relevant needs some of the time.",
    "Frequently encounters relevant needs in the normal course of their work.",
    "Encounters customers who need you routinely; it is built into their workflow.",
  ],
  serviceRelevance: [
    "Needs they see are only loosely related to your services.",
    "Some overlap with your services.",
    "Moderate overlap with your core services.",
    "Needs they encounter map closely to your services.",
    "The needs they see are exactly what you deliver.",
  ],
  frequency: [
    "Opportunities are likely to be rare.",
    "Opportunities are likely to be infrequent.",
    "Opportunities could arise periodically.",
    "Opportunities could arise regularly.",
    "Opportunities could arise very often.",
  ],
  commercialValue: [
    "Referred work tends to be small.",
    "Referred work tends to be below your typical engagement value.",
    "Referred work is typically in line with average engagements.",
    "Referred work tends to be above-average in value.",
    "Referred work tends to be among the most valuable you do.",
  ],
  accessibility: [
    "Decision-makers are very hard to reach.",
    "Decision-makers are gatekept or busy.",
    "Decision-makers are reachable with some effort.",
    "Decision-makers are fairly easy to reach.",
    "Decision-makers are easy to meet and talk to.",
  ],
  recurring: [
    "Mostly one-off introductions.",
    "Limited repeat potential.",
    "Some potential for repeat referrals.",
    "Good potential to become an ongoing channel.",
    "Strong potential for a recurring commercial channel.",
  ],
  mutualBenefit: [
    "Little obvious value you can offer in return.",
    "Limited reciprocal value.",
    "Some reciprocal value.",
    "Clear reciprocal value for the partner.",
    "Strong mutual benefit; both sides solve a real problem.",
  ],
  geographicRelevance: [
    "Poor fit with your service area.",
    "Limited fit with your service area.",
    "Reasonable fit with your service area.",
    "Good fit with your service area.",
    "Strong fit; this partner type operates where you do.",
  ],
  ease: [
    "Very difficult to establish (formal gatekeeping, regulation, or long trust cycles).",
    "Difficult to establish.",
    "Moderate effort to establish.",
    "Fairly easy to start.",
    "Easy to start with a single conversation.",
  ],
};

const STOPWORDS = new Set([
  "and", "the", "your", "with", "for", "companies", "company", "firms", "firm", "services", "service", "providers",
  "provider", "contractors", "contractor", "agencies", "agency", "professionals", "local", "other", "same", "that",
  "who", "you", "after", "before", "their", "programmes", "programs", "offices", "teams", "groups",
]);

function significantWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function clamp(n: number) {
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function isExistingRelationshipName(name: string, existing: string[]): boolean {
  if (existing.length === 0) return false;
  const words = significantWords(name);
  return existing.some((e) => {
    const lower = e.toLowerCase();
    return words.some((w) => containsTerm(lower, w.replace(/s$/, "")));
  });
}

export function adaptCategory(cat: KBCategory, profile: BusinessProfile, text: string): PartnerCategory {
  const scores = [...cat.scores];
  const extra: Partial<Record<CriterionKey, string>> = {};

  const boostHits = (cat.boostIf ?? []).filter((k) => containsTerm(text, k));
  if (boostHits.length > 0) {
    scores[0] = clamp(scores[0] + 1);
    scores[1] = clamp(scores[1] + 1);
    extra.serviceRelevance = `Raised because your description mentions “${boostHits[0]}”.`;
    extra.needEncounter = `Raised because your description mentions “${boostHits[0]}”.`;
  }

  const geoIdx = CRITERIA.indexOf("geographicRelevance");
  const isLocalType = cat.local !== false;
  if (isLocalType && (profile.geography.scope === "national" || profile.geography.scope === "remote")) {
    scores[geoIdx] = clamp(scores[geoIdx] - 1);
    extra.geographicRelevance = "This partner type works locally, while you serve a wide market. You would need partners in each target area.";
  } else if (!isLocalType && profile.geography.scope === "local") {
    extra.geographicRelevance = "This partner type is not tied to one location, so partners outside your area can still send relevant work.";
  }

  const criteria = {} as Record<CriterionKey, CriterionRating>;
  CRITERIA.forEach((key, i) => {
    const score = clamp(scores[i]);
    criteria[key] = {
      score,
      rationale: extra[key] ?? cat.notes?.[key] ?? LEVEL_TEXT[key][score - 1],
      basis: "inferred",
    };
  });

  let searchQueries = cat.queries;
  if (cat.queries.includes("industry association") && profile.targetIndustries.length > 0) {
    searchQueries = profile.targetIndustries.slice(0, 3).map((t) => `${t} association`);
  }

  return {
    id: cat.id,
    name: cat.name,
    relationshipType: cat.type,
    direction: cat.direction,
    channelType: cat.channel,
    opportunity: cat.opportunity,
    rationale: cat.rationale,
    triggers: cat.triggers.map(([event, whyNeed, whoRecognizes, referralMoment, partnerValue]) => ({
      event, whyNeed, whoRecognizes, referralMoment, partnerValue,
    })),
    mutualValue: cat.mutualValue,
    approach: cat.approach,
    collaborationFormats: cat.formats ?? [],
    digitalAuthority: cat.seo ?? [],
    regulatoryNote: cat.regulatory ?? null,
    criteria,
    searchQueries: searchQueries.slice(0, 5),
    existingRelationship: isExistingRelationshipName(cat.name, profile.existingReferrals),
  };
}

export interface KbResult {
  categories: PartnerCategory[];
  match: ArchetypeMatch;
  assumptions: string[];
  guardrails: { title: string; body: string }[];
}

export function runKnowledgeBase(profile: BusinessProfile, forcedArchetypeId?: string): KbResult {
  const text = profileText(profile);
  let match = matchArchetype({
    industry: profile.industry,
    services: profile.services.join(", "),
    other: `${profile.displayName} ${profile.idealCustomer}`,
  });
  if (forcedArchetypeId) {
    const forced = getArchetype(forcedArchetypeId);
    if (forced) match = { ...match, archetype: forced, confidence: "medium" };
  }

  const categories = match.archetype.categories
    .filter((c) => !c.requires || c.requires.some((k) => containsTerm(text, k)))
    .map((c) => adaptCategory(c, profile, text));

  const assumptions = [...(match.archetype.assumptions ?? [])];
  if (profile.expansionMarkets.length > 0) {
    assumptions.push(
      `You want to expand into ${profile.expansionMarkets.join(", ")}. Local partner types need to be identified separately in each new market.`,
    );
  }
  if (!profile.projectValue) {
    assumptions.push("No typical project value was provided, so commercial-value ratings are relative to the industry, not your own pricing.");
  }

  return { categories, match, assumptions, guardrails: match.archetype.guardrails ?? [] };
}
