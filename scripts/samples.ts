import type { BusinessInput } from "@/lib/schema";

const base = { website: "", projectValue: "", targetIndustries: "", growthPriority: "" as const, existingReferrals: "", expansionMarkets: "" };

/** Beta validation samples. All businesses are hypothetical; no real organisations are named. */
export const SAMPLES: { slug: string; input: BusinessInput }[] = [
  {
    slug: "excavation-waterproofing-sarnia",
    input: {
      ...base,
      businessName: "Sample Excavation & Waterproofing (illustrative)",
      industry: "Excavation and basement waterproofing contractor",
      serviceArea: "Sarnia, Ontario and Lambton County",
      idealCustomer: "Homeowners with wet basements, custom home builders, property managers, commercial property owners",
      services: "Excavation, exterior foundation waterproofing, weeping tile replacement, drainage and grading, demolition",
      growthPriority: "recurring",
    },
  },
  {
    slug: "immigration-law-toronto",
    input: {
      ...base,
      businessName: "Sample Immigration Law (illustrative)",
      industry: "Immigration law firm",
      serviceArea: "Toronto, Ontario",
      idealCustomer: "Individuals and families, employers hiring foreign workers, international students, foreign nationals",
      services: "Work permits, LMIA, spousal sponsorship, permanent residence, refusals and judicial review, inadmissibility",
    },
  },
  {
    slug: "property-management-swo",
    input: {
      ...base,
      businessName: "Sample Property Management (illustrative)",
      industry: "Residential property management company",
      serviceArea: "London, Kitchener-Waterloo and Southwestern Ontario",
      idealCustomer: "Owners of single-family rentals, small multiplexes, student rentals and secondary suites",
      services: "Tenant placement, rent collection, maintenance coordination, Landlord and Tenant Board filings, owner reporting",
      growthPriority: "recurring",
    },
  },
  {
    slug: "seo-agency-ontario",
    input: {
      ...base,
      businessName: "Sample SEO Agency (illustrative)",
      industry: "SEO and digital marketing agency",
      serviceArea: "Ontario, Canada (clients across Canada)",
      idealCustomer: "Local service businesses, law firms and home-service contractors",
      services: "Local SEO, technical SEO, content, website migrations, Google Business Profile, paid search",
      growthPriority: "higher_value",
    },
  },
  {
    slug: "custom-builder-lambton",
    input: {
      ...base,
      businessName: "Sample Custom Homes (illustrative)",
      industry: "Custom home builder",
      serviceArea: "Lambton County, Ontario",
      idealCustomer: "Families building on their own lot, teardown-rebuild buyers",
      services: "Custom homes, design-build, infill rebuilds",
    },
  },
  {
    slug: "family-law-hamilton",
    input: {
      ...base,
      businessName: "Sample Family Law (illustrative)",
      industry: "Family law firm",
      serviceArea: "Hamilton, Ontario",
      idealCustomer: "Separating spouses and parents",
      services: "Separation agreements, parenting, support, property division, mediation support",
    },
  },
];
