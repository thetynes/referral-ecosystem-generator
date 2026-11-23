import { describe, expect, it } from "vitest";
import { normalizeInput, detectGeography, splitList } from "@/lib/engine/normalize";
import { runKnowledgeBase } from "@/lib/engine/kb-engine";
import { rankCategories, scoreCategory, explainScore, WEIGHT_PRESETS, priorityBand, presetForGrowthPriority } from "@/lib/scoring";
import { layoutEcosystem, NODE_SIZES } from "@/lib/graph-layout";
import { selectFreeCategories, toView } from "@/lib/access";
import { TYPE_ORDER } from "@/lib/ui-meta";
import { executiveOverview, actionPlan, ecosystemFlow } from "@/lib/narrative";
import { getDemoAnalysis } from "@/lib/demo";
import type { RelationshipType } from "@/lib/schema";
import { EXCAVATION, IMMIGRATION } from "./fixtures";

const cats = (input = EXCAVATION) => runKnowledgeBase(normalizeInput(input)).categories;

describe("normalisation", () => {
  it("detects geography", () => {
    expect(detectGeography("Sarnia, Ontario")).toMatchObject({ country: "CA", region: "Ontario", scope: "local" });
    expect(detectGeography("Fort Lauderdale, Florida")).toMatchObject({ country: "US", region: "Florida" });
    expect(detectGeography("Remote, United States").scope).toBe("remote");
    expect(detectGeography("Nationwide across Canada")).toMatchObject({ country: "CA", scope: "national" });
    expect(detectGeography("Atlantis").country).toBe("UNKNOWN");
  });
  it("splits lists and dedupes", () => {
    expect(splitList("Excavation, grading; drainage\ngrading")).toEqual(["Excavation", "grading", "drainage"]);
  });
  it("derives a display name from a website", () => {
    expect(normalizeInput({ ...EXCAVATION, businessName: "", website: "www.acme-dig.ca" }).displayName).toBe("acme-dig.ca");
  });
});

describe("scoring", () => {
  it("normalises to 0-100 and is monotonic in ratings", () => {
    const c = cats()[0];
    const all5 = { ...c, criteria: Object.fromEntries(Object.entries(c.criteria).map(([k, v]) => [k, { ...v, score: 5 }])) };
    const all1 = { ...c, criteria: Object.fromEntries(Object.entries(c.criteria).map(([k, v]) => [k, { ...v, score: 1 }])) };
    expect(scoreCategory(all5 as typeof c)).toBe(100);
    expect(scoreCategory(all1 as typeof c)).toBe(0);
  });
  it("re-ranks when weights change", () => {
    const list = cats();
    const a = rankCategories(list, WEIGHT_PRESETS.quick_wins.weights).map((c) => c.id);
    const b = rankCategories(list, WEIGHT_PRESETS.high_value.weights).map((c) => c.id);
    expect(a).not.toEqual(b);
  });
  it("explains contributions that sum to the score (±rounding)", () => {
    const c = cats()[0];
    const total = explainScore(c).reduce((s, x) => s + x.contribution, 0);
    expect(Math.abs(total - scoreCategory(c))).toBeLessThanOrEqual(5);
  });
  it("bands priorities", () => {
    expect(priorityBand(70)).toBe("High");
    expect(priorityBand(52)).toBe("Medium");
    expect(priorityBand(51)).toBe("Low");
    expect(presetForGrowthPriority("recurring")).toBe("recurring");
  });
});

describe("graph layout", () => {
  it("places every visible category without overlapping nodes", () => {
    for (const input of [EXCAVATION, IMMIGRATION]) {
      const ranked = rankCategories(cats(input));
      const { nodes, edges } = layoutEcosystem(ranked, { visibleTypes: new Set(TYPE_ORDER), collapsed: new Set() });
      expect(nodes.filter((n) => n.kind === "partner")).toHaveLength(ranked.length);
      expect(edges.filter((e) => e.kind === "relationship")).toHaveLength(ranked.length);
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const sa = NODE_SIZES[a.kind], sb = NODE_SIZES[b.kind];
          const overlap = a.x < b.x + sb.w && b.x < a.x + sa.w && a.y < b.y + sb.h && b.y < a.y + sa.h;
          expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
        }
    }
  });
  it("collapses and filters groups", () => {
    const ranked = rankCategories(cats());
    const collapsed = layoutEcosystem(ranked, { visibleTypes: new Set(TYPE_ORDER), collapsed: new Set<RelationshipType>(["upstream"]) });
    expect(collapsed.nodes.some((n) => n.kind === "partner" && n.type === "upstream")).toBe(false);
    expect(collapsed.nodes.find((n) => n.id === "hub-upstream")?.collapsed).toBe(true);
    const filtered = layoutEcosystem(ranked, { visibleTypes: new Set<RelationshipType>(["downstream"]), collapsed: new Set() });
    expect(filtered.nodes.every((n) => n.kind === "center" || n.type === "downstream")).toBe(true);
  });
  it("encodes referral direction on edges", () => {
    const ranked = rankCategories(cats());
    const { edges } = layoutEcosystem(ranked, { visibleTypes: new Set(TYPE_ORDER), collapsed: new Set() });
    const inbound = edges.find((e) => e.categoryId === "property-managers")!;
    expect(inbound.source).toBe("cat-property-managers");
    expect(edges.find((e) => e.categoryId === "waterproofing")!.direction).toBe("reciprocal");
  });
});

describe("free tier access", () => {
  const analysis = { ...getDemoAnalysis(), isDemo: false, id: "00000000-0000-0000-0000-000000000000" };
  it("limits categories, always includes an upstream source, and reports the locked count honestly", () => {
    const v = toView(analysis, null, 5);
    expect(v.categories).toHaveLength(5);
    expect(v.access.lockedCategoryCount).toBe(analysis.categories.length - 5);
    expect(v.categories.some((c) => c.relationshipType === "upstream")).toBe(true);
    const perType = new Map<string, number>();
    v.categories.forEach((c) => perType.set(c.relationshipType, (perType.get(c.relationshipType) ?? 0) + 1));
    expect(Math.max(...perType.values())).toBeLessThanOrEqual(2);
  });
  it("returns everything with an entitlement", () => {
    const v = toView(analysis, { analysisId: analysis.id, tier: "basic", exp: 9e9 }, 5);
    expect(v.categories).toHaveLength(analysis.categories.length);
    expect(v.access.tier).toBe("basic");
  });
  it("selectFreeCategories fills to the limit", () => {
    expect(selectFreeCategories(rankCategories(analysis.categories), 8)).toHaveLength(8);
  });
});

describe("narrative", () => {
  it("builds overview, flow and a top-10 plan only from analysis data", () => {
    const a = getDemoAnalysis();
    const ranked = rankCategories(a.categories);
    expect(executiveOverview(a, ranked)[0]).toContain(a.profile.displayName);
    expect(ecosystemFlow(ranked).length).toBeGreaterThanOrEqual(4);
    const plan = actionPlan(ranked);
    expect(plan).toHaveLength(10);
    expect(plan[0].rank).toBe(1);
  });
  it("demo dataset is flagged as illustrative", () => {
    const a = getDemoAnalysis();
    expect(a.isDemo).toBe(true);
    expect(a.engine.mode).toBe("demo");
    expect(a.profile.displayName).toMatch(/illustrative/i);
  });
});
it("rates a clear specialised description as a high-confidence match", async () => { const { matchArchetype } = await import("@/lib/knowledge"); expect(matchArchetype({ industry: "Immigration law firm", services: "Immigration legal services" }).confidence).toBe("high"); });
