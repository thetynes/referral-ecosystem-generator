import { NextResponse } from "next/server";
import { z } from "zod";
import type { Analysis } from "@/lib/schema";
import { getStore } from "@/lib/store";
import { issueEntitlement } from "@/lib/payments/entitlements";
import { track } from "@/lib/analytics";
import { jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

const BodySchema = z.object({
  /** An ecosystem link or id. */
  ecosystem: z.string().trim().min(10).max(400),
  tier: z.enum(["basic", "comprehensive"]),
  days: z.number().int().min(1).max(90).default(14),
});

/** Admin only (enforced in the proxy): create a demo-access link that unlocks a full report without payment. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await readJson(req, 2000);
  } catch {
    return jsonError("Invalid request.", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError("Enter an ecosystem link or ID.", 400);
  const id = parsed.data.ecosystem.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (!id) return jsonError("That doesn't contain an ecosystem ID.", 400);
  const analysis = await (await getStore()).get<Analysis>("analyses", id);
  if (!analysis) return jsonError("No ecosystem with that ID was found (it may have expired).", 404);
  const token = issueEntitlement({ analysisId: id, tier: parsed.data.tier, demo: true }, parsed.data.days);
  await track("admin_grant", { analysisId: id, simulated: true, props: { tier: parsed.data.tier, days: parsed.data.days } });
  // Build the link from the address the admin is using, so it always points at this deployment.
  const link = `${new URL(req.url).origin}/ecosystem/${id}?access=${encodeURIComponent(token)}`;
  return NextResponse.json({ link, business: analysis.profile.displayName, expiresInDays: parsed.data.days });
}
