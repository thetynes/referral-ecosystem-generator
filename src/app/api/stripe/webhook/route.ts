import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { config } from "@/lib/config";
import { getStore } from "@/lib/store";
import { getStripe, paidSessionFrom } from "@/lib/payments/stripe";

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
    if (paid) await (await getStore()).set("checkout", paid.sessionId, paid);
  }
  return NextResponse.json({ received: true });
}
