import { NextResponse } from "next/server";
import { z } from "zod";
import type { Analysis } from "@/lib/schema";
import { capabilities } from "@/lib/config";
import { getStore } from "@/lib/store";
import { createCheckoutSession, getStripe } from "@/lib/payments/stripe";
import { jsonError, limitOrNull, readJson } from "@/lib/http";
import { track } from "@/lib/analytics";
import { readCookie, SESSION_COOKIE, testerFromRequest } from "@/lib/beta";

export const runtime = "nodejs";

const BodySchema = z.object({ analysisId: z.string().uuid(), tier: z.enum(["basic", "comprehensive"]) });

export async function POST(req: Request) {
  const limited = limitOrNull(req, "checkout", 6);
  if (limited) return limited;
  const caps = capabilities();
  const stripe = getStripe();
  if (!caps.paidReportsAvailable || !stripe) {
    return jsonError("Full reports aren't available to purchase yet.", 503, { code: "payments_unavailable" });
  }
  let body: unknown;
  try {
    body = await readJson(req, 2000);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid checkout request.", 400);
  const analysis = await (await getStore()).get<Analysis>("analyses", parsed.data.analysisId);
  if (!analysis) return jsonError("We couldn't find this ecosystem. Generate it again before purchasing.", 404);
  try {
    const url = await createCheckoutSession(stripe, analysis.id, parsed.data.tier);
    await track("checkout_started", {
      tester: await testerFromRequest(req),
      session: readCookie(req, SESSION_COOKIE),
      analysisId: analysis.id,
      simulated: caps.paymentsMode !== "live",
      props: { tier: parsed.data.tier, paymentsMode: caps.paymentsMode },
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("checkout failed", err);
    return jsonError("Checkout could not be started. Please try again.", 502);
  }
}
