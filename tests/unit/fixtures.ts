import type { BusinessInput } from "@/lib/schema";

const base = { website: "", projectValue: "", targetIndustries: "", growthPriority: "" as const, existingReferrals: "", expansionMarkets: "" };

export const EXCAVATION: BusinessInput = {
  ...base,
  businessName: "Test Excavating",
  industry: "Excavation contractor",
  serviceArea: "Sarnia, Ontario",
  idealCustomer: "Homeowners, property managers, general contractors, builders, and commercial property owners",
  services: "Excavation, grading, drainage, demolition, foundation-related work",
};

export const IMMIGRATION: BusinessInput = {
  ...base,
  businessName: "Test Immigration Law",
  industry: "Immigration law firm",
  serviceArea: "Toronto, Ontario",
  idealCustomer: "Individuals, families, businesses, educational institutions, and foreign nationals",
  services: "Immigration legal services",
};

export const APP_AGENCY: BusinessInput = {
  ...base,
  businessName: "Test App Studio",
  industry: "Mobile app development agency",
  serviceArea: "Fort Lauderdale, Florida",
  idealCustomer: "Companies requiring custom software and mobile applications",
  services: "iOS and Android apps, custom software, web applications",
};

export const UNKNOWN: BusinessInput = {
  ...base,
  businessName: "Quirky Co",
  industry: "Artisanal beekeeping supplies",
  serviceArea: "Portland",
  idealCustomer: "Hobby beekeepers",
  services: "",
};
