import { describe, expect, it, beforeEach } from "vitest";
import { generateAnalysis } from "@/lib/engine";
import { setLLMProviderForTesting } from "@/lib/llm";
import { MemoryStore, setStoreForTesting } from "@/lib/store";
import { matchArchetype } from "@/lib/knowledge";
import { rankCategories } from "@/lib/scoring";
import { RELATIONSHIP_TYPES } from "@/lib/schema";
import { APP_AGENCY, EXCAVATION, IMMIGRATION, UNKNOWN } from "./fixtures";

beforeEach(() => {
  setLLMProviderForTesting(null); // knowledge-base mode
  setStoreForTesting(new MemoryStore());
});

const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a.map((s) => s.toLowerCase()));
  const B = new Set(b.map((s) => s.toLowerCase()));
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / new Set([...A, ...B]).size;
};

describe("archetype matching", () => {
  it("matches the three acceptance examples to distinct profiles", () => {
    expect(matchArchetype({ industry: EXCAVATION.industry, services: EXCAVATION.services }).archetype.id).toBe("site-construction");
    expect(matchArchetype({ industry: IMMIGRATION.industry, services: IMMIGRATION.services }).archetype.id).toBe("immigration-law");
    expect(matchArchetype({ industry: APP_AGENCY.industry, services: APP_AGENCY.services }).archetype.id).toBe("software-agency");
  });

  it("falls back to the generic framework with low confidence for unknown industries", () => {
    const m = matchArchetype({ industry: UNKNOWN.industry });
    expect(m.archetype.id).toBe("generic");
    expect(m.confidence).toBe("low");
  });

  it("prefers specialised legal profiles over the general one", () => {
    expect(matchArchetype({ industry: "Immigration legal services" }).archetype.id).toBe("immigration-law");
    expect(matchArchetype({ industry: "Family law firm" }).archetype.id).toBe("family-law");
    expect(matchArchetype({ industry: "Estate planning law firm" }).archetype.id).toBe("legal-general");
  });
});

describe("acceptance examples (knowledge-base mode)", () => {
  it("produces materially different ecosystems", async () => {
    const [a, b, c] = await Promise.all([generateAnalysis(EXCAVATION), generateAnalysis(IMMIGRATION), generateAnalysis(APP_AGENCY)]);
    const names = [a, b, c].map((x) => x.categories.map((cat) => cat.name));
    expect(jaccard(names[0], names[1])).toBeLessThan(0.15);
    expect(jaccard(names[0], names[2])).toBeLessThan(0.15);
    expect(jaccard(names[1], names[2])).toBeLessThan(0.15);
    for (const x of [a, b, c]) {
      expect(x.categories.length).toBeGreaterThanOrEqual(10);
      expect(x.engine.mode).toBe("knowledge_base");
      const types = new Set(x.categories.map((cat) => cat.relationshipType));
      expect(types.size).toBeGreaterThanOrEqual(4);
      for (const cat of x.categories) {
        expect(cat.triggers.length).toBeGreaterThan(0);
        expect(Object.keys(cat.criteria).length).toBe(9);
        for (const r of Object.values(cat.criteria)) expect(r.basis).toBe("inferred");
      }
    }
  });

  it("excavation: identifies upstream sources, trigger events and recurring commercial channels", async () => {
    const a = await generateAnalysis(EXCAVATION);
    const ids = a.categories.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["custom-home-builders", "general-contractors", "property-managers", "plumbers-drain", "civil-geotech-engineers"]));
    expect(a.categories.filter((c) => c.relationshipType === "upstream").length).toBeGreaterThanOrEqual(3);
    expect(a.categories.filter((c) => c.channelType === "recurring").length).toBeGreaterThanOrEqual(3);
    expect(a.guardrails.some((g) => /CASL/.test(g.title))).toBe(true);
    // septic requires a rural/septic keyword that this input lacks
    expect(ids).not.toContain("septic-designers");
  });

  it("immigration law: recognises regulatory constraints on referrals", async () => {
    const b = await generateAnalysis(IMMIGRATION);
    expect(b.guardrails.some((g) => /Referral compensation/.test(g.title))).toBe(true);
    const ids = b.categories.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["criminal-defence", "family-lawyers", "universities-colleges", "employers-hr", "rcic-consultants"]));
    expect(b.categories.filter((c) => c.regulatoryNote).length).toBeGreaterThanOrEqual(4);
  });

  it("app agency: identifies consultant, agency, design and IT channels; US outreach rules", async () => {
    const c = await generateAnalysis(APP_AGENCY);
    const ids = c.categories.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(["business-consultants", "marketing-agencies", "ux-design-studios", "msp-it"]));
    expect(c.profile.geography.country).toBe("US");
    expect(c.guardrails.some((g) => /CAN-SPAM/.test(g.title))).toBe(true);
    expect(ids).not.toContain("rcic-consultants");
  });

  it("handles an unknown industry gracefully with a low-confidence note", async () => {
    const u = await generateAnalysis(UNKNOWN);
    expect(u.engine.archetypeId).toBe("generic");
    expect(u.engine.matchConfidence).toBe("low");
    expect(u.engine.notes.join(" ")).toMatch(/did not closely match/);
    expect(u.categories.length).toBeGreaterThan(4);
  });

  it("flags existing relationships the user already has", async () => {
    const a = await generateAnalysis({ ...EXCAVATION, existingReferrals: "Two local home builders, one plumber" });
    expect(a.categories.find((c) => c.id === "custom-home-builders")?.existingRelationship).toBe(true);
    expect(a.categories.find((c) => c.id === "plumbers-drain")?.existingRelationship).toBe(true);
    expect(a.categories.find((c) => c.id === "general-contractors")?.existingRelationship).toBe(false);
  });

  it("boosts relevance from service keywords and lowers local fit for national businesses", async () => {
    const local = await generateAnalysis(APP_AGENCY);
    const national = await generateAnalysis({ ...APP_AGENCY, serviceArea: "Remote, United States" });
    const cw = (x: typeof local) => x.categories.find((c) => c.id === "coworking-meetups")!.criteria.geographicRelevance.score;
    expect(cw(national)).toBeLessThan(cw(local));
  });

  it("ranks categories with a deterministic, explainable score", async () => {
    const a = await generateAnalysis(EXCAVATION);
    const ranked = rankCategories(a.categories);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].score);
    for (const r of ranked) expect(r.score).toBeGreaterThanOrEqual(0);
    expect(ranked.every((r) => ["High", "Medium", "Low"].includes(r.priority))).toBe(true);
  });

  it("covers every relationship type across the curated profiles", async () => {
    const all = await Promise.all([EXCAVATION, IMMIGRATION, APP_AGENCY].map((i) => generateAnalysis(i)));
    const types = new Set(all.flatMap((x) => x.categories.map((c) => c.relationshipType)));
    for (const t of RELATIONSHIP_TYPES) expect(types.has(t)).toBe(true);
  });
});
