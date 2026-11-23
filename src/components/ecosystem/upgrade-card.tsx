"use client";

import { useState } from "react";
import { Lock, FlaskConical, Mail } from "lucide-react";
import type { Capabilities } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

export function UpgradeCard({
  analysisId,
  lockedCount,
  caps,
  onUnlocked,
}: {
  analysisId: string;
  lockedCount: number;
  caps: Capabilities;
  onUnlocked: (token: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(tier: "basic" | "comprehensive") {
    setBusy(tier);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysisId, tier }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
      setBusy(null);
    }
  }

  async function devUnlock(tier: "basic" | "comprehensive") {
    setBusy(`dev-${tier}`);
    setError(null);
    try {
      const res = await fetch("/api/dev/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysisId, tier }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unlock failed.");
      onUnlocked(data.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4" data-testid="upgrade-card">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-subtle p-2 text-ink-2"><Lock className="size-4" /></div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[14px] font-semibold text-ink">
            {lockedCount > 0 ? `${lockedCount} more partner ${lockedCount === 1 ? "category" : "categories"} identified` : "Go from categories to named organisations"}
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            The full report unlocks every category, source-backed research on real organisations in your market, the ranked action plan,
            and PDF/CSV exports.
          </p>
        </div>
      </div>

      {caps.paidReportsAvailable ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={() => checkout("basic")} disabled={Boolean(busy)}>
            Basic report · {formatMoney(caps.prices.basic, caps.prices.currency)}
          </Button>
          <Button onClick={() => checkout("comprehensive")} disabled={Boolean(busy)}>
            Comprehensive · {formatMoney(caps.prices.comprehensive, caps.prices.currency)}
          </Button>
        </div>
      ) : (
        <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-[12px] text-ink-3">
          Paid reports are not available on this deployment yet. They are only offered when payments and a business-research data
          source are both configured.
        </p>
      )}

      {caps.contactEmail && (
        <a href={`mailto:${caps.contactEmail}?subject=Advanced%20research%20and%20execution`} className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-accent">
          <Mail className="size-3.5" /> Advanced research & execution: request a quote
        </a>
      )}

      {caps.devMode && (
        <div className="mt-3 rounded-md border border-dashed border-[#e3b65b] bg-[#fffaf0] p-2.5">
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#7a4a00]">
            <FlaskConical className="size-3.5" /> Development mode: unlock without payment (testing only)
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => devUnlock("basic")} disabled={Boolean(busy)} data-testid="dev-unlock-basic">Basic</Button>
            <Button size="sm" variant="outline" onClick={() => devUnlock("comprehensive")} disabled={Boolean(busy)} data-testid="dev-unlock-comprehensive">Comprehensive</Button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-[#b42318]">{error}</p>}
    </div>
  );
}
