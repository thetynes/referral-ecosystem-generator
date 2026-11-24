import { NextResponse } from "next/server";
import { z } from "zod";
import type { Analysis, Organization } from "@/lib/schema";
import { getStore } from "@/lib/store";
import { verifyEntitlement } from "@/lib/payments/entitlements";
import { discoverOrganizations, getDiscoveryProvider } from "@/lib/discovery";
import { rankCategories, WEIGHT_PRESETS, presetForGrowthPriority } from "@/lib/scoring";
import { jsonError, limitOrNull, readJson } from "@/lib/http";
import { config } from "@/lib/config";
import { track } from "@/lib/analytics";
import { testerFromRequest } from "@/lib/beta";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({ analysisId: z.string().uuid(), refresh: z.boolean().optional() });

interface StoredDiscovery {
  organizations: Organization[];
  errors: { categoryId: string; message: string }[];
  provider: string;
  researchedAt: string;
}

const discoveryTtl = () => 60 * 60 * 24 * config().discovery.retentionDays;

type Loaded = { error: Response } | { error?: undefined; ent: NonNullable<ReturnType<typeof verifyEntitlement>>; analysis: Analysis };

async function load(req: Request, analysisId: string): Promise<Loaded> {
  const ent = verifyEntitlement(req.headers.get("x-entitlement"), analysisId);
  if (!ent) return { error: jsonError("Company research is included with the full report.", 402) };
  const analysis = await (await getStore()).get<Analysis>("analyses", analysisId);
  if (!analysis) return { error: jsonError("Analysis not found.", 404) };
  return { ent, analysis };
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("analysisId") ?? "";
  if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid analysis id.", 400);
  const r = await load(req, id);
  if (r.error) return r.error;
  const stored = await (await getStore()).get<StoredDiscovery>("discovery", id);
  return NextResponse.json(stored ?? null);
}

export async function POST(req: Request) {
  const limited = limitOrNull(req, "discover", 3);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await readJson(req, 2000);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid analysis id.", 400);
  const r = await load(req, parsed.data.analysisId);
  if (r.error) return r.error;

  if (!config().discovery.researchEnabled) {
    return jsonError(
      "Company research isn't available yet. You can add companies you know from a spreadsheet instead.",
      503,
      { code: "research_disabled" },
    );
  }
  const provider = getDiscoveryProvider();
  if (!provider) {
    return jsonError(
      "Company research isn't available yet. You can add companies you know from a spreadsheet instead.",
      503,
      { code: "discovery_not_configured" },
    );
  }

  const store = await getStore();
  const existing = await store.get<StoredDiscovery>("discovery", r.analysis.id);
  // Re-run only when asked to and the previous search was incomplete; otherwise reuse the stored results.
  if (existing && !(parsed.data.refresh && existing.errors.length > 0)) return NextResponse.json(existing);

  const weights = WEIGHT_PRESETS[presetForGrowthPriority(r.analysis.profile.growthPriority)].weights;
  const ranked = rankCategories(r.analysis.categories, weights);
  const targets = r.ent.tier === "comprehensive" ? ranked.slice(0, 15) : ranked.slice(0, 5);
  const run = await discoverOrganizations(provider, r.analysis.profile, targets, r.ent.tier === "comprehensive" ? 6 : 5);
  await store.set("discovery", r.analysis.id, run, discoveryTtl());
  await track("discovery_run", {
    tester: await testerFromRequest(req),
    analysisId: r.analysis.id,
    simulated: Boolean(r.ent.dev || r.ent.demo),
    props: { provider: run.provider, companies: run.organizations.length, failedCategories: run.errors.length, categories: targets.length },
  });
  if (run.errors.length) console.error("discovery partial failure", run.errors.map((e) => e.message).slice(0, 3));
  return NextResponse.json(run);
}
