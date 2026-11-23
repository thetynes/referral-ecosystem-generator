import type { ChannelType, CriterionKey, Direction, RelationshipType } from "../schema";

/** [event, why it creates a need, who recognises it, when to refer, value to the referrer] */
export type TriggerTuple = [string, string, string, string, string];

/** Order: needEncounter, serviceRelevance, frequency, commercialValue, accessibility, recurring, mutualBenefit, geographicRelevance, ease */
export type ScoreTuple = [number, number, number, number, number, number, number, number, number];

export interface KBCategory {
  id: string;
  name: string;
  type: RelationshipType;
  direction: Direction;
  channel: ChannelType;
  opportunity: string;
  rationale: string;
  triggers: TriggerTuple[];
  mutualValue: string;
  approach: string;
  /** The specific role at the partner organisation who decides whether a referral happens. */
  decisionMaker?: string;
  /** True when most businesses in the industry miss this relationship. */
  overlooked?: boolean;
  formats?: string[];
  seo?: string[];
  regulatory?: string;
  scores: ScoreTuple;
  /** Optional category-specific explanations for individual criteria. */
  notes?: Partial<Record<CriterionKey, string>>;
  /** Search terms used by named-company discovery. */
  queries: string[];
  /** Keywords (in services / customers / industry) that make this category more relevant. */
  boostIf?: string[];
  /** Include only if one of these keywords appears in the business description. */
  requires?: string[];
  /** Partner type is inherently local (true) or works regardless of geography (false). Default true. */
  local?: boolean;
}

export interface Archetype {
  id: string;
  label: string;
  /** Strong signals (weight 3). */
  keywords: string[];
  /** Weaker signals (weight 1). */
  weakKeywords?: string[];
  /** If this archetype matches, it takes precedence over the more general archetype with this id. */
  specializes?: string;
  /** Archetypes in the same family can be blended when a business spans both (e.g. excavation + waterproofing). */
  family?: string;
  /** Category ids (in other archetypes) that describe this archetype's own trade — excluded when blending. */
  selfCategoryIds?: string[];
  categories: KBCategory[];
  guardrails?: { title: string; body: string }[];
  assumptions?: string[];
}
