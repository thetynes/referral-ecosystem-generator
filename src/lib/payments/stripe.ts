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

export function tierInfo(tier: Tier): { name: string; description: string } {
  const research = config().discovery.researchEnabled;
  if (tier === "basic") {
    return {
      name: "Basic Opportunity Report",
      description: research
        ? "Full partner-category analysis, named-organisation research for your top 5 categories, and PDF/CSV exports."
        : "Every partner category with decision-makers, triggers and engagement approach, the ranked action plan, and PDF/CSV exports.",
    };
  }
  return {
    name: "Comprehensive Partnership Report",
    description: research
      ? "Everything in Basic, plus named-organisation research across all partner categories."
      : "Everything in Basic, plus shared-audience and digital-authority opportunities for every category.",
  };
}

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
          product_data: tierInfo(tier),
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
  /** false for Stripe test-mode payments (simulated transactions). */
  livemode: boolean;
  amountTotal: number | null;
  currency: string | null;
}

/** Extract a verified paid entitlement from a Checkout Session object. */
export function paidSessionFrom(session: Stripe.Checkout.Session): PaidSession | null {
  if (session.payment_status !== "paid") return null;
  const analysisId = session.metadata?.analysisId;
  const tier = session.metadata?.tier;
  if (!analysisId || (tier !== "basic" && tier !== "comprehensive")) return null;
  return {
    analysisId,
    tier,
    sessionId: session.id,
    livemode: Boolean(session.livemode),
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? null,
  };
}
