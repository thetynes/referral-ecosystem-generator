"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Check, Repeat2, Search } from "lucide-react";
import type { ScoredCategory } from "@/lib/schema";
import { TYPE_META, DIRECTION_META } from "@/lib/ui-meta";
import { PriorityBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SortKey = "score" | "name";

export function OpportunityList({
  categories,
  onSelect,
  selectedId,
}: {
  categories: ScoredCategory[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("score");
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [highOnly, setHighOnly] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rankOf = new Map(categories.map((c, i) => [c.id, i + 1]));
    return categories
      .filter((c) => !q || `${c.name} ${c.opportunity} ${c.triggers.map((t) => t.event).join(" ")}`.toLowerCase().includes(q))
      .filter((c) => !recurringOnly || c.channelType === "recurring")
      .filter((c) => !highOnly || c.priority === "High")
      .sort((a, b) => (sort === "score" ? b.score - a.score : a.name.localeCompare(b.name)))
      .map((c) => ({ c, rank: rankOf.get(c.id)! }));
  }, [categories, query, sort, recurringOnly, highOnly]);

  const toggle = (on: boolean, set: (v: boolean) => void, label: string) => (
    <button
      type="button"
      onClick={() => set(!on)}
      aria-pressed={on}
      className={cn(
        "h-8 rounded-md border px-2.5 text-[12.5px] font-medium transition-colors",
        on ? "border-ink bg-ink text-white" : "border-line-2 bg-panel text-ink-2 hover:bg-subtle",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-4" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search partners and triggers" className="h-8 pl-8 text-[13px]" aria-label="Search opportunities" />
        </div>
        {toggle(recurringOnly, setRecurringOnly, "Recurring channels")}
        {toggle(highOnly, setHighOnly, "High priority")}
        <button
          type="button"
          onClick={() => setSort(sort === "score" ? "name" : "score")}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-2 bg-panel px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-subtle"
        >
          <ArrowUpDown className="size-3.5" /> {sort === "score" ? "By priority" : "A–Z"}
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-line bg-panel md:block">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line bg-subtle/70 text-[11px] uppercase tracking-[0.06em] text-ink-3">
            <tr>
              <th className="w-10 px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Partner category</th>
              <th className="px-3 py-2 font-medium">Relationship</th>
              <th className="px-3 py-2 font-medium">Key trigger</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Priority</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, rank }) => (
              <tr
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-subtle/60", selectedId === c.id && "bg-accent-soft/60")}
                data-testid={`row-${c.id}`}
              >
                <td className="px-3 py-3 align-top font-mono text-[12px] text-ink-4">{rank}</td>
                <td className="px-3 py-3 align-top">
                  <div className="flex items-center gap-2 font-medium text-ink">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: TYPE_META[c.relationshipType].color }} />
                    {c.name}
                  </div>
                  <div className="mt-0.5 line-clamp-2 pl-4 text-[12.5px] text-ink-3">{c.opportunity}</div>
                </td>
                <td className="px-3 py-3 align-top text-[12.5px] text-ink-2">
                  <div>{TYPE_META[c.relationshipType].short}</div>
                  <div className="text-ink-3">{DIRECTION_META[c.direction].label}</div>
                  <div className="mt-0.5 flex gap-2 text-[11.5px] text-ink-3">
                    {c.channelType === "recurring" && <span className="inline-flex items-center gap-0.5"><Repeat2 className="size-3" /> recurring</span>}
                    {c.existingRelationship && <span className="inline-flex items-center gap-0.5 text-high"><Check className="size-3" /> existing</span>}
                  </div>
                </td>
                <td className="max-w-[280px] px-3 py-3 align-top text-[12.5px] text-ink-2">{c.triggers[0]?.event}</td>
                <td className="px-3 py-3 text-right align-top">
                  <PriorityBadge priority={c.priority} score={c.score} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-[13px] text-ink-3">No partner categories match these filters.</p>}
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map(({ c, rank }) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className="w-full rounded-xl border border-line bg-panel p-3.5 text-left active:bg-subtle"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-[11px] text-ink-4">{rank}</span>
                  <div>
                    <div className="text-[14px] font-medium leading-snug text-ink">{c.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-3">
                      <span className="size-1.5 rounded-full" style={{ background: TYPE_META[c.relationshipType].color }} />
                      {TYPE_META[c.relationshipType].short} · {DIRECTION_META[c.direction].label}
                    </div>
                  </div>
                </div>
                <PriorityBadge priority={c.priority} score={c.score} />
              </div>
              <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-ink-2">{c.opportunity}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
