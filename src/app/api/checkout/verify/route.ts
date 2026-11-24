import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getStripe, paidSessionFrom, type PaidSession } from "@/lib/payments/stripe";
import { issueEntitlement } from "@/lib/payments/entitlements";
import { jsonError, limitOrNull } from "@/lib/http";
import { recordPurchase } from "@/lib/payments/purchase";

export const runtime = "nodejs";

/**
 * Exchange a completed Checkout Session for a signed entitlement token.
 * Access is granted only if the webhook recorded the payment OR Stripe confirms
 * (server-side) that the session is paid.
 */
export async function GET(req: Request) {
  const limited = limitOrNull(req, "verify", 20);
  if (limited) return limited;
  const sessionId = new URL(req.url).searchParams.get("session_id") ?? "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return jsonError("Invalid session.", 400);

  const store = await getStore();
  let paid = await store.get<PaidSession>("checkout", sessionId);
  if (!paid) {
    const stripe = getStripe();
    if (!stripe) return jsonError("We couldn't confirm this payment.", 503);
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      paid = paidSessionFrom(session);
      if (paid) {
        await store.set("checkout", sessionId, paid);
        await recordPurchase(paid);
      }
    } catch {
      return jsonError("We couldn't confirm this payment.", 404);
    }
  }
  if (!paid) return jsonError("Payment has not been confirmed yet. Refresh in a moment.", 402, { pending: true });
  const token = issueEntitlement({ analysisId: paid.analysisId, tier: paid.tier });
  return NextResponse.json({ analysisId: paid.analysisId, tier: paid.tier, token });
}
