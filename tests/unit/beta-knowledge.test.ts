import { describe, expect, it, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { BETA_COOKIE, findInvite, signTester, verifyTester, isAdmin, adminCookieValue } from "@/lib/beta";
import { ARCHETYPES, matchArchetype } from "@/lib/knowledge";
import { normalizeInput } from "@/lib/engine/normalize";
import { runKnowledgeBase } from "@/lib/engine/kb-engine";
import type { BusinessInput } from "@/lib/schema";

beforeEach(() => {
  process.env.BETA_SECRET = "beta-secret-123";
  process.env.BETA_INVITES = "alice:abc12345, bob:zzz99999";
  process.env.ADMIN_KEY = "admin-key-1";
  delete process.env.BETA_MODE;
});

describe("beta access", () => {
  it("matches invite codes and signs tester cookies", async () => {
    expect(findInvite("abc12345")).toBe("alice");
    expect(findInvite("nope")).toBeNull();
    const tok = (await signTester("alice"))!;
    expect(await verifyTester(tok)).toBe("alice");
    expect(await verifyTester(tok.replace(/.$/, "x"))).toBeNull();
  });
  it("revokes access when an invite is removed", async () => {
    const tok = (await signTester("bob"))!;
    process.env.BETA_INVITES = "alice:abc12345";
    expect(await verifyTester(tok)).toBeNull();
  });
  it("gates pages and APIs when BETA_MODE is on, but not the Stripe webhook", async () => {
    process.env.BETA_MODE = "true";
    const page = await proxy(new NextRequest("https://x.test/ecosystem/demo"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/beta/join?next=%2Fecosystem%2Fdemo");
    const api = await proxy(new NextRequest("https://x.test/api/analyze", { method: "POST" }));
    expect(api.status).toBe(401);
    const hook = await proxy(new NextRequest("https://x.test/api/stripe/webhook", { method: "POST" }));
    expect(hook.status).toBe(200);
    const tok = (await signTester("alice"))!;
    const ok = await proxy(new NextRequest("https://x.test/", { headers: { cookie: `${BETA_COOKIE}=${tok}` } }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-robots-tag")).toContain("noindex");
  });
  it("protects the admin area separately from the invite gate", async () => {
    process.env.BETA_MODE = "true";
    // Admin page is reachable without an invite (it shows its own sign-in), admin APIs are not.
    expect((await proxy(new NextRequest("https://x.test/admin"))).status).toBe(200);
    expect((await proxy(new NextRequest("https://x.test/api/admin/grant", { method: "POST" }))).status).toBe(404);
    expect((await proxy(new NextRequest("https://x.test/api/admin/login", { method: "POST" }))).status).toBe(200);
    const cookie = `reg_admin=${await adminCookieValue()}`;
    expect((await proxy(new NextRequest("https://x.test/api/admin/grant", { method: "POST", headers: { cookie } }))).status).toBe(200);
    // Without ADMIN_KEY the whole admin area does not exist.
    delete process.env.ADMIN_KEY;
    expect((await proxy(new NextRequest("https://x.test/admin"))).status).toBe(404);
  });

  it("admin cookie is derived from ADMIN_KEY", async () => {
    expect(await isAdmin(await adminCookieValue())).toBe(true);
    expect(await isAdmin("forged")).toBe(false);
  });
});

const base: Omit<BusinessInput, "industry" | "serviceArea" | "idealCustomer"> = {
  businessName: "T", website: "", services: "", projectValue: "", targetIndustries: "", growthPriority: "", existingReferrals: "", expansionMarkets: "",
};
const kb = (industry: string, extra: Partial<BusinessInput> = {}) =>
  runKnowledgeBase(normalizeInput({ ...base, industry, serviceArea: "London, Ontario", idealCustomer: "Owners", ...extra }));

describe("deepened industry profiles", () => {
  it.each([
    ["Basement waterproofing company", "waterproofing"],
    ["Concrete contractor", "concrete"],
    ["Kitchen and bathroom renovation company", "renovation"],
    ["Custom home builder", "custom-builder"],
    ["Family lawyer", "family-law"],
    ["Criminal defence lawyer", "criminal-law"],
    ["Residential property management company", "property-management"],
    ["SEO agency", "marketing-agency"],
    ["Immigration law firm", "immigration-law"],
  ])("%s → %s", (industry, id) => {
    expect(matchArchetype({ industry }).archetype.id).toBe(id);
  });

  it("blends related trades and drops categories describing the business itself", () => {
    const r = kb("Excavation and basement waterproofing contractor", { services: "excavation, waterproofing, foundation repair" });
    expect(r.match.secondary).toBeDefined();
    const ids = r.categories.map((c) => c.id);
    expect(ids).not.toContain("waterproofing");
    expect(ids).not.toContain("excavation-contractors");
    expect(ids).toEqual(expect.arrayContaining(["new-home-warranty-builders", "custom-home-builders"]));
    // near-duplicate partner types are merged
    expect(ids.filter((id) => id.startsWith("plumbers")).length).toBe(1);
  });

  it("does not blend across families", () => {
    expect(kb("Property management company").match.secondary).toBeUndefined();
  });

  const DEEP = ["site-construction", "waterproofing", "concrete", "renovation", "custom-builder", "immigration-law", "family-law", "criminal-law", "property-management", "marketing-agency"];
  it("every relationship in the deepened profiles names a decision-maker and has unique ids", () => {
    for (const a of ARCHETYPES.filter((x) => DEEP.includes(x.id))) {
      const ids = a.categories.map((c) => c.id);
      expect(new Set(ids).size, a.id).toBe(ids.length);
      for (const c of a.categories) {
        expect(c.decisionMaker, `${a.id}/${c.id}`).toBeTruthy();
        expect(c.triggers.length, `${a.id}/${c.id}`).toBeGreaterThan(0);
      }
      expect(a.categories.filter((c) => c.overlooked).length, a.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("category ids are globally consistent (same id → same partner type)", () => {
    const seen = new Map<string, string>();
    for (const a of ARCHETYPES) for (const c of a.categories) {
      if (seen.has(c.id)) expect(seen.get(c.id), c.id).toBe(c.name);
      seen.set(c.id, c.name);
    }
  });
});
