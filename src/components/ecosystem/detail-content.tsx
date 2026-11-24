"use client";

import { AlertTriangle, ArrowRight, Check, Eye, Repeat2, UserRound } from "lucide-react";
import type { Organization, ScoredCategory } from "@/lib/schema";
import { explainScore, type Weights } from "@/lib/scoring";
import { TYPE_META, DIRECTION_META } from "@/lib/ui-meta";
import { Badge, PriorityBadge } from "@/components/ui/badge";
import { OrganizationCard } from "./organization-card";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</h3>
      <div className="text-[13.5px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export function DetailContent({
  category,
  weights,
  organizations,
}: {
  category: ScoredCategory;
  weights: Weights;
  organizations: Organization[];
}) {
  const meta = TYPE_META[category.relationshipType];
  const breakdown = explainScore(category, weights);
  return (
    <div className="space-y-5">
      <header className="space-y-2 pr-8">
        <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: meta.color }}>
          <span className="size-2 rounded-full" style={{ background: meta.color }} />
          {meta.label}
        </div>
        <h2 className="text-[19px] font-semibold leading-tight tracking-tight text-ink">{category.name}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={category.priority} score={category.score} />
          <Badge variant="outline">{DIRECTION_META[category.direction].label}</Badge>
          <Badge variant="outline">
            {category.channelType === "recurring" ? (
              <>
                <Repeat2 className="size-3" /> Potential recurring channel
              </>
            ) : (
              "Occasional referrals"
            )}
          </Badge>
          {category.overlooked && (
            <Badge variant="accent">
              <Eye className="size-3" /> Often overlooked
            </Badge>
          )}
          {category.existingRelationship && (
            <Badge variant="high">
              <Check className="size-3" /> You mentioned an existing relationship
            </Badge>
          )}
        </div>
      </header>

      <Section title="Referral opportunity">{category.opportunity}</Section>
      {category.decisionMaker && (
        <div className="flex items-start gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[13px]">
          <UserRound className="mt-0.5 size-4 shrink-0 text-ink-3" />
          <div>
            <span className="text-ink-3">Who decides: </span>
            <span className="font-medium text-ink">{category.decisionMaker}</span>
          </div>
        </div>
      )}
      <Section title="Why it makes commercial sense">{category.rationale}</Section>

      <Section title="Trigger events">
        <ol className="space-y-2.5">
          {category.triggers.map((t, i) => (
            <li key={i} className="rounded-lg border border-line bg-subtle/60 p-3">
              <div className="text-[13.5px] font-medium text-ink">{t.event}</div>
              <dl className="mt-2 grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
                <dt className="text-ink-3">Why it matters</dt>
                <dd>{t.whyNeed}</dd>
                <dt className="text-ink-3">Who notices</dt>
                <dd>{t.whoRecognizes}</dd>
                <dt className="text-ink-3">Refer when</dt>
                <dd>{t.referralMoment}</dd>
                <dt className="text-ink-3">Their gain</dt>
                <dd>{t.partnerValue}</dd>
              </dl>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Potential mutual value">{category.mutualValue}</Section>
      <Section title="Suggested partnership approach">{category.approach}</Section>

      {category.collaborationFormats.length > 0 && (
        <Section title="Collaboration formats">
          <ul className="flex flex-wrap gap-1.5">
            {category.collaborationFormats.map((f) => (
              <li key={f} className="rounded-md border border-line bg-panel px-2 py-1 text-[12.5px]">
                {f}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {category.digitalAuthority.length > 0 && (
        <Section title="Digital authority (earned, not exchanged)">
          <ul className="space-y-1">
            {category.digitalAuthority.map((d) => (
              <li key={d} className="flex gap-2">
                <ArrowRight className="mt-1 size-3 shrink-0 text-ink-4" />
                {d}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {category.regulatoryNote && (
        <div className="flex gap-2.5 rounded-lg border border-[#f5d9a8] bg-[#fff8ec] p-3 text-[12.5px] leading-relaxed text-[#6b3d00]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-medium">Regulatory consideration</div>
            {category.regulatoryNote}
          </div>
        </div>
      )}

      <Section title="Priority breakdown">
        <p className="mb-2 text-[12px] text-ink-3">
          Score {category.score}/100 is a weighted strategic heuristic based on the ratings below. All ratings are{" "}
          <strong className="font-medium">inferred</strong>, not measured. It is not a forecast of referral volume or success.
        </p>
        <ul className="space-y-2">
          {breakdown.map((b) => (
            <li key={b.key} className="grid grid-cols-[1fr_auto] items-start gap-x-3">
              <div>
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                  {b.label}
                  <span className="text-[10.5px] font-normal text-ink-4">weight {b.weight}</span>
                </div>
                <div className="text-[12px] text-ink-3">{b.rationale}</div>
              </div>
              <div className="flex items-center gap-0.5 pt-1" aria-label={`${b.score} of 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={i <= b.score ? "h-2 w-3 rounded-sm bg-ink" : "h-2 w-3 rounded-sm bg-line"} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {organizations.length > 0 && (
        <Section title={`Companies for this partner type (${organizations.length})`}>
          <div className="space-y-2">
            {organizations.map((o) => (
              <OrganizationCard key={o.id} org={o} compact />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
