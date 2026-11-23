"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, FileSpreadsheet } from "lucide-react";
import type { AnalysisView, Organization } from "@/lib/schema";
import { CRITERIA } from "@/lib/schema";
import { CRITERION_META, WEIGHT_PRESETS, presetForGrowthPriority, rankCategories, type Weights } from "@/lib/scoring";
import { TYPE_META, DIRECTION_META } from "@/lib/ui-meta";
import { actionPlan, executiveOverview, firstSentence } from "@/lib/narrative";
import { clientStore } from "@/lib/client-store";
import { downloadText, opportunitiesCsv, organizationsCsv, slugify } from "@/lib/export";
import { StaticDiagram } from "@/components/ecosystem/static-diagram";
import { OrganizationCard } from "@/components/ecosystem/organization-card";
import { PriorityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function H2({ n, children, kind }: { n: number; children: React.ReactNode; kind?: "evidence" | "strategy" | "assumption" }) {
  const tag = kind === "evidence" ? "Evidence-backed" : kind === "strategy" ? "Strategic recommendation" : kind === "assumption" ? "Requires validation" : null;
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-2">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">
        <span className="mr-2 font-mono text-[12px] text-ink-4">{String(n).padStart(2, "0")}</span>
        {children}
      </h2>
      {tag && <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-4">{tag}</span>}
    </div>
  );
}

export function ReportView({ id }: { id: string }) {
  const [view, setView] = useState<AnalysisView | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [weights, setWeights] = useState<Weights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tok = clientStore.getEntitlement(id);
    const headers: Record<string, string> = tok ? { "x-entitlement": tok } : {};
    (async () => {
      let v: AnalysisView | null = null;
      const res = await fetch(`/api/analysis/${id}`, { headers }).catch(() => null);
      if (res?.ok) v = await res.json();
      else v = clientStore.getAnalysis(id);
      if (!v) {
        setError("This analysis could not be found.");
        return;
      }
      setView(v);
      const saved = clientStore.getWeights(id);
      setWeights(saved?.weights ?? WEIGHT_PRESETS[presetForGrowthPriority(v.profile.growthPriority)].weights);
      const imported = clientStore.getImportedOrgs(id);
      let discovered: Organization[] = [];
      if (tok && v.access.tier !== "free" && !v.isDemo) {
        const d = await fetch(`/api/discover?analysisId=${id}`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        discovered = d?.organizations ?? [];
      }
      setOrgs([...discovered, ...imported]);
    })();
  }, [id]);

  const ranked = useMemo(() => (view && weights ? rankCategories(view.categories, weights) : []), [view, weights]);

  if (error) return <p className="py-24 text-center text-sm text-ink-3">{error}</p>;
  if (!view || !weights) return <p className="py-24 text-center text-sm text-ink-3">Preparing report…</p>;

  const plan = actionPlan(ranked, 10);
  const overview = executiveOverview(view, ranked);
  const shared = ranked.filter((c) => c.collaborationFormats.length > 0);
  const seo = ranked.filter((c) => c.digitalAuthority.length > 0);
  const nameOf = (cid: string) => ranked.find((c) => c.id === cid)?.name ?? cid;
  const date = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const tierLabel = view.isDemo ? "Illustrative example" : view.access.tier === "free" ? "Free summary" : view.access.tier === "basic" ? "Basic Opportunity Report" : "Comprehensive Partnership Report";

  return (
    <div className="mx-auto max-w-[860px] px-4 pb-20 sm:px-8">
      <div className="no-print sticky top-0 z-10 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <Button variant="ghost" size="sm" asChild><Link href={`/ecosystem/${id}`}><ArrowLeft /> Back to workspace</Link></Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadText(`${slugify(view.profile.displayName)}-opportunities.csv`, opportunitiesCsv(ranked))}><FileSpreadsheet /> Opportunities CSV</Button>
          {orgs.length > 0 && <Button variant="outline" size="sm" onClick={() => downloadText(`${slugify(view.profile.displayName)}-organisations.csv`, organizationsCsv(orgs, nameOf))}><FileSpreadsheet /> Organisations CSV</Button>}
          <Button size="sm" onClick={() => window.print()} data-testid="print-report"><Printer /> Save as PDF</Button>
        </div>
      </div>

      <article className="space-y-10 text-[13.5px] leading-relaxed text-ink-2">
        <header className="space-y-3 border-b-2 border-ink pb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{tierLabel}</div>
          <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink">Partnership Opportunity Report</h1>
          <div className="text-[16px] text-ink">{view.profile.displayName}</div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-ink-3">
            <span>{view.profile.industry}</span>
            <span>{view.profile.serviceArea}</span>
            <span>{date}</span>
            <span>
              {view.engine.mode === "ai" ? `AI analysis (${view.engine.model})` : view.engine.mode === "demo" ? "Illustrative dataset" : `Curated profile: ${view.engine.archetypeLabel}`}
            </span>
          </div>
          {view.isDemo && (
            <p className="rounded-md border border-[#f5d9a8] bg-[#fff8ec] px-3 py-2 text-[12.5px] text-[#6b3d00]">
              This is an illustrative example for a hypothetical business. It is not live research and names no real organisations.
            </p>
          )}
          <div className="grid gap-2 pt-2 text-[12px] sm:grid-cols-3">
            <div className="rounded-md bg-subtle p-2.5"><span className="font-semibold text-ink">Evidence-backed</span>: facts tied to a cited source (researched organisations only).</div>
            <div className="rounded-md bg-subtle p-2.5"><span className="font-semibold text-ink">Strategic recommendation</span>: reasoned guidance, not verified fact.</div>
            <div className="rounded-md bg-subtle p-2.5"><span className="font-semibold text-ink">Requires validation</span>: assumptions to test in real conversations.</div>
          </div>
        </header>

        <section className="avoid-break">
          <H2 n={1} kind="strategy">Executive overview</H2>
          <div className="space-y-2.5">{overview.map((p) => <p key={p}>{p}</p>)}</div>
          {view.access.lockedCategoryCount > 0 && (
            <p className="mt-3 text-[12.5px] text-ink-3">This free summary covers the top {view.categories.length} partner categories. {view.access.lockedCategoryCount} additional categories are included in the full report.</p>
          )}
        </section>

        <section className="avoid-break">
          <H2 n={2} kind="strategy">Referral ecosystem map</H2>
          <div className="rounded-lg border border-line bg-panel p-3"><StaticDiagram profile={view.profile} categories={ranked} /></div>
          <p className="mt-2 text-[11.5px] text-ink-3">Solid lines mark potential recurring channels and dashed lines mark occasional referrals. Heavier lines indicate higher priority.</p>
        </section>

        <section>
          <H2 n={3} kind="strategy">Priority partner categories</H2>
          <ol className="space-y-3">
            {ranked.map((c, i) => (
              <li key={c.id} className="avoid-break rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium text-ink"><span className="mr-2 font-mono text-[11px] text-ink-4">{i + 1}</span>{c.name}</div>
                  <PriorityBadge priority={c.priority} score={c.score} />
                </div>
                <div className="mt-0.5 text-[12px] text-ink-3">
                  {TYPE_META[c.relationshipType].label} · {DIRECTION_META[c.direction].label} · {c.channelType === "recurring" ? "potential recurring channel" : "occasional referrals"}
                  {c.existingRelationship ? " · existing relationship" : ""}
                </div>
                <p className="mt-1.5">{c.opportunity}</p>
                <p className="mt-1 text-ink-3"><span className="font-medium text-ink-2">Why: </span>{c.rationale}</p>
                {c.regulatoryNote && <p className="mt-1 text-[12.5px] text-[#6b3d00]"><span className="font-medium">Regulatory: </span>{c.regulatoryNote}</p>}
              </li>
            ))}
          </ol>
        </section>

        <section>
          <H2 n={4} kind="strategy">Referral trigger analysis</H2>
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="text-[10.5px] uppercase tracking-[0.06em] text-ink-3">
              <tr className="border-b border-line">
                <th className="py-1.5 pr-2 font-medium">Event</th><th className="py-1.5 pr-2 font-medium">Why it creates need</th><th className="py-1.5 pr-2 font-medium">Who notices</th><th className="py-1.5 font-medium">Refer when</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 8).flatMap((c) => c.triggers.map((t, i) => (
                <tr key={`${c.id}-${i}`} className="avoid-break border-b border-line align-top">
                  <td className="py-2 pr-2"><div className="font-medium text-ink">{t.event}</div><div className="text-[11px] text-ink-4">{c.name}</div></td>
                  <td className="py-2 pr-2">{t.whyNeed}</td>
                  <td className="py-2 pr-2">{t.whoRecognizes}</td>
                  <td className="py-2">{t.referralMoment}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </section>

        <section className="print-break">
          <H2 n={5} kind="evidence">Researched organisations</H2>
          {orgs.length > 0 ? (
            <>
              <p className="mb-3 text-[12.5px] text-ink-3">
                Each organisation records its source and which fields are verified, inferred, or unknown. A verified business is not a
                verified or willing referral partner. Each one is a candidate to research further before contact.
              </p>
              <div className="space-y-4">
                {ranked.map((c) => {
                  const list = orgs.filter((o) => o.categoryId === c.id);
                  if (!list.length) return null;
                  return (
                    <div key={c.id}>
                      <h3 className="mb-2 text-[13px] font-semibold text-ink">{c.name}</h3>
                      <div className="grid gap-2 sm:grid-cols-2">{list.map((o) => <div key={o.id} className="avoid-break"><OrganizationCard org={o} /></div>)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-ink-3">
              No organisations have been researched or imported for this analysis. Named-organisation research is part of the paid report and
              requires a configured business-data provider. You can also import your own CSV list from the workspace.
            </p>
          )}
        </section>

        <section>
          <H2 n={6} kind="strategy">Mutual value propositions</H2>
          <ul className="space-y-2">{ranked.slice(0, 10).map((c) => <li key={c.id} className="avoid-break"><span className="font-medium text-ink">{c.name}: </span>{c.mutualValue}</li>)}</ul>
        </section>

        <section>
          <H2 n={7} kind="strategy">Recommended engagement strategies</H2>
          <ul className="space-y-2">{ranked.slice(0, 10).map((c) => <li key={c.id} className="avoid-break"><span className="font-medium text-ink">{c.name}: </span>{c.approach}</li>)}</ul>
        </section>

        {shared.length > 0 && (
          <section>
            <H2 n={8} kind="strategy">Shared-audience opportunities</H2>
            <ul className="space-y-1.5">{shared.map((c) => <li key={c.id}><span className="font-medium text-ink">{c.name}: </span>{c.collaborationFormats.join(" · ")}</li>)}</ul>
          </section>
        )}

        <section>
          <H2 n={9} kind="strategy">SEO & digital authority</H2>
          <p className="mb-2">
            Links and mentions should come from genuinely useful collaboration, such as co-authored resources, expert contributions, and
            directory or member listings you qualify for. Paid links and link exchanges violate search engine policies and are not recommended.
            No ranking outcome is implied.
          </p>
          {seo.length > 0 ? <ul className="list-disc space-y-1 pl-5">{seo.flatMap((c) => c.digitalAuthority.map((d) => <li key={c.id + d}>{d} <span className="text-ink-4">({c.name})</span></li>))}</ul> : <p className="text-ink-3">No category-specific opportunities were identified.</p>}
        </section>

        <section className="avoid-break">
          <H2 n={10} kind="strategy">Initial action plan: top {plan.length} opportunities to investigate</H2>
          <ol className="space-y-2">
            {plan.map((a) => (
              <li key={a.categoryId} className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono text-[12px] text-ink-4">{a.rank}.</span>
                <div>
                  <div className="font-medium text-ink">{a.name} <span className="font-normal text-ink-3">· {a.priority} ({a.score}){a.channelType === "recurring" ? " · recurring potential" : ""}</span></div>
                  <div><span className="text-ink-3">First step: </span>{a.firstStep}</div>
                  <div><span className="text-ink-3">Watch for: </span>{firstSentence(a.watchFor)}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="avoid-break">
          <H2 n={11} kind="assumption">Assumptions requiring validation</H2>
          <ul className="list-disc space-y-1.5 pl-5">
            {view.assumptions.map((a) => <li key={a}>{a}</li>)}
            <li>Every criterion rating in this report is a strategic inference, not a measurement. Referral volumes, conversion rates and contract values were not estimated.</li>
          </ul>
        </section>

        <section className="avoid-break">
          <H2 n={12}>Guardrails</H2>
          <ul className="space-y-2">{view.guardrails.map((g) => <li key={g.title}><span className="font-medium text-ink">{g.title}. </span>{g.body}</li>)}</ul>
        </section>

        <section className="avoid-break text-[12px] text-ink-3">
          <H2 n={13}>Methodology</H2>
          <p>
            Priority scores are weighted averages of nine 1–5 ratings, normalised to 0–100 (High ≥ 70, Medium ≥ 52). Weights used:{" "}
            {CRITERIA.map((k) => `${CRITERION_META[k].label} ${weights[k]}`).join(", ")}.
          </p>
        </section>
      </article>
    </div>
  );
}
