import { describe, expect, it } from "vitest";
import { GooglePlacesProvider } from "@/lib/discovery/google-places";
import { BraveSearchProvider, nameFromTitle, isNonBusinessDomain } from "@/lib/discovery/brave";
import { discoverOrganizations } from "@/lib/discovery";
import { importOrganizationsCsv, csvSafe } from "@/lib/discovery/csv";
import { normalizeInput } from "@/lib/engine/normalize";
import { runKnowledgeBase } from "@/lib/engine/kb-engine";
import { organizationsCsv } from "@/lib/export";
import { EXCAVATION } from "./fixtures";

const profile = normalizeInput({ ...EXCAVATION, website: "https://test-excavating.example" });
const categories = runKnowledgeBase(profile).categories;

const jsonFetch = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

describe("Google Places provider", () => {
  it("maps listings with verified fields and skips permanently closed places", async () => {
    let captured: RequestInit | undefined;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      captured = init;
      return new Response(JSON.stringify({
        places: [
          { id: "p1", displayName: { text: "Lambton Drain Pros" }, formattedAddress: "1 Main St, Sarnia, ON", websiteUri: "https://drainpros.example", nationalPhoneNumber: "(519) 555-0100", primaryTypeDisplayName: { text: "Plumber" }, googleMapsUri: "https://maps.google.com/?cid=1" },
          { id: "p2", displayName: { text: "Closed Co" }, businessStatus: "CLOSED_PERMANENTLY" },
        ],
      }));
    }) as unknown as typeof fetch;
    const p = new GooglePlacesProvider("key", fetchImpl);
    const listings = await p.search("plumbing company", "Sarnia, Ontario", 5);
    expect(listings).toHaveLength(1);
    expect(JSON.parse(String(captured!.body)).textQuery).toBe("plumbing company in Sarnia, Ontario");
    expect((captured!.headers as Record<string, string>)["X-Goog-FieldMask"]).toContain("places.websiteUri");

    const run = await discoverOrganizations(p, profile, categories.filter((c) => c.id === "plumbers-drain"), 5);
    const org = run.organizations[0];
    expect(org.name).toMatchObject({ value: "Lambton Drain Pros", status: "verified" });
    expect(org.verificationStatus).toBe("verified_listing");
    expect(org.services.status).toBe("unknown");
    expect(org.sourceUrls).toContain("https://maps.google.com/?cid=1");
    expect(org.inclusionReason).toMatch(/Google Maps/);
  });

  it("reports provider errors per category instead of inventing results", async () => {
    const p = new GooglePlacesProvider("bad", jsonFetch({ error: "denied" }, 403));
    const run = await discoverOrganizations(p, profile, categories.slice(0, 2), 5);
    expect(run.organizations).toHaveLength(0);
    expect(run.errors).toHaveLength(2);
  });
});

describe("Brave provider", () => {
  it("infers names from titles, filters directories, and marks names as inferred", async () => {
    const p = new BraveSearchProvider("k", jsonFetch({
      web: { results: [
        { title: "Acme Property Management | Sarnia Rentals", url: "https://acmepm.example/about", description: "Managing <b>rentals</b> in Sarnia" },
        { title: "Best 10 Property Managers - Yelp", url: "https://www.yelp.ca/search?x" },
      ] },
    }));
    const run = await discoverOrganizations(p, profile, categories.filter((c) => c.id === "property-managers"), 5);
    expect(run.organizations).toHaveLength(1);
    const org = run.organizations[0];
    expect(org.name).toMatchObject({ value: "Acme Property Management", status: "inferred" });
    expect(org.website).toMatchObject({ value: "https://acmepm.example", status: "verified" });
    expect(org.location.status).toBe("unknown");
    expect(org.verificationStatus).toBe("partially_verified");
  });
  it("helpers", () => {
    expect(nameFromTitle("Home - Foo Engineering")).toBe("Foo Engineering");
    expect(isNonBusinessDomain("https://www.linkedin.com/company/x")).toBe(true);
    expect(isNonBusinessDomain("https://foo.example")).toBe(false);
  });
});

describe("dedupe", () => {
  it("removes duplicates and the user's own business", async () => {
    const p = new BraveSearchProvider("k", jsonFetch({
      web: { results: [
        { title: "Self | Test Excavating", url: "https://test-excavating.example/" },
        { title: "Dup Co", url: "https://dup.example/a" },
        { title: "Dup Co again", url: "https://www.dup.example/b" },
      ] },
    }));
    const run = await discoverOrganizations(p, profile, categories.filter((c) => c.id === "property-managers"), 5);
    expect(run.organizations.map((o) => o.website.value)).toEqual(["https://dup.example"]);
  });
});

describe("CSV import", () => {
  it("imports rows as user-provided, maps aliases and partner categories", () => {
    const csv = `Company,URL,City,Partner Category,Email\n"Builder One",builderone.example,"Sarnia, ON","Custom & infill home builders",hi@b1.example\n,missing.example,,,\n"Orphan",,,"Unknown category",`;
    const r = importOrganizationsCsv(csv, categories, categories[0].id);
    expect(r.organizations).toHaveLength(2);
    const b1 = r.organizations[0];
    expect(b1.categoryId).toBe("custom-home-builders");
    expect(b1.name.status).toBe("user_provided");
    expect(b1.website.value).toBe("https://builderone.example/");
    expect(b1.verificationStatus).toBe("unverified");
    expect(r.organizations[1].categoryId).toBe(categories[0].id); // fallback
  });
  it("requires a name column", () => {
    expect(importOrganizationsCsv("foo,bar\n1,2", categories).errors[0]).toMatch(/name/);
  });
  it("rejects javascript: URLs and neutralises formula injection on export", () => {
    const r = importOrganizationsCsv(`name,website\n"=HYPERLINK(\\"x\\")",javascript:alert(1)`, categories, categories[0].id);
    expect(r.organizations[0].website.value).toBeNull();
    expect(csvSafe("=1+1")).toBe("'=1+1");
    const out = organizationsCsv(r.organizations, () => "x");
    expect(out).toContain("'=HYPERLINK");
  });
});
