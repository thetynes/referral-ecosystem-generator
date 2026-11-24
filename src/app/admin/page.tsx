import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ADMIN_COOKIE, isAdmin } from "@/lib/beta";
import { config, capabilities } from "@/lib/config";
import { recentEvents, summarize } from "@/lib/analytics";
import { spendSummary } from "@/lib/ai-budget";
import { getStore } from "@/lib/store";
import { Logo } from "@/components/site/header";
import { AdminLogin } from "./admin-login";
import { AdminGrant, AdminSignOut } from "./admin-tools";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const FUNNEL = [
  ["intake_started", "Intake started"],
  ["intake_completed", "Intake submitted"],
  ["map_generated", "Maps generated"],
  ["relationship_explored", "Relationships explored"],
  ["report_requested", "Reports opened"],
  ["report_printed", "Reports saved as PDF"],
  ["export_downloaded", "Exports downloaded"],
  ["upgrade_viewed", "Upgrade offer seen"],
  ["checkout_started", "Checkouts started"],
  ["purchase_completed", "Purchases completed"],
  ["discovery_run", "Company searches run"],
  ["ai_run", "AI analyses run"],
  ["ai_fallback", "AI fallbacks / limits"],
  ["server_error", "Server errors"],
  ["admin_grant", "Demo links issued"],
] as const;

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {note && <p className="mt-0.5 text-[12.5px] text-ink-3">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ k, v, state }: { k: string; v: React.ReactNode; state?: "ok" | "warn" | "off" }) {
  const dot = state === "ok" ? "bg-high" : state === "warn" ? "bg-[#d18a00]" : state === "off" ? "bg-ink-4" : "bg-transparent";
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-3 border-t border-line px-3 py-2 first:border-t-0">
      <dt className="flex items-center gap-2 text-ink-3"><span className={`size-1.5 rounded-full ${dot}`} />{k}</dt>
      <dd className="min-w-0 break-words font-medium">{v}</dd>
    </div>
  );
}

async function storeHealth(): Promise<{ ok: boolean; detail: string }> {
  try {
    const store = await getStore();
    const key = `health-${Date.now()}`;
    await store.set("checkout", key, { ok: true }, 60);
    const back = await store.get<{ ok: boolean }>("checkout", key);
    return back?.ok ? { ok: true, detail: "read/write OK" } : { ok: false, detail: "write succeeded but read failed" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message.slice(0, 160) : "unknown error" };
  }
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const c = config();
  if (!c.beta.adminKey) notFound();
  const jar = await cookies();
  if (!(await isAdmin(jar.get(ADMIN_COOKIE)?.value))) {
    return (
      <main className="mx-auto max-w-sm px-4 py-24">
        <Logo />
        <h1 className="mt-6 text-lg font-semibold">Administration</h1>
        <AdminLogin />
      </main>
    );
  }

  const days = Math.min(365, Math.max(1, Number((await searchParams).days) || 30));
  const [s, spend, health, diag] = await Promise.all([
    summarize(days),
    spendSummary(),
    storeHealth(),
    recentEvents(["server_error", "ai_fallback", "discovery_run"], 25, days),
  ]);
  const caps = capabilities();
  const count = (name: string) => s.counts.find((x) => x.name === name) ?? { real: 0, simulated: 0 };
  const usd = (n: number) => `$${n.toFixed(2)}`;
  const set = (v: unknown) => (v ? "set" : "missing");

  const checklist: { label: string; done: boolean; hint: string }[] = [
    { label: "Persistent database", done: c.store.driver === "postgres" && health.ok, hint: "Set DATABASE_URL to the Supabase pooler URI." },
    { label: "Invite-only access", done: c.beta.enabled && c.beta.invites.length > 0, hint: "Set BETA_MODE=true and BETA_INVITES." },
    { label: "Signing secrets", done: Boolean(process.env.BETA_SECRET && process.env.ENTITLEMENT_SECRET), hint: "Set BETA_SECRET and ENTITLEMENT_SECRET." },
    { label: "Payments (test mode)", done: caps.paymentsMode === "test", hint: "Set STRIPE_SECRET_KEY (sk_test_…) and STRIPE_WEBHOOK_SECRET." },
    { label: "Company research", done: caps.researchAvailable, hint: "Set GOOGLE_PLACES_API_KEY and COMPANY_RESEARCH_ENABLED=true after reviewing provider terms." },
    { label: "Development mode off", done: !c.devMode, hint: "Unset DEV_MODE on deployed environments." },
  ];

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 text-[13.5px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Logo />
          <h1 className="mt-5 text-[22px] font-semibold tracking-tight">Administration</h1>
          <p className="mt-1 text-ink-3">
            Private. Environment <strong>{c.appEnv}</strong> · last {days} days · {new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
          </p>
        </div>
        <AdminSignOut />
      </header>

      <Section title="Setup checklist">
        <ul className="grid gap-2 sm:grid-cols-2">
          {checklist.map((i) => (
            <li key={i.label} className="flex gap-2 rounded-lg border border-line bg-panel p-3">
              <span className={`mt-1 size-2 shrink-0 rounded-full ${i.done ? "bg-high" : "bg-[#d18a00]"}`} />
              <div>
                <div className="font-medium">{i.label} · {i.done ? "ready" : "needs action"}</div>
                {!i.done && <div className="text-[12.5px] text-ink-3">{i.hint}</div>}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Configuration" note="Values come from environment variables. Secrets are shown only as set or missing.">
        <div className="grid gap-4 md:grid-cols-2">
          <dl className="rounded-lg border border-line bg-panel">
            <Row k="AI provider" v={caps.aiProvider ? `${caps.aiProvider} · ${caps.aiModel}` : "none (industry playbooks only)"} state={caps.aiProvider ? "ok" : "off"} />
            <Row k="AI access" v={c.llm.access} />
            <Row k="Reasoning effort" v={c.llm.effort} />
            <Row k="AI caps" v={`${usd(c.llm.dailyBudgetUsd)}/day · ${usd(c.llm.monthlyBudgetUsd)}/month · ${c.llm.perTesterDailyRuns} runs/tester/day`} />
            <Row k="AI fallback" v={c.llm.fallback} />
            <Row k="Token prices used" v={`$${c.llm.priceInputPerMTok} in / $${c.llm.priceOutputPerMTok} out per MTok`} />
          </dl>
          <dl className="rounded-lg border border-line bg-panel">
            <Row k="Payments" v={caps.paymentsMode ? `Stripe ${caps.paymentsMode} mode` : c.payments.liveKeyBlocked ? "live key blocked (set STRIPE_ALLOW_LIVE to permit)" : "not configured"} state={caps.paymentsMode === "test" ? "ok" : caps.paymentsMode === "live" ? "warn" : "off"} />
            <Row k="Prices" v={`${c.payments.currency.toUpperCase()} ${(c.payments.basicCents / 100).toFixed(0)} / ${(c.payments.comprehensiveCents / 100).toFixed(0)}`} />
            <Row k="Company research" v={caps.researchAvailable ? `on · ${caps.discoveryProvider}` : c.discovery.researchEnabled ? "enabled but no provider key" : "off"} state={caps.researchAvailable ? "ok" : "off"} />
            <Row k="Google in downloads" v={c.discovery.googleInExports ? "included" : "excluded (view in app only)"} />
            <Row k="Result retention" v={`${c.discovery.retentionDays} days`} />
            <Row k="Database" v={`${c.store.driver} · ${health.detail}`} state={health.ok ? "ok" : "warn"} />
            <Row k="Invites" v={`${c.beta.enabled ? "required" : "not required"} · ${c.beta.invites.length} active`} state={c.beta.enabled ? "ok" : "warn"} />
            <Row k="Secrets" v={`beta ${set(process.env.BETA_SECRET)} · entitlement ${set(process.env.ENTITLEMENT_SECRET)} · webhook ${set(c.payments.stripeWebhookSecret)}`} />
            <Row k="Development mode" v={c.devMode ? "ON (all activity counted as simulated)" : "off"} state={c.devMode ? "warn" : "ok"} />
          </dl>
        </div>
      </Section>

      <Section title="Demo access" note="Unlock a full report for a business you are demonstrating to, without payment. Links are counted as simulated activity.">
        <AdminGrant />
      </Section>

      <Section title="Funnel" note="Real excludes development mode, the example ecosystem, demo links and Stripe test-mode purchases, which are counted as simulated.">
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full border-collapse">
            <thead className="bg-subtle text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
              <tr><th className="px-3 py-2">Event</th><th className="px-3 py-2 text-right">Real</th><th className="px-3 py-2 text-right">Simulated</th></tr>
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
        </div>
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title="Testers">
          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full border-collapse">
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
        </Section>
        <Section title="AI spend (estimated)" note="Estimates use the configured token prices. Reconcile with the provider's billing page.">
          <dl className="rounded-lg border border-line bg-panel">
            <Row k="Today" v={`${usd(spend.today.usd)} of ${usd(spend.dailyBudgetUsd)} · ${spend.today.runs} runs`} />
            <Row k="This month" v={`${usd(spend.month.usd)} of ${usd(spend.monthlyBudgetUsd)} · ${spend.month.runs} runs`} />
            <Row k="Tokens this month" v={`${spend.month.inputTokens.toLocaleString()} in · ${spend.month.outputTokens.toLocaleString()} out`} />
          </dl>
        </Section>
      </div>

      <Section title="Diagnostics" note="Recent server errors, AI fallbacks and company searches. Full details are in the hosting provider's logs.">
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[640px] border-collapse">
            <thead className="bg-subtle text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
              <tr><th className="px-3 py-2">When (UTC)</th><th className="px-3 py-2">Event</th><th className="px-3 py-2">Tester</th><th className="px-3 py-2">Details</th></tr>
            </thead>
            <tbody>
              {diag.length === 0 && <tr><td className="px-3 py-3 text-ink-3" colSpan={4}>Nothing to report.</td></tr>}
              {diag.map((e, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-mono text-[12px]">{e.ts.slice(0, 16).replace("T", " ")}</td>
                  <td className="px-3 py-2">{e.name}{e.simulated ? <span className="text-ink-4"> · sim</span> : null}</td>
                  <td className="px-3 py-2">{e.tester ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-ink-2">{Object.entries(e.props).map(([k, v]) => `${k}=${v}`).join("  ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
