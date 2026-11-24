/**
 * Core data model for the Referral Ecosystem Generator.
 *
 * Every object that crosses a trust boundary (API input, LLM output, CSV import,
 * external search results) is validated against one of these Zod schemas.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Business intake                                                     */
/* ------------------------------------------------------------------ */

const shortText = (max: number) => z.string().trim().max(max);

export const BusinessInputSchema = z
  .object({
    businessName: shortText(120).optional().default(""),
    website: shortText(300).optional().default(""),
    industry: shortText(160).min(2, "Describe your primary industry or service."),
    serviceArea: shortText(160).min(2, "Enter a geographic market or service area."),
    idealCustomer: shortText(400).min(2, "Describe your ideal customer."),
    services: shortText(600).optional().default(""),
    projectValue: shortText(120).optional().default(""),
    targetIndustries: shortText(400).optional().default(""),
    growthPriority: z
      .enum(["", "more_leads", "higher_value", "recurring", "new_markets", "authority"])
      .optional()
      .default(""),
    existingReferrals: shortText(600).optional().default(""),
    expansionMarkets: shortText(300).optional().default(""),
  })
  .refine((v) => v.businessName.length > 0 || v.website.length > 0, {
    message: "Enter a business name or website URL.",
    path: ["businessName"],
  });

export type BusinessInput = z.infer<typeof BusinessInputSchema>;

/** Normalised profile produced by pipeline stage 1. */
export const BusinessProfileSchema = z.object({
  displayName: z.string(),
  website: z.string().nullable(),
  industry: z.string(),
  services: z.array(z.string()),
  serviceArea: z.string(),
  geography: z.object({
    country: z.enum(["CA", "US", "OTHER", "UNKNOWN"]),
    region: z.string().nullable(),
    scope: z.enum(["local", "regional", "national", "remote"]),
  }),
  idealCustomer: z.string(),
  customerSegments: z.array(z.string()),
  projectValue: z.string().nullable(),
  targetIndustries: z.array(z.string()),
  growthPriority: z.string().nullable(),
  existingReferrals: z.array(z.string()),
  expansionMarkets: z.array(z.string()),
});
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

/* ------------------------------------------------------------------ */
/* Relationship model                                                  */
/* ------------------------------------------------------------------ */

export const RELATIONSHIP_TYPES = [
  "upstream",
  "complementary",
  "downstream",
  "shared_audience",
  "distribution",
] as const;
export const RelationshipTypeSchema = z.enum(RELATIONSHIP_TYPES);
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

/** inbound: they refer customers to you. outbound: you refer to them. reciprocal: both. */
export const DirectionSchema = z.enum(["inbound", "outbound", "reciprocal"]);
export type Direction = z.infer<typeof DirectionSchema>;

/** Occasional referrals vs. a recurring commercial channel. */
export const ChannelTypeSchema = z.enum(["occasional", "recurring"]);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const CRITERIA = [
  "needEncounter",
  "serviceRelevance",
  "frequency",
  "commercialValue",
  "accessibility",
  "recurring",
  "mutualBenefit",
  "geographicRelevance",
  "ease",
] as const;
export const CriterionKeySchema = z.enum(CRITERIA);
export type CriterionKey = z.infer<typeof CriterionKeySchema>;

/**
 * Evidence basis for a value.
 * - verified: directly supported by a reliable, cited source
 * - inferred: plausible strategic judgement (never presented as fact)
 * - user_provided: stated by the user, not independently checked
 * - unknown: could not be established
 */
export const EvidenceBasisSchema = z.enum(["verified", "inferred", "user_provided", "unknown"]);
export type EvidenceBasis = z.infer<typeof EvidenceBasisSchema>;

export const CriterionRatingSchema = z.object({
  score: z.number().int().min(1).max(5),
  rationale: z.string().max(400),
  basis: EvidenceBasisSchema,
});
export type CriterionRating = z.infer<typeof CriterionRatingSchema>;

export const TriggerEventSchema = z.object({
  event: z.string().max(240),
  whyNeed: z.string().max(400),
  whoRecognizes: z.string().max(240),
  referralMoment: z.string().max(300),
  partnerValue: z.string().max(300),
});
export type TriggerEvent = z.infer<typeof TriggerEventSchema>;

export const PartnerCategorySchema = z.object({
  id: z.string(),
  name: z.string().max(120),
  relationshipType: RelationshipTypeSchema,
  direction: DirectionSchema,
  channelType: ChannelTypeSchema,
  opportunity: z.string().max(700),
  rationale: z.string().max(700),
  triggers: z.array(TriggerEventSchema).min(1).max(6),
  mutualValue: z.string().max(600),
  approach: z.string().max(700),
  decisionMaker: z.string().max(240).nullable().default(null),
  overlooked: z.boolean().default(false),
  collaborationFormats: z.array(z.string().max(160)).max(8),
  digitalAuthority: z.array(z.string().max(240)).max(5),
  regulatoryNote: z.string().max(600).nullable(),
  criteria: z.record(CriterionKeySchema, CriterionRatingSchema),
  searchQueries: z.array(z.string().max(120)).max(5),
  existingRelationship: z.boolean(),
});
export type PartnerCategory = z.infer<typeof PartnerCategorySchema>;

/** A category enriched with its computed priority (stage 4). */
export type ScoredCategory = PartnerCategory & {
  score: number; // 0-100, heuristic
  priority: "High" | "Medium" | "Low";
};

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */

export const EngineInfoSchema = z.object({
  /** ai: LLM pipeline. knowledge_base: curated rule-based engine. demo: illustrative dataset. */
  mode: z.enum(["ai", "knowledge_base", "demo"]),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  archetypeId: z.string().nullable(),
  archetypeLabel: z.string().nullable(),
  matchConfidence: z.enum(["high", "medium", "low"]),
  /** Customer-facing notes about this analysis (plain language, shown in the app). */
  notes: z.array(z.string()),
  /** Internal diagnostics (AI fallbacks, budgets, cache). Never sent to customers. */
  diagnostics: z.array(z.string()).optional(),
  version: z.string(),
  /** Estimated AI cost for this analysis (null when no AI call was made). Server-side only. */
  costUsd: z.number().nullable().optional(),
});
export type EngineInfo = z.infer<typeof EngineInfoSchema>;

export const AnalysisSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  isDemo: z.boolean(),
  profile: BusinessProfileSchema,
  engine: EngineInfoSchema,
  categories: z.array(PartnerCategorySchema),
  assumptions: z.array(z.string()),
  guardrails: z.array(z.object({ title: z.string(), body: z.string() })),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

/** What the client receives: possibly truncated to the free tier. */
export type AnalysisView = Analysis & {
  access: {
    tier: "free" | "basic" | "comprehensive";
    lockedCategoryCount: number;
    devUnlocked: boolean;
  };
};

/* ------------------------------------------------------------------ */
/* Real-business discovery                                             */
/* ------------------------------------------------------------------ */

export const FieldStatusSchema = z.enum(["verified", "inferred", "unknown", "user_provided"]);
export type FieldStatus = z.infer<typeof FieldStatusSchema>;

export const ProvenancedFieldSchema = z.object({
  value: z.string().nullable(),
  status: FieldStatusSchema,
  source: z.string().nullable(),
});
export type ProvenancedField = z.infer<typeof ProvenancedFieldSchema>;

export const OrganizationSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: ProvenancedFieldSchema,
  website: ProvenancedFieldSchema,
  location: ProvenancedFieldSchema,
  businessCategory: ProvenancedFieldSchema,
  services: ProvenancedFieldSchema,
  contactChannel: ProvenancedFieldSchema,
  inclusionReason: z.string(),
  referralRelationship: z.string(),
  partnershipOpportunity: z.string(),
  sourceUrls: z.array(z.string()),
  origin: z.enum(["google_places", "brave_search", "csv_import"]),
  researchedAt: z.string(),
  verificationStatus: z.enum(["verified_listing", "partially_verified", "unverified"]),
  completeness: z.number().min(0).max(100),
});
export type Organization = z.infer<typeof OrganizationSchema>;
