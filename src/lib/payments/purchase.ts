import { track } from "../analytics";
import type { PaidSession } from "./stripe";

/** Record a verified purchase exactly once per Checkout Session. Test-mode payments are flagged as simulated. */
export async function recordPurchase(paid: PaidSession) {
  await track("purchase_completed", {
    analysisId: paid.analysisId,
    simulated: !paid.livemode,
    props: { tier: paid.tier, livemode: paid.livemode, amountTotal: paid.amountTotal, currency: paid.currency },
  });
}
