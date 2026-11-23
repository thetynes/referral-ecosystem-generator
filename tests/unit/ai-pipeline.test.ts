import { describe, expect, it, beforeEach } from "vitest";
import { generateAnalysis } from "@/lib/engine";
import { LLMError, setLLMProviderForTesting, type LLMProvider, type GenerateObjectOptions } from "@/lib/llm";
import { MemoryStore, setStoreForTesting } from "@/lib/store";
import { CRITERIA } from "@/lib/schema";
import { APP_AGENCY } from "./fixtures";

const rating = (score: number) => ({ score, rationale: "Because." });

class MockProvider implements LLMProvider {
  readonly name = "mock" as const;
  readonly model = "mock-1";
  prompts: string[] = [];
  calls = 0;
  constructor(private failStage3 = false) {}
  async generateObject<T>(opts: GenerateObjectOptions<T>): Promise<T> {
    this.calls++;
    this.prompts.push(opts.prompt);
    if (opts.schemaName === "partner_candidates") {
      const types = ["upstream", "upstream", "upstream", "complementary", "complementary", "downstream", "shared_audience", "distribution"] as const;
      return opts.schema.parse({
        customerJourney: ["Idea", "Scoping", "Build", "Launch", "Growth"],
        candidates: types.map((t, i) => ({ name: `Partner ${i}`, relationshipType: t, direction: "inbound", channelType: i % 2 ? "recurring" : "occasional", whyRelevant: "x" })),
      });
    }
    if (this.failStage3) throw new LLMError("boom", "provider_error", false);
    const names = [...opts.prompt.matchAll(/^- (Partner \d+) \[/gm)].map((m) => m[1]);
    return opts.schema.parse({
      categories: names.map((name) => ({
        name,
        opportunity: "They meet the customer early.",
        rationale: "Makes sense.",
        triggers: [{ event: "Funding closes", whyNeed: "Budget", whoRecognizes: "Investor", referralMoment: "Right after", partnerValue: "Portfolio success" }],
        mutualValue: "Both win.",
        approach: "Offer office hours.",
        collaborationFormats: ["Workshop"],
        digitalAuthority: [],
        regulatoryNote: "",
        criteria: Object.fromEntries(CRITERIA.map((k) => [k, rating(9)])),
        searchQueries: ["accelerator"],
      })),
    });
  }
}

beforeEach(() => setStoreForTesting(new MemoryStore()));

describe("AI pipeline", () => {
  it("runs staged generation, clamps ratings, and labels everything inferred", async () => {
    const p = new MockProvider();
    setLLMProviderForTesting(p);
    const a = await generateAnalysis({ ...APP_AGENCY, existingReferrals: "Partner 3 folks" });
    expect(a.engine.mode).toBe("ai");
    expect(a.engine.provider).toBe("mock");
    expect(a.categories).toHaveLength(8);
    expect(p.calls).toBe(3); // 1 candidates + 2 analysis batches
    for (const c of a.categories) for (const r of Object.values(c.criteria)) {
      expect(r.score).toBe(5);
      expect(r.basis).toBe("inferred");
    }
    expect(a.categories.find((c) => c.name === "Partner 3")?.existingRelationship).toBe(true);
    expect(a.assumptions[0]).toMatch(/Customer journey/);
  });

  it("never sends the business name, website or named partners to the provider", async () => {
    const p = new MockProvider();
    setLLMProviderForTesting(p);
    await generateAnalysis({ ...APP_AGENCY, businessName: "SecretCo", website: "secretco.example", existingReferrals: "Jane at BigBank" });
    const all = p.prompts.join("\n");
    expect(all).not.toContain("SecretCo");
    expect(all).not.toContain("secretco.example");
    expect(all).not.toContain("BigBank");
    expect(all).toContain("<business_description>");
  });

  it("caches identical requests", async () => {
    const p = new MockProvider();
    setLLMProviderForTesting(p);
    await generateAnalysis(APP_AGENCY);
    const before = p.calls;
    const second = await generateAnalysis({ ...APP_AGENCY, businessName: "Other name" });
    expect(p.calls).toBe(before);
    expect(second.engine.notes.join(" ")).toMatch(/cache/i);
  });

  it("falls back to the knowledge base, with a visible note, when the AI fails", async () => {
    setLLMProviderForTesting(new MockProvider(true));
    const a = await generateAnalysis(APP_AGENCY);
    expect(a.engine.mode).toBe("knowledge_base");
    expect(a.engine.notes.join(" ")).toMatch(/knowledge-base analysis instead/);
    expect(a.categories.length).toBeGreaterThan(5);
  });
});
