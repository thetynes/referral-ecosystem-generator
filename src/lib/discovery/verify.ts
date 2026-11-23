/**
 * Stage 6 — verify and structure discovered organisations.
 *
 * Field status is assigned strictly from where each value came from. Nothing is filled
 * in by inference except the strategic fields, which are labelled as such in the UI.
 */
import { createHash } from "node:crypto";
import type { BusinessProfile, FieldStatus, Organization, PartnerCategory, ProvenancedField } from "../schema";
import type { RawListing } from "./types";

const field = (value: string | null, status: FieldStatus, source: string | null): ProvenancedField =>
  value ? { value, status, source } : { value: null, status: "unknown", source: null };

export function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

const WEIGHT: Record<FieldStatus, number> = { verified: 1, user_provided: 0.6, inferred: 0.5, unknown: 0 };

export function completeness(org: Pick<Organization, "name" | "website" | "location" | "businessCategory" | "services" | "contactChannel">): number {
  const fields = [org.name, org.website, org.location, org.businessCategory, org.services, org.contactChannel];
  return Math.round((fields.reduce((s, f) => s + WEIGHT[f.status], 0) / fields.length) * 100);
}

const TYPE_LABEL: Record<PartnerCategory["relationshipType"], string> = {
  upstream: "Upstream referral source",
  complementary: "Complementary service provider",
  downstream: "Downstream relationship",
  shared_audience: "Shared-audience partner",
  distribution: "Commercial distribution channel",
};

export function relationshipLabel(c: PartnerCategory) {
  return `${TYPE_LABEL[c.relationshipType]}${c.channelType === "recurring" ? " (potential recurring channel)" : ""}`;
}

function firstSentence(s: string) {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

export function listingToOrganization(listing: RawListing, category: PartnerCategory, researchedAt: string): Organization {
  const isPlaces = listing.origin === "google_places";
  const src = listing.sourceUrl;
  const contact = listing.phone ?? listing.website;
  const base = {
    name: field(listing.name, isPlaces ? "verified" : "inferred", src),
    website: field(listing.website, "verified", isPlaces ? src : listing.website),
    location: field(listing.address, isPlaces ? "verified" : "inferred", src),
    businessCategory: field(listing.categoryLabel, isPlaces ? "verified" : "inferred", src),
    services: field(null, "unknown", null),
    contactChannel: field(contact, "verified", src),
  };
  const id = createHash("sha256").update(`${category.id}|${domainOf(listing.website) ?? listing.name.toLowerCase()}`).digest("hex").slice(0, 16);
  return {
    id,
    categoryId: category.id,
    ...base,
    inclusionReason: `Returned by ${isPlaces ? "Google Places" : "Brave Search"} for “${listing.query}”. Included as a candidate for the “${category.name}” partner category${listing.snippet ? `. Source snippet: “${listing.snippet}”` : ""}.`,
    referralRelationship: `${relationshipLabel(category)}: ${firstSentence(category.opportunity)}`,
    partnershipOpportunity: category.approach,
    sourceUrls: Array.from(new Set([src, listing.website].filter((u): u is string => Boolean(u)))),
    origin: listing.origin,
    researchedAt,
    verificationStatus: isPlaces ? "verified_listing" : listing.website ? "partially_verified" : "unverified",
    completeness: completeness(base),
  };
}

/** Remove duplicates, the user's own business, and listings without a usable name. */
export function dedupeOrganizations(orgs: Organization[], profile: BusinessProfile): Organization[] {
  const ownDomain = domainOf(profile.website);
  const ownName = profile.displayName.toLowerCase();
  const seen = new Set<string>();
  const out: Organization[] = [];
  for (const o of orgs) {
    const name = (o.name.value ?? "").trim();
    if (name.length < 2) continue;
    const d = domainOf(o.website.value);
    if (ownDomain && d === ownDomain) continue;
    if (name.toLowerCase() === ownName) continue;
    const key = `${o.categoryId}|${d ?? name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}
