import { DiscoveryError, type DiscoveryProvider, type RawListing } from "./types";

/**
 * Google Places API (New) — Text Search.
 * https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * Note: Google's terms restrict long-term caching of most Places content and require
 * attribution. Results are cached briefly (see lib/discovery/index.ts) and the UI shows
 * the source for each listing.
 */
export class GooglePlacesProvider implements DiscoveryProvider {
  readonly id = "google_places" as const;
  readonly label = "Google Places";

  constructor(private apiKey: string, private fetchImpl: typeof fetch = fetch) {}

  async search(query: string, area: string, limit: number): Promise<RawListing[]> {
    const textQuery = `${query} in ${area}`;
    const res = await this.fetchImpl("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.primaryTypeDisplayName,places.googleMapsUri,places.businessStatus",
      },
      body: JSON.stringify({ textQuery, pageSize: Math.min(20, limit) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new DiscoveryError(`Google Places request failed (${res.status}).`, res.status);
    const data = (await res.json()) as {
      places?: {
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        websiteUri?: string;
        nationalPhoneNumber?: string;
        primaryTypeDisplayName?: { text?: string };
        googleMapsUri?: string;
        businessStatus?: string;
      }[];
    };
    return (data.places ?? [])
      .filter((p) => p.displayName?.text && p.businessStatus !== "CLOSED_PERMANENTLY")
      .slice(0, limit)
      .map((p) => ({
        name: p.displayName!.text!,
        website: p.websiteUri ?? null,
        address: p.formattedAddress ?? null,
        phone: p.nationalPhoneNumber ?? null,
        categoryLabel: p.primaryTypeDisplayName?.text ?? null,
        sourceUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
        snippet: null,
        origin: "google_places" as const,
        query: textQuery,
      }));
  }
}
