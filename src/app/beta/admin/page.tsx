import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ADMIN_COOKIE, isAdmin } from "@/lib/beta";
import { config, capabilities } from "@/lib/config";
import { summarize } from "@/lib/analytics";
import { spendSummary } from "@/lib/ai-budget";
import { Logo } from "@/components/site/header";
import { AdminLogin } from "./admin-login";

export const metadata: Metadata = { title: "Beta admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const FUNNEL = [
  ["intake_started", "Intake started"],
  ["intake_completed", "Intake submitted"],
  ["map_generated", "Maps generated"],
  ["relationship_explored", "Relationships explored"],
  ["report_requested", "Reports opened"],
  ["report_printed", "Reports printed / saved as PDF"],
  ["export_downloaded", "Exports downloaded"],
  ["upgrade_viewed", "Upgrade offer seen"],
  ["checkout_started", "Checkouts started"],
  ["purchase_completed", "Purchases completed"],
  ["ai_run", "AI analyses run"],
  ["ai_fallback", "AI fallbacks to curated"],
  ["dev_unlock", "Dev unlocks"],
] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const c = config();
  if (!c.beta.adminKey) notFound();
  const jar = await cookies();
  if (!(await isAdmin(jar.get(ADMIN_COOKIE)?.value))) {
    return (
      <main className="mx-auto max-w-sm px-4 py-24">
        <Logo />
        <h1 className="mt-6 text-lg font-semibold">Beta admin</h1>
        <AdminLogin />
      </main>
    );
  }
  const days = Math.min(365, Math.max(1, Number((await searchParams).days) || 30));
  const [s, spend] = await Promise.all([summarize(days), spendSummary()]);
  const caps = capabilities();
  const count = (name: string) => s.counts.find((x) => x.name === name) ?? { real: 0, simulated: 0 };
  const usd = (n: number) => `$${n.toFixed(2)}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-[13.5px]">
      <Logo />
      <h1 className="mt-6 text-[22px] font-semibold tracking-tight">Beta dashboard</h1>
      <p className="mt-1 text-ink-3">
        Last {days} days · environment <strong>{c.appEnv}</strong>. <span className="font-medium">Real</span> excludes development mode,
        demo views, dev unlocks, and Stripe test-mode payments, which are counted as <span className="font-medium">simulated</span>.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ["AI provider", caps.aiProvider ? `${caps.aiProvider} · ${caps.aiModel}` : "none (curated only)"],
          ["AI access", c.llm.access],
          ["Payments", caps.paymentsMode ? `Stripe ${caps.paymentsMode} mode` : c.payments.liveKeyBlocked ? "Live key blocked" : "not configured"],
          ["Company research", caps.researchAvailable ? "enabled" : "disabled (licensing)"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-panel p-3">
            <div className="text-[11px] uppercase tracking-[0.08em] text-ink-3">{k}</div>
            <div className="mt-1 font-medium">{v}</div>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">Funnel</h2>
        <table className="mt-3 w-full border-collapse overflow-hidden rounded-lg border border-line bg-panel">
          <thead className="bg-subtle text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
            <tr><th className="px-3 py-2">Event</th><th className="px-3 py-2 text-right">Real</th><th className="px-3 py-2 text-right">Simulated / dev</th></tr>
          </thead>
          <tbody>
            {FUNNEL.map(([key, label]) => (
              <tr key={key} className="border-t border-line">
                <td className="px-3 py-2">{label}</td>
                <td className="px-3 py-2 text-right font-mono">{count(key).real}</td>
                <td className="px-3 py-2 text-right font-mono text-ink-3">{count(key).simulated}</td>
              </tr>
            ))}
            <tr className="border-t border-line bg-subtle/50">
              <td className="px-3 py-2">Unique sessions</td>
              <td className="px-3 py-2 text-right font-mono">{s.uniqueSessions.real}</td>
              <td className="px-3 py-2 text-right font-mono text-ink-3">{s.uniqueSessions.simulated}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-[15px] font-semibold">Testers</h2>
          <table className="mt-3 w-full border-collapse rounded-lg border border-line bg-panel">
            <thead className="bg-subtle text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
              <tr><th className="px-3 py-2">Invite</th><th className="px-3 py-2 text-right">Maps</th><th className="px-3 py-2 text-right">Explored</th><th className="px-3 py-2 text-right">Reports</th></tr>
            </thead>
            <tbody>
              {s.testers.length === 0 && <tr><td className="px-3 py-3 text-ink-3" colSpan={4}>No tester activity yet.</td></tr>}
              {s.testers.map((t) => (
                <tr key={t.tester} className="border-t border-line">
                  <td className="px-3 py-2">{t.tester}</td>
                  <td className="px-3 py-2 text-right font-mono">{t.maps}</td>
                  <td className="px-3 py-2 text-right font-mono">{t.explored}</td>
                  <td className="px-3 py-2 text-right font-mono">{t.reports}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="text-[15px] font-semibold">AI spend (estimated)</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-line bg-panel p-3">
            <dt className="text-ink-3">Today</dt><dd className="font-mono">{usd(spend.today.usd)} / {usd(spend.dailyBudgetUsd)} · {spend.today.runs} runs</dd>
            <dt className="text-ink-3">This month</dt><dd className="font-mono">{usd(spend.month.usd)} / {usd(spend.monthlyBudgetUsd)} · {spend.month.runs} runs</dd>
            <dt className="text-ink-3">Tokens (month)</dt><dd className="font-mono">{spend.month.inputTokens.toLocaleString()} in · {spend.month.outputTokens.toLocaleString()} out</dd>
            <dt className="text-ink-3">Prices used</dt><dd className="font-mono">${spend.pricing.inputPerMTok}/${spend.pricing.outputPerMTok} per MTok</dd>
          </dl>
          <p className="mt-2 text-[12px] text-ink-3">Estimates use the configured per-token prices. Reconcile with the provider's billing dashboard.</p>
        </div>
      </section>
    </main>
  );
}
