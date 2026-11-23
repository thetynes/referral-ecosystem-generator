/**
 * CSV import — an alternative to automated discovery. Runs in the browser or on the server.
 * Imported values are marked "user_provided": they are not independently verified.
 */
import Papa from "papaparse";
import type { Organization, PartnerCategory, ProvenancedField } from "../schema";

export const CSV_TEMPLATE_HEADERS = ["name", "website", "location", "category", "services", "contact", "source_url", "partner_category"];
const MAX_ROWS = 500;

const ALIASES: Record<string, string[]> = {
  name: ["name", "business name", "company", "organization", "organisation", "business"],
  website: ["website", "url", "site", "web"],
  location: ["location", "address", "city", "service area"],
  category: ["category", "business category", "type", "industry"],
  services: ["services", "description", "notes"],
  contact: ["contact", "email", "phone", "contact channel"],
  source_url: ["source_url", "source", "source url", "evidence"],
  partner_category: ["partner_category", "partner category", "ecosystem category", "relationship"],
};

function headerKey(h: string): string | null {
  const n = h.trim().toLowerCase().replace(/_/g, " ");
  for (const [key, aliases] of Object.entries(ALIASES)) {
    if (aliases.some((a) => a.replace(/_/g, " ") === n)) return key;
  }
  return null;
}

const uf = (v: string | undefined, source: string | null): ProvenancedField =>
  v && v.trim() ? { value: v.trim().slice(0, 300), status: "user_provided", source } : { value: null, status: "unknown", source: null };

function safeUrl(v: string | undefined): string | null {
  if (!v || !v.trim()) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`);
    return ["http:", "https:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Neutralise spreadsheet formula injection when values are re-exported. */
export function csvSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function matchCategory(value: string | undefined, categories: PartnerCategory[]): PartnerCategory | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return (
    categories.find((c) => c.id === v || c.name.toLowerCase() === v) ??
    categories.find((c) => c.name.toLowerCase().includes(v) || v.includes(c.name.toLowerCase())) ??
    null
  );
}

export interface CsvImportResult {
  organizations: Organization[];
  errors: string[];
  unmatched: number;
}

export function importOrganizationsCsv(csvText: string, categories: PartnerCategory[], fallbackCategoryId?: string): CsvImportResult {
  const errors: string[] = [];
  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) errors.push(...parsed.errors.slice(0, 5).map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`));
  const fields = parsed.meta.fields ?? [];
  const map = new Map<string, string>();
  for (const f of fields) {
    const k = headerKey(f);
    if (k && !map.has(k)) map.set(k, f);
  }
  if (!map.has("name")) return { organizations: [], errors: ["The CSV needs a 'name' column."], unmatched: 0 };

  const now = new Date().toISOString();
  const orgs: Organization[] = [];
  let unmatched = 0;
  parsed.data.slice(0, MAX_ROWS).forEach((row, i) => {
    const get = (k: string) => (map.has(k) ? row[map.get(k)!] : undefined);
    const name = get("name")?.trim();
    if (!name) return;
    const cat = matchCategory(get("partner_category"), categories) ?? categories.find((c) => c.id === fallbackCategoryId) ?? null;
    if (!cat) {
      unmatched++;
      return;
    }
    const website = safeUrl(get("website"));
    const source = safeUrl(get("source_url"));
    const base = {
      name: uf(name, source),
      website: website ? { value: website, status: "user_provided" as const, source } : uf(undefined, null),
      location: uf(get("location"), source),
      businessCategory: uf(get("category"), source),
      services: uf(get("services"), source),
      contactChannel: uf(get("contact"), source),
    };
    const filled = Object.values(base).filter((f) => f.status !== "unknown").length;
    orgs.push({
      id: `csv-${i}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`,
      categoryId: cat.id,
      ...base,
      inclusionReason: "Imported from your CSV list.",
      referralRelationship: `Assigned to “${cat.name}”.`,
      partnershipOpportunity: cat.approach,
      sourceUrls: [source, website].filter((u): u is string => Boolean(u)),
      origin: "csv_import",
      researchedAt: now,
      verificationStatus: "unverified",
      completeness: Math.round((filled / 6) * 60),
    });
  });
  if (parsed.data.length > MAX_ROWS) errors.push(`Only the first ${MAX_ROWS} rows were imported.`);
  return { organizations: orgs, errors, unmatched };
}
