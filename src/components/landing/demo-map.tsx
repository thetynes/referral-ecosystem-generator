"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import type { RelationshipType } from "@/lib/schema";
import { getDemoAnalysis } from "@/lib/demo";
import { rankCategories, WEIGHT_PRESETS } from "@/lib/scoring";
import { TYPE_META, TYPE_ORDER, DIRECTION_META } from "@/lib/ui-meta";
import { EcosystemMap, MapLegend } from "@/components/ecosystem/ecosystem-map";
import { PriorityBadge } from "@/components/ui/badge";

export function DemoMap() {
  const demo = getDemoAnalysis();
  const allRanked = useMemo(() => rankCategories(demo.categories, WEIGHT_PRESETS.recurring.weights), [demo]);
  // Show a readable subset on the landing page; the full example has every category.
  const ranked = useMemo(() => allRanked.slice(0, 10), [allRanked]);
  const [selectedId, setSelectedId] = useState<string | null>("property-managers");
  const [collapsed, setCollapsed] = useState<Set<RelationshipType>>(new Set());
  const visible = useMemo(() => new Set(TYPE_ORDER), []);
  const toggle = useCallback((t: RelationshipType) => setCollapsed((p) => {
    const n = new Set(p);
    if (n.has(t)) n.delete(t);
    else n.add(t);
    return n;
  }), []);
  const selected = ranked.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_24px_60px_-30px_rgba(14,17,22,0.25)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2 text-[12px] text-ink-3">
          <Info className="size-3.5" /> Illustrative example: a hypothetical excavation contractor in Sarnia, Ontario. Not live research. Showing {ranked.length} of {allRanked.length} categories.
        </div>
        <Link href="/ecosystem/demo" className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
          Open full example <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[440px] sm:h-[580px]">
          <EcosystemMap
            profile={demo.profile}
            categories={ranked}
            visibleTypes={visible}
            collapsed={collapsed}
            onToggleCollapse={toggle}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div className="border-t border-line p-4 lg:border-l lg:border-t-0">
          {selected ? (
            <div className="space-y-3 text-[12.5px] leading-relaxed text-ink-2">
              <div className="flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: TYPE_META[selected.relationshipType].color }}>
                <span className="size-2 rounded-full" style={{ background: TYPE_META[selected.relationshipType].color }} />
                {TYPE_META[selected.relationshipType].label}
              </div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-semibold leading-snug text-ink">{selected.name}</h3>
                <PriorityBadge priority={selected.priority} score={selected.score} />
              </div>
              <div className="text-[11.5px] text-ink-3">{DIRECTION_META[selected.direction].label} · {selected.channelType === "recurring" ? "potential recurring channel" : "occasional referrals"}</div>
              <p>{selected.opportunity}</p>
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Trigger events</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">{selected.triggers.map((t) => <li key={t.event}>{t.event}</li>)}</ul>
              </div>
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Mutual value</div>
                <p>{selected.mutualValue}</p>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-3">Click any partner on the map to see the referral mechanism, trigger events and mutual value.</p>
          )}
        </div>
      </div>
      <div className="border-t border-line px-4 py-2"><MapLegend types={TYPE_ORDER.filter((t) => ranked.some((c) => c.relationshipType === t))} /></div>
    </div>
  );
}
