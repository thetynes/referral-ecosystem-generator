import { describe, expect, it, beforeEach } from "vitest";
import Stripe from "stripe";
import { POST as analyze } from "@/app/api/analyze/route";
import { GET as getAnalysis } from "@/app/api/analysis/[id]/route";
import { POST as discover } from "@/app/api/discover/route";
import { POST as checkout } from "@/app/api/checkout/route";
import { POST as devUnlock } from "@/app/api/dev/unlock/route";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { GET as verify } from "@/app/api/checkout/verify/route";
import { setLLMProviderForTesting } from "@/lib/llm";
import { setDiscoveryProviderForTesting } from "@/lib/discovery";
import { MemoryStore, setStoreForTesting } from "@/lib/store";
import type { AnalysisView } from "@/lib/schema";
import { summarize, _resetMemoryAnalyticsForTesting } from "@/lib/analytics";
import { capabilities } from "@/lib/config";
import { EXCAVATION } from "./fixtures";

let ipCounter = 0;
const req = (url: string, init: RequestInit & { json?: unknown } = {}) =>
  new Request(`http://localhost${url}`, {
    method: init.method ?? (init.json ? "POST" : "GET"),
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ipCounter % 250}`, ...(init.headers as Record<string, string>) },
    body: init.json ? JSON.stringify(init.json) : (init.body as BodyInit | undefined),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  setLLMProviderForTesting(null);
  setDiscoveryProviderForTesting(null);
  setStoreForTesting(new MemoryStore());
  process.env.ENTITLEMENT_SECRET = "s3cret";
  delete process.env.DEV_MODE;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_ALLOW_LIVE;
  delete process.env.COMPANY_RESEARCH_ENABLED;
  _resetMemoryAnalyticsForTesting();
});

async function create(): Promise<AnalysisView> {
  const res = await analyze(req("/api/analyze", { json: { input: EXCAVATION } }));
  expect(res.status).toBe(200);
  return res.json();
}

describe("API", () => {
  it("validates intake input", async () => {
    const res = await analyze(req("/api/analyze", { json: { input: { industry: "x" } } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });

  it("returns a free view and re-serves it by id", async () => {
    const v = await create();
    expect(v.access.tier).toBe("free");
    expect(v.categories).toHaveLength(5);
    const again = await getAnalysis(req(`/api/analysis/${v.id}`), params(v.id));
    expect((await again.json()).categories).toHaveLength(5);
    expect((await getAnalysis(req("/api/analysis/not-a-uuid"), params("not-a-uuid"))).status).toBe(404);
  });

  it("serves the demo with every category", async () => {
    const res = await getAnalysis(req("/api/analysis/demo"), params("demo"));
    const v = await res.json();
    expect(v.isDemo).toBe(true);
    expect(v.access.lockedCategoryCount).toBe(0);
  });

  it("refuses checkout when payments/research are not configured", async () => {
    const v = await create();
    const res = await checkout(req("/api/checkout", { json: { analysisId: v.id, tier: "basic" } }));
    expect(res.status).toBe(503);
  });

  it("dev unlock is disabled unless DEV_MODE", async () => {
    const v = await create();
    expect((await devUnlock(req("/api/dev/unlock", { json: { analysisId: v.id, tier: "basic" } }))).status).toBe(404);
    process.env.DEV_MODE = "true";
    const res = await devUnlock(req("/api/dev/unlock", { json: { analysisId: v.id, tier: "comprehensive" } }));
    const { token } = await res.json();
    const full = await (await getAnalysis(req(`/api/analysis/${v.id}`, { headers: { "x-entitlement": token } }), params(v.id))).json();
    expect(full.categories.length).toBe(5 + v.access.lockedCategoryCount);
    expect(full.access.devUnlocked).toBe(true);
  });

  it("discovery requires an entitlement and a configured provider; never fabricates", async () => {
    const v = await create();
    expect((await discover(req("/api/discover", { json: { analysisId: v.id } }))).status).toBe(402);
    process.env.DEV_MODE = "true";
    const { token } = await (await devUnlock(req("/api/dev/unlock", { json: { analysisId: v.id, tier: "basic" } }))).json();
    // Licensing gate comes first: research is off by default.
    const gated = await discover(req("/api/discover", { json: { analysisId: v.id }, headers: { "x-entitlement": token } }));
    expect(gated.status).toBe(503);
    expect((await gated.json()).code).toBe("research_not_licensed");
    process.env.COMPANY_RESEARCH_ENABLED = "true";
    const res = await discover(req("/api/discover", { json: { analysisId: v.id }, headers: { "x-entitlement": token } }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("discovery_not_configured");

    setDiscoveryProviderForTesting({
      id: "google_places", label: "Mock Places",
      search: async (q) => [{ name: `Org for ${q}`, website: `https://${q.replace(/\W/g, "")}.example`, address: "Sarnia", phone: null, categoryLabel: null, sourceUrl: "https://maps.example/1", snippet: null, origin: "google_places", query: q }],
    });
    const ok = await (await discover(req("/api/discover", { json: { analysisId: v.id }, headers: { "x-entitlement": token } }))).json();
    expect(ok.organizations.length).toBeGreaterThan(0);
    expect(new Set(ok.organizations.map((o: { categoryId: string }) => o.categoryId)).size).toBeLessThanOrEqual(5);
  });

  it("webhook verifies Stripe signatures and records paid sessions; verify issues a token", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const v = await create();
    const event = {
      id: "evt_1", object: "event", type: "checkout.session.completed",
      data: { object: { id: "cs_test_123", object: "checkout.session", payment_status: "paid", metadata: { analysisId: v.id, tier: "basic" } } },
    };
    const payload = JSON.stringify(event);
    const bad = await webhook(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": "t=1,v1=bad" } }));
    expect(bad.status).toBe(400);
    const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test" });
    const good = await webhook(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": sig } }));
    expect(good.status).toBe(200);
    const vr = await verify(req("/api/checkout/verify?session_id=cs_test_123"));
    const data = await vr.json();
    expect(data.tier).toBe("basic");
    const full = await (await getAnalysis(req(`/api/analysis/${v.id}`, { headers: { "x-entitlement": data.token } }), params(v.id))).json();
    expect(full.access.tier).toBe("basic");
    expect(full.access.lockedCategoryCount).toBe(0);
  });

  it("does not record unpaid sessions", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const payload = JSON.stringify({ id: "evt_2", object: "event", type: "checkout.session.completed", data: { object: { id: "cs_test_unpaid", payment_status: "unpaid", metadata: { analysisId: "x", tier: "basic" } } } });
    const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test" });
    await webhook(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": sig } }));
    // verify falls through to Stripe API (unreachable with a dummy key) → not confirmed
    const vr = await verify(req("/api/checkout/verify?session_id=cs_test_unpaid"));
    expect(vr.status).not.toBe(200);
  });

  it("refuses live Stripe keys unless explicitly allowed", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    expect(capabilities().paymentsEnabled).toBe(false);
    process.env.STRIPE_ALLOW_LIVE = "true";
    expect(capabilities().paymentsMode).toBe("live");
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    delete process.env.STRIPE_ALLOW_LIVE;
    expect(capabilities().paymentsMode).toBe("test");
    expect(capabilities().paidReportsAvailable).toBe(true);
  });

  it("records funnel analytics and separates simulated purchases", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.APP_ENV = "preview";
    try {
      const v = await create();
      const payload = JSON.stringify({ id: "evt_3", object: "event", type: "checkout.session.completed", data: { object: { id: "cs_test_funnel", livemode: false, payment_status: "paid", metadata: { analysisId: v.id, tier: "basic" } } } });
      const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test" });
      await webhook(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": sig } }));
      // A retried webhook must not double count.
      await webhook(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test" }) } }));
      const s = await summarize(1);
      const row = (n: string) => s.counts.find((c) => c.name === n) ?? { real: 0, simulated: 0 };
      expect(row("intake_completed").real).toBe(1);
      expect(row("map_generated").real).toBe(1);
      expect(row("purchase_completed")).toEqual({ name: "purchase_completed", real: 0, simulated: 1 });
    } finally {
      delete process.env.APP_ENV;
    }
  });
});
