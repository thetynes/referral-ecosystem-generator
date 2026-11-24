import { describe, expect, it, beforeEach } from "vitest";
import { AiUnavailableError, generateAnalysis } from "@/lib/engine";
import { spendSummary } from "@/lib/ai-budget";
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
        decisionMaker: "Programme manager",
        overlooked: name === "Partner 7",
        collaborationFormats: ["Workshop"],
        digitalAuthority: [],
        regulatoryNote: "",
        criteria: Object.fromEntries(CRITERIA.map((k) => [k, rating(9)])),
        searchQueries: ["accelerator"],
      })),
    });
  }
}

const AI = { ai: { requested: true, tester: "tester-a" } };

beforeEach(() => {
  setStoreForTesting(new MemoryStore());
  for (const k of ["AI_DAILY_BUDGET_USD", "AI_MONTHLY_BUDGET_USD", "AI_PER_TESTER_DAILY_RUNS", "AI_FALLBACK", "AI_ESTIMATED_RUN_COST_USD"]) delete process.env[k];
  process.env.AI_ACCESS = "testers";
});

describe("AI pipeline", () => {
  it("runs staged generation, clamps ratings, and labels everything inferred", async () => {
    const p = new MockProvider();
    setLLMProviderForTesting(p);
    const a = await generateAnalysis({ ...APP_AGENCY, existingReferrals: "Partner 3 folks" }, AI);
    expect(a.engine.mode).toBe("ai");
    expect(a.engine.provider).toBe("mock");
    expect(a.categories).toHaveLength(8);
    expect(p.calls).toBe(3); // 1 candidates + 2 analysis batches of 4
    expect(a.categories.find((c) => c.name === "Partner 7")?.overlooked).toBe(true);
    expect(a.categories[0].decisionMaker).toBe("Programme manager");
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
    await generateAnalysis({ ...APP_AGENCY, businessName: "SecretCo", website: "secretco.example", existingReferrals: "Jane at BigBank" }, AI);
    const all = p.prompts.join("\n");
    expect(all).not.toContain("SecretCo");
    expect(all).not.toContain("secretco.example");
    expect(all).not.toContain("BigBank");
    expect(all).toContain("<business_description>");
  });

  it("caches identical requests", async () => {
    const p = new MockProvider();
    setLLMProviderForTesting(p);
    await generateAnalysis(APP_AGENCY, AI);
    const before = p.calls;
    const second = await generateAnalysis({ ...APP_AGENCY, businessName: "Other name" }, AI);
    expect(p.calls).toBe(before);
    expect(second.engine.diagnostics?.join(" ")).toMatch(/cache/i);
    expect(second.engine.notes).toEqual([]);
  });

  it("falls back to the knowledge base, with a visible note, when the AI fails", async () => {
    setLLMProviderForTesting(new MockProvider(true));
    const a = await generateAnalysis(APP_AGENCY, AI);
    expect(a.engine.mode).toBe("knowledge_base");
    expect(a.engine.diagnostics?.join(" ")).toMatch(/AI failed/);
    expect(a.engine.notes.join(" ")).not.toMatch(/AI/);
    expect(a.categories.length).toBeGreaterThan(5);
  });

  it("never uses AI for anonymous visitors when access is limited to testers", async () => {
    const p = new MockProvider();
    setLLMProviderForTesting(p);
    const a = await generateAnalysis(APP_AGENCY, { ai: { requested: true, tester: null } });
    expect(a.engine.mode).toBe("knowledge_base");
    expect(p.calls).toBe(0);
    expect(a.engine.notes).toEqual([]);
  });

  it("does not use AI unless requested", async () => {
    const p = new MockProvider();
    setLLMProviderForTesting(p);
    await generateAnalysis(APP_AGENCY);
    await generateAnalysis(APP_AGENCY, { ai: { requested: false, tester: "tester-a" } });
    expect(p.calls).toBe(0);
  });

  it("records spend and enforces the per-tester daily limit", async () => {
    process.env.AI_PER_TESTER_DAILY_RUNS = "1";
    const p = new MockProvider();
    setLLMProviderForTesting(p);
    // Usage is reported by real providers; simulate it on the mock.
    const orig = p.generateObject.bind(p);
    p.generateObject = (async (o: GenerateObjectOptions<unknown>) => {
      o.onUsage?.({ inputTokens: 1000, outputTokens: 2000 });
      return orig(o);
    }) as typeof p.generateObject;
    const first = await generateAnalysis(APP_AGENCY, AI);
    expect(first.engine.mode).toBe("ai");
    expect(first.engine.costUsd).toBeGreaterThan(0);
    const spend = await spendSummary();
    expect(spend.today.runs).toBe(1);
    expect(spend.today.outputTokens).toBe(6000);
    const second = await generateAnalysis({ ...APP_AGENCY, industry: "Different agency" }, AI);
    expect(second.engine.mode).toBe("knowledge_base");
    expect(second.engine.diagnostics?.join(" ")).toMatch(/today's AI analysis limit/);
  });

  it("stops at the daily budget and can be configured to error instead of falling back", async () => {
    process.env.AI_DAILY_BUDGET_USD = "0.5";
    process.env.AI_ESTIMATED_RUN_COST_USD = "1";
    setLLMProviderForTesting(new MockProvider());
    const a = await generateAnalysis(APP_AGENCY, AI);
    expect(a.engine.mode).toBe("knowledge_base");
    expect(a.engine.diagnostics?.join(" ")).toMatch(/budget/);
    process.env.AI_FALLBACK = "error";
    await expect(generateAnalysis(APP_AGENCY, AI)).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("honours AI_ACCESS=all and AI_ACCESS=none", async () => {
    const p = new MockProvider();
    setLLMProviderForTesting(p);
    process.env.AI_ACCESS = "none";
    expect((await generateAnalysis(APP_AGENCY, AI)).engine.mode).toBe("knowledge_base");
    process.env.AI_ACCESS = "all";
    expect((await generateAnalysis(APP_AGENCY, { ai: { requested: true, tester: null } })).engine.mode).toBe("ai");
  });
});

describe("AI default", () => {
  it("is off unless AI_ACCESS is set", async () => {
    delete process.env.AI_ACCESS;
    const p = new MockProvider();
    setLLMProviderForTesting(p);
    const a = await generateAnalysis(APP_AGENCY, AI);
    expect(a.engine.mode).toBe("knowledge_base");
    expect(p.calls).toBe(0);
  });
});
