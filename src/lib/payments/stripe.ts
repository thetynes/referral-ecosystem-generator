import Stripe from "stripe";
import { config } from "../config";
import type { Tier } from "./entitlements";

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const { payments } = config();
  if (!payments.stripeSecret) return null;
  client ??= new Stripe(payments.stripeSecret);
  return client;
}

export const TIER_INFO: Record<Tier, { name: string; description: string }> = {
  basic: {
    name: "Basic Opportunity Report",
    description: "Full partner-category analysis, named-organisation research for your top 5 categories, and PDF/CSV exports.",
  },
  comprehensive: {
    name: "Comprehensive Partnership Report",
    description: "Everything in Basic, plus named-organisation research across all partner categories.",
  },
};

export function priceFor(tier: Tier): number {
  const { payments } = config();
  return tier === "basic" ? payments.basicCents : payments.comprehensiveCents;
}

export async function createCheckoutSession(stripe: Stripe, analysisId: string, tier: Tier): Promise<string> {
  const { appUrl, payments } = config();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: payments.currency,
          unit_amount: priceFor(tier),
          product_data: { name: TIER_INFO[tier].name, description: TIER_INFO[tier].description },
        },
      },
    ],
    metadata: { analysisId, tier },
    client_reference_id: analysisId,
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/ecosystem/${analysisId}?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

export interface PaidSession {
  analysisId: string;
  tier: Tier;
  sessionId: string;
}

/** Extract a verified paid entitlement from a Checkout Session object. */
export function paidSessionFrom(session: Stripe.Checkout.Session): PaidSession | null {
  if (session.payment_status !== "paid") return null;
  const analysisId = session.metadata?.analysisId;
  const tier = session.metadata?.tier;
  if (!analysisId || (tier !== "basic" && tier !== "comprehensive")) return null;
  return { analysisId, tier, sessionId: session.id };
}
