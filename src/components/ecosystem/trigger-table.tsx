"use client";

import type { ScoredCategory } from "@/lib/schema";
import { TYPE_META } from "@/lib/ui-meta";

export function TriggerTable({ categories, onSelect }: { categories: ScoredCategory[]; onSelect: (id: string) => void }) {
  const rows = categories.flatMap((c) => c.triggers.map((t, i) => ({ c, t, key: `${c.id}-${i}` })));
  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-[13px] leading-relaxed text-ink-3">
        Referrals happen at specific moments. Each row follows one event: what happens to the customer, why it creates a need for your
        services, who is in a position to notice, when an introduction is most useful, and what the referring organisation gains.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full min-w-[880px] text-left text-[12.5px]">
          <thead className="border-b border-line bg-subtle/70 text-[11px] uppercase tracking-[0.06em] text-ink-3">
            <tr>
              <th className="px-3 py-2 font-medium">Trigger event</th>
              <th className="px-3 py-2 font-medium">Why it creates a need</th>
              <th className="px-3 py-2 font-medium">Who notices</th>
              <th className="px-3 py-2 font-medium">Best moment to refer</th>
              <th className="px-3 py-2 font-medium">Value to the referrer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, t, key }) => (
              <tr key={key} className="border-b border-line align-top last:border-0">
                <td className="px-3 py-3">
                  <div className="font-medium text-ink">{t.event}</div>
                  <button type="button" onClick={() => onSelect(c.id)} className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] text-ink-3 hover:text-accent">
                    <span className="size-1.5 rounded-full" style={{ background: TYPE_META[c.relationshipType].color }} />
                    {c.name}
                  </button>
                </td>
                <td className="px-3 py-3 text-ink-2">{t.whyNeed}</td>
                <td className="px-3 py-3 text-ink-2">{t.whoRecognizes}</td>
                <td className="px-3 py-3 text-ink-2">{t.referralMoment}</td>
                <td className="px-3 py-3 text-ink-2">{t.partnerValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
