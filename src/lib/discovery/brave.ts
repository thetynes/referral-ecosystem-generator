import { DiscoveryError, type DiscoveryProvider, type RawListing } from "./types";

/** Directory, social and marketplace domains — not the organisation's own website. */
export const NON_BUSINESS_DOMAINS = [
  "yelp.", "yellowpages.", "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com", "wikipedia.org",
  "indeed.", "glassdoor.", "bbb.org", "homestars.com", "houzz.", "angi.com", "thumbtack.com", "reddit.com",
  "youtube.com", "tiktok.com", "clutch.co", "mapquest.com", "google.com", "bing.com", "tripadvisor.", "kijiji.",
  "craigslist.", "manta.com", "zoominfo.com", "crunchbase.com", "411.ca", "canpages.ca", "pinterest.",
];

export function isNonBusinessDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return NON_BUSINESS_DOMAINS.some((d) => host.includes(d));
  } catch {
    return true;
  }
}

/** Best-effort organisation name from a page title ("Acme Plumbing | Toronto Drain Experts" → "Acme Plumbing"). */
export function nameFromTitle(title: string): string {
  const cleaned = title.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").trim();
  const parts = cleaned.split(/\s[|–—-]\s|\s·\s|:\s/).map((p) => p.trim()).filter(Boolean);
  const candidate = parts.find((p) => !/^(home|welcome|about us|contact)$/i.test(p)) ?? cleaned;
  return candidate.slice(0, 120);
}

/**
 * Brave Search API (web results).
 * https://api-dashboard.search.brave.com/app/documentation/web-search/get-started
 * Web results are weaker evidence than a business listing: names are inferred from
 * page titles, and only the URL itself is treated as verified.
 */
export class BraveSearchProvider implements DiscoveryProvider {
  readonly id = "brave_search" as const;
  readonly label = "Brave Search";

  constructor(private apiKey: string, private fetchImpl: typeof fetch = fetch) {}

  async search(query: string, area: string, limit: number): Promise<RawListing[]> {
    const q = `${query} ${area}`;
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", q);
    url.searchParams.set("count", String(Math.min(20, limit * 2)));
    const res = await this.fetchImpl(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": this.apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new DiscoveryError(`Brave Search request failed (${res.status}).`, res.status);
    const data = (await res.json()) as { web?: { results?: { title?: string; url?: string; description?: string }[] } };
    return (data.web?.results ?? [])
      .filter((r) => r.url && r.title && !isNonBusinessDomain(r.url))
      .slice(0, limit)
      .map((r) => ({
        name: nameFromTitle(r.title!),
        website: new URL(r.url!).origin,
        address: null,
        phone: null,
        categoryLabel: null,
        sourceUrl: r.url!,
        snippet: r.description ? r.description.replace(/<[^>]+>/g, "").slice(0, 300) : null,
        origin: "brave_search" as const,
        query: q,
      }));
  }
}
