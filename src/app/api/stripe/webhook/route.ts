import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { config } from "@/lib/config";
import { getStore } from "@/lib/store";
import { getStripe, paidSessionFrom, type PaidSession } from "@/lib/payments/stripe";
import { recordPurchase } from "@/lib/payments/purchase";

export const runtime = "nodejs";

/** Stripe webhook: verifies the signature, then records paid Checkout Sessions. */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = config().payments.stripeWebhookSecret;
  if (!stripe || !secret) return NextResponse.json({ error: "Payments not configured." }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const paid = paidSessionFrom(event.data.object as Stripe.Checkout.Session);
    if (paid) {
      const store = await getStore();
      const already = await store.get<PaidSession>("checkout", paid.sessionId);
      await store.set("checkout", paid.sessionId, paid);
      if (!already) await recordPurchase(paid);
    }
  }
  return NextResponse.json({ received: true });
}

