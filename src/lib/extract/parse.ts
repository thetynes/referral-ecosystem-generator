/**
 * Extract business information from a public web page. The page is untrusted data:
 * we only read text, never execute anything, and every suggestion is shown to the
 * user for review before use.
 */
import { parse } from "node-html-parser";
import { matchArchetype } from "../knowledge";

export interface PageFacts {
  title: string | null;
  description: string | null;
  siteName: string | null;
  headings: string[];
  jsonLd: { name?: string; locality?: string; region?: string; country?: string; areaServed?: string; types: string[] };
  text: string;
}

const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

function readJsonLd(blocks: string[]): PageFacts["jsonLd"] {
  const out: PageFacts["jsonLd"] = { types: [] };
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const n = node as Record<string, unknown>;
    if (n["@graph"]) visit(n["@graph"]);
    const t = n["@type"];
    const types = (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === "string");
    const isOrg = types.some((x) => /Organization|LocalBusiness|Store|Service|Attorney|LegalService|Contractor|Dentist|MedicalBusiness|ProfessionalService|HomeAndConstructionBusiness/i.test(x));
    if (!isOrg) return;
    out.types.push(...types);
    if (!out.name && typeof n.name === "string") out.name = clean(n.name);
    const addr = n.address as Record<string, unknown> | undefined;
    if (addr && typeof addr === "object") {
      if (!out.locality && typeof addr.addressLocality === "string") out.locality = clean(addr.addressLocality);
      if (!out.region && typeof addr.addressRegion === "string") out.region = clean(addr.addressRegion);
      if (!out.country && typeof addr.addressCountry === "string") out.country = clean(addr.addressCountry);
    }
    const area = n.areaServed;
    if (!out.areaServed) {
      if (typeof area === "string") out.areaServed = clean(area);
      else if (area && typeof area === "object" && typeof (area as { name?: unknown }).name === "string") out.areaServed = clean((area as { name: string }).name);
    }
  };
  for (const b of blocks) {
    try {
      visit(JSON.parse(b));
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return out;
}

export function extractPageFacts(html: string): PageFacts {
  const root = parse(html, { blockTextElements: { script: true, style: false, noscript: false } });
  const meta = (sel: string) => clean(root.querySelector(sel)?.getAttribute("content"));
  const jsonLdBlocks = root.querySelectorAll('script[type="application/ld+json"]').map((s) => s.text);
  root.querySelectorAll("script,style,noscript,svg,template,iframe").forEach((n) => n.remove());
  const headings = root
    .querySelectorAll("h1,h2,h3")
    .map((h) => clean(h.text))
    .filter((h) => h.length > 2 && h.length < 120)
    .slice(0, 30);
  const body = root.querySelector("main") ?? root.querySelector("body") ?? root;
  return {
    title: clean(root.querySelector("title")?.text) || null,
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]') || null,
    siteName: meta('meta[property="og:site_name"]') || null,
    headings,
    jsonLd: readJsonLd(jsonLdBlocks),
    text: clean(body.text).slice(0, 6000),
  };
}

export interface IntakeSuggestion {
  businessName: string | null;
  industry: string | null;
  services: string | null;
  serviceArea: string | null;
  notes: string[];
}

/** Deterministic suggestions from page facts (used when no AI provider is configured). */
export function suggestFromFacts(f: PageFacts): IntakeSuggestion {
  const notes: string[] = [];
  const name = f.jsonLd.name || f.siteName || (f.title ? f.title.split(/\s[|–—-]\s/)[0] : null);
  const textForMatch = [f.title, f.description, ...f.headings].filter(Boolean).join(" ");
  const match = matchArchetype({ industry: textForMatch, other: f.text.slice(0, 3000) });
  const industry = match.confidence !== "low" ? match.archetype.label : null;
  if (!industry) notes.push("We couldn't confidently identify your industry from the website. Please describe it.");
  const services = match.confidence !== "low" && match.matchedTerms.length
    ? Array.from(new Set(match.matchedTerms.map((t) => t.replace(/\b\w/g, (c) => c.toUpperCase())))).slice(0, 8).join(", ")
    : null;
  const areaParts = [f.jsonLd.locality, f.jsonLd.region].filter(Boolean);
  const serviceArea = f.jsonLd.areaServed || (areaParts.length ? areaParts.join(", ") : null);
  if (!serviceArea) notes.push("No service area was found in the site's structured data.");
  return { businessName: name ? name.slice(0, 120) : null, industry, services, serviceArea, notes };
}
