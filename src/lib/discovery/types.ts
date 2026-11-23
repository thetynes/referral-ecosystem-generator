export interface RawListing {
  name: string;
  website: string | null;
  address: string | null;
  phone: string | null;
  categoryLabel: string | null;
  sourceUrl: string;
  snippet: string | null;
  origin: "google_places" | "brave_search";
  query: string;
}

export interface DiscoveryProvider {
  readonly id: "google_places" | "brave_search";
  readonly label: string;
  search(query: string, area: string, limit: number): Promise<RawListing[]>;
}

export class DiscoveryError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "DiscoveryError";
  }
}
