"use client";

import { useState } from "react";
import { Lock, Mail } from "lucide-react";
import type { Capabilities } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

export function UpgradeCard({
  analysisId,
  lockedCount,
  caps,
}: {
  analysisId: string;
  lockedCount: number;
  caps: Capabilities;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(tier: "basic" | "comprehensive") {
    setBusy(tier);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysisId, tier }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout couldn't be started. Please try again.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout couldn't be started. Please try again.");
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4" data-testid="upgrade-card">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-subtle p-2 text-ink-2"><Lock className="size-4" /></div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[14px] font-semibold text-ink">
            {lockedCount > 0 ? `${lockedCount} more partner ${lockedCount === 1 ? "type" : "types"} in your full report` : "Get your full partnership report"}
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            The full report covers every partner type with who decides, the moments that trigger referrals, and how to approach each
            one, plus a ranked action plan you can download.
            {caps.researchAvailable ? " It also lists real companies in your area for your top partner types, with sources." : ""}
          </p>
        </div>
      </div>

      {caps.paidReportsAvailable ? (
        <>
          <div className="mt-3 grid gap-2">
            <Button variant="outline" onClick={() => checkout("basic")} disabled={Boolean(busy)}>
              Basic · {formatMoney(caps.prices.basic, caps.prices.currency)}
            </Button>
            <Button onClick={() => checkout("comprehensive")} disabled={Boolean(busy)}>
              Comprehensive · {formatMoney(caps.prices.comprehensive, caps.prices.currency)}
            </Button>
          </div>
          {caps.paymentsMode === "test" && (
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
              Preview checkout: no charge is made. Use card number 4242 4242 4242 4242 with any future expiry date and any security code.
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-[12px] text-ink-3">Full reports will be available to purchase soon.</p>
      )}

      {caps.contactEmail && (
        <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-3">
          <Mail className="mt-0.5 size-3.5 shrink-0" />
          <span>Want help with research and outreach? Email <span className="select-all font-medium text-ink-2">{caps.contactEmail}</span></span>
        </p>
      )}
      {error && <p className="mt-2 text-[12px] text-[#b42318]">{error}</p>}
    </div>
  );
}
