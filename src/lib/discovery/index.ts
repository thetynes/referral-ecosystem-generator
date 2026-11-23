/**
 * Stage 5 — research real organisations through permitted, official APIs.
 * No scraping. If no provider is configured, discovery is unavailable (never simulated).
 */
import { config } from "../config";
import type { BusinessProfile, Organization, PartnerCategory } from "../schema";
import { BraveSearchProvider } from "./brave";
import { GooglePlacesProvider } from "./google-places";
import { DiscoveryError, type DiscoveryProvider } from "./types";
import { dedupeOrganizations, listingToOrganization } from "./verify";

export { DiscoveryError };

let override: DiscoveryProvider | null | undefined;
export function setDiscoveryProviderForTesting(p: DiscoveryProvider | null | undefined) {
  override = p;
}

export function getDiscoveryProvider(): DiscoveryProvider | null {
  if (override !== undefined) return override;
  const { discovery } = config();
  if (discovery.provider === "google_places" && discovery.googleKey) return new GooglePlacesProvider(discovery.googleKey);
  if (discovery.provider === "brave" && discovery.braveKey) return new BraveSearchProvider(discovery.braveKey);
  return null;
}

/** Choose a search area string appropriate to the business's geographic scope. */
export function searchArea(profile: BusinessProfile): string {
  return profile.serviceArea;
}

export interface DiscoveryRun {
  organizations: Organization[];
  errors: { categoryId: string; message: string }[];
  provider: string;
  researchedAt: string;
}

export async function discoverOrganizations(
  provider: DiscoveryProvider,
  profile: BusinessProfile,
  categories: PartnerCategory[],
  perCategory: number,
): Promise<DiscoveryRun> {
  const researchedAt = new Date().toISOString();
  const area = searchArea(profile);
  const errors: DiscoveryRun["errors"] = [];
  const all: Organization[] = [];

  // Sequential per category to stay within provider rate limits.
  for (const category of categories) {
    const queries = category.searchQueries.length ? category.searchQueries.slice(0, 2) : [category.name];
    try {
      for (const q of queries) {
        const listings = await provider.search(q, area, perCategory);
        all.push(...listings.map((l) => listingToOrganization(l, category, researchedAt)));
        if (all.filter((o) => o.categoryId === category.id).length >= perCategory) break;
      }
    } catch (err) {
      errors.push({ categoryId: category.id, message: err instanceof Error ? err.message : "Search failed." });
    }
  }

  const deduped = dedupeOrganizations(all, profile);
  const counts = new Map<string, number>();
  const limited = deduped.filter((o) => {
    const n = counts.get(o.categoryId) ?? 0;
    if (n >= perCategory) return false;
    counts.set(o.categoryId, n + 1);
    return true;
  });
  return { organizations: limited, errors, provider: provider.label, researchedAt };
}
