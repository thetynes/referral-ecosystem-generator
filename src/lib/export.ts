import Papa from "papaparse";
import type { Organization, ScoredCategory } from "./schema";
import { CRITERIA } from "./schema";
import { CRITERION_META } from "./scoring";
import { TYPE_META, DIRECTION_META } from "./ui-meta";
import { csvSafe } from "./discovery/csv";

const s = (v: unknown) => csvSafe(String(v ?? ""));

export function opportunitiesCsv(ranked: ScoredCategory[]): string {
  return Papa.unparse(
    ranked.map((c, i) => ({
      rank: i + 1,
      partner_category: s(c.name),
      relationship_type: TYPE_META[c.relationshipType].short,
      referral_direction: DIRECTION_META[c.direction].label,
      channel: c.channelType === "recurring" ? "Potential recurring channel" : "Occasional referrals",
      priority: c.priority,
      score_0_100_heuristic: c.score,
      existing_relationship: c.existingRelationship ? "yes" : "no",
      referral_opportunity: s(c.opportunity),
      why_it_makes_sense: s(c.rationale),
      trigger_events: s(c.triggers.map((t) => t.event).join(" | ")),
      mutual_value: s(c.mutualValue),
      suggested_approach: s(c.approach),
      regulatory_note: s(c.regulatoryNote ?? ""),
      ...Object.fromEntries(CRITERIA.map((k) => [`${CRITERION_META[k].label} (1-5, inferred)`, c.criteria[k]?.score ?? ""])),
    })),
  );
}

export function organizationsCsv(orgs: Organization[], categoryName: (id: string) => string): string {
  return Papa.unparse(
    orgs.map((o) => ({
      business_name: s(o.name.value),
      name_status: o.name.status,
      website: s(o.website.value),
      website_status: o.website.status,
      location: s(o.location.value),
      location_status: o.location.status,
      business_category: s(o.businessCategory.value),
      services: s(o.services.value),
      public_contact_channel: s(o.contactChannel.value),
      partner_category: s(categoryName(o.categoryId)),
      reason_for_inclusion: s(o.inclusionReason),
      potential_referral_relationship: s(o.referralRelationship),
      partnership_opportunity_inferred: s(o.partnershipOpportunity),
      source_urls: s(o.sourceUrls.join(" ")),
      origin: o.origin,
      verification_status: o.verificationStatus,
      completeness_pct: o.completeness,
      date_researched: o.researchedAt.slice(0, 10),
    })),
  );
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ecosystem";
}
