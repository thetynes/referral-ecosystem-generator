/**
 * Stage 1 — normalise and validate business information (deterministic, no external calls).
 */
import type { BusinessInput, BusinessProfile } from "../schema";

const CA_REGIONS: Record<string, string> = {
  ontario: "Ontario", " on": "Ontario", quebec: "Québec", québec: "Québec", " qc": "Québec",
  "british columbia": "British Columbia", " bc": "British Columbia", alberta: "Alberta", " ab": "Alberta",
  manitoba: "Manitoba", " mb": "Manitoba", saskatchewan: "Saskatchewan", " sk": "Saskatchewan",
  "nova scotia": "Nova Scotia", " ns": "Nova Scotia", "new brunswick": "New Brunswick", " nb": "New Brunswick",
  newfoundland: "Newfoundland and Labrador", " nl": "Newfoundland and Labrador",
  "prince edward island": "Prince Edward Island", " pei": "Prince Edward Island",
};
const CA_CITIES = ["toronto", "sarnia", "ottawa", "vancouver", "montreal", "calgary", "edmonton", "winnipeg", "halifax", "hamilton", "london, on", "kitchener", "mississauga", "windsor", "victoria", "regina", "saskatoon", "canada", "gta"];

const US_STATES: Record<string, string> = {
  alabama: "Alabama", alaska: "Alaska", arizona: "Arizona", arkansas: "Arkansas", california: "California",
  colorado: "Colorado", connecticut: "Connecticut", delaware: "Delaware", florida: "Florida", " fl": "Florida",
  georgia: "Georgia", hawaii: "Hawaii", idaho: "Idaho", illinois: "Illinois", indiana: "Indiana", iowa: "Iowa",
  kansas: "Kansas", kentucky: "Kentucky", louisiana: "Louisiana", maine: "Maine", maryland: "Maryland",
  massachusetts: "Massachusetts", michigan: "Michigan", minnesota: "Minnesota", mississippi: "Mississippi",
  missouri: "Missouri", montana: "Montana", nebraska: "Nebraska", nevada: "Nevada", "new hampshire": "New Hampshire",
  "new jersey": "New Jersey", "new mexico": "New Mexico", "new york": "New York", " ny": "New York",
  "north carolina": "North Carolina", "north dakota": "North Dakota", ohio: "Ohio", oklahoma: "Oklahoma",
  oregon: "Oregon", pennsylvania: "Pennsylvania", "rhode island": "Rhode Island", "south carolina": "South Carolina",
  "south dakota": "South Dakota", tennessee: "Tennessee", texas: "Texas", " tx": "Texas", utah: "Utah",
  vermont: "Vermont", virginia: "Virginia", washington: "Washington", "west virginia": "West Virginia",
  wisconsin: "Wisconsin", wyoming: "Wyoming", " ca,": "California",
};
const US_MARKERS = ["usa", "united states", "u.s.", "miami", "fort lauderdale", "chicago", "los angeles", "new york city", "houston", "dallas", "atlanta", "boston", "seattle", "denver", "phoenix"];

const REMOTE_MARKERS = ["remote", "online", "virtual", "worldwide", "global", "international"];
const NATIONAL_MARKERS = ["nationwide", "national", "across canada", "across the us", "united states", "north america", "all of canada", "coast to coast"];
const REGIONAL_MARKERS = ["region", "county", "province-wide", "statewide", "state-wide", "southern", "northern", "western", "eastern", "area", "gta", "metro", "greater"];

export function splitList(value: string | undefined | null): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(/[,;\n•|]+|\s+and\s+/i)
        .map((s) => s.trim().replace(/^[-*]\s*/, ""))
        .filter((s) => s.length > 1 && s.length < 120),
    ),
  ).slice(0, 20);
}

export function detectGeography(area: string): BusinessProfile["geography"] {
  const text = ` ${area.toLowerCase()} `;
  let country: BusinessProfile["geography"]["country"] = "UNKNOWN";
  let region: string | null = null;

  for (const [key, name] of Object.entries(CA_REGIONS)) {
    if (text.includes(key.startsWith(" ") ? `${key} ` : key) || text.includes(`${key.trim()},`)) {
      country = "CA";
      region = name;
      break;
    }
  }
  if (country === "UNKNOWN" && CA_CITIES.some((c) => text.includes(c))) country = "CA";
  if (country === "UNKNOWN") {
    for (const [key, name] of Object.entries(US_STATES)) {
      if (key.startsWith(" ") ? text.includes(`${key} `) || text.includes(`${key.trim()},`) || text.endsWith(`${key} `) : text.includes(key)) {
        country = "US";
        region = name;
        break;
      }
    }
  }
  if (country === "UNKNOWN" && US_MARKERS.some((m) => text.includes(m))) country = "US";
  if (country === "UNKNOWN" && /\b(uk|united kingdom|australia|germany|india|ireland|new zealand|singapore|uae)\b/.test(text)) country = "OTHER";

  let scope: BusinessProfile["geography"]["scope"] = "local";
  if (REMOTE_MARKERS.some((m) => text.includes(m))) scope = "remote";
  else if (NATIONAL_MARKERS.some((m) => text.includes(m))) scope = "national";
  else if (REGIONAL_MARKERS.some((m) => text.includes(m))) scope = "regional";

  return { country, region, scope };
}

export function displayNameFrom(input: Pick<BusinessInput, "businessName" | "website">): string {
  if (input.businessName.trim()) return input.businessName.trim();
  try {
    const url = new URL(/^https?:\/\//i.test(input.website) ? input.website : `https://${input.website}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return input.website || "Your business";
  }
}

export function normalizeWebsite(website: string): string | null {
  if (!website.trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeInput(input: BusinessInput): BusinessProfile {
  return {
    displayName: displayNameFrom(input),
    website: normalizeWebsite(input.website),
    industry: input.industry.trim(),
    services: splitList(input.services),
    serviceArea: input.serviceArea.trim(),
    geography: detectGeography(input.serviceArea),
    idealCustomer: input.idealCustomer.trim(),
    customerSegments: splitList(input.idealCustomer),
    projectValue: input.projectValue.trim() || null,
    targetIndustries: splitList(input.targetIndustries),
    growthPriority: input.growthPriority || null,
    existingReferrals: splitList(input.existingReferrals),
    expansionMarkets: splitList(input.expansionMarkets),
  };
}

/** All free text about the business, lower-cased, for keyword checks. */
export function profileText(p: BusinessProfile): string {
  return [p.displayName, p.industry, p.services.join(" "), p.idealCustomer, p.serviceArea, p.targetIndustries.join(" ")]
    .join(" ")
    .toLowerCase();
}
