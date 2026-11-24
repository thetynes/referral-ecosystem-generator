"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle, FileImage, FileSpreadsheet, FileText, Info, Map as MapIcon,
  List, Zap, Building2, SlidersHorizontal, BookOpen,
} from "lucide-react";
import type { AnalysisView, BusinessInput, Organization, RelationshipType } from "@/lib/schema";
import type { Capabilities } from "@/lib/config";
import { rankCategories, WEIGHT_PRESETS, presetForGrowthPriority, type Weights } from "@/lib/scoring";
import { TYPE_META, TYPE_ORDER } from "@/lib/ui-meta";
import { ecosystemFlow } from "@/lib/narrative";
import { clientStore } from "@/lib/client-store";
import { downloadText, opportunitiesCsv, slugify } from "@/lib/export";
import { PROFILE_CATALOG } from "@/lib/knowledge/catalog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { EcosystemMap, MapLegend, type EcosystemMapHandle } from "./ecosystem-map";
import { DetailContent } from "./detail-content";
import { OpportunityList } from "./opportunity-list";
import { TriggerTable } from "./trigger-table";
import { WeightsPanel } from "./weights-panel";
import { UpgradeCard } from "./upgrade-card";
import { OrganizationsPanel, type DiscoveryState } from "./organizations-panel";
import { cn } from "@/lib/utils";
import { trackClient } from "@/lib/track-client";

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

export function inputFromView(view: AnalysisView): BusinessInput {
  const p = view.profile;
  return {
    businessName: p.displayName,
    website: p.website ?? "",
    industry: p.industry,
    serviceArea: p.serviceArea,
    idealCustomer: p.idealCustomer,
    services: p.services.join(", "),
    projectValue: p.projectValue ?? "",
    targetIndustries: p.targetIndustries.join(", "),
    growthPriority: (p.growthPriority ?? "") as BusinessInput["growthPriority"],
    existingReferrals: p.existingReferrals.join(", "),
    expansionMarkets: p.expansionMarkets.join(", "),
  };
}

export function Workspace({ id }: { id: string }) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const mapRef = useRef<EcosystemMapHandle>(null);

  const [view, setView] = useState<AnalysisView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localOnly, setLocalOnly] = useState(false);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [preset, setPreset] = useState("balanced");
  const [weights, setWeights] = useState<Weights>(WEIGHT_PRESETS.balanced.weights);
  const [visibleTypes, setVisibleTypes] = useState<Set<RelationshipType>>(new Set(TYPE_ORDER));
  const [collapsed, setCollapsed] = useState<Set<RelationshipType>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState("map");
  const [discovery, setDiscovery] = useState<DiscoveryState | null>(null);
  const [imported, setImported] = useState<Organization[]>([]);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async (tok: string | null) => {
    try {
      const res = await fetch(`/api/analysis/${id}`, { headers: tok ? { "x-entitlement": tok } : {} });
      if (res.ok) {
        const v = (await res.json()) as AnalysisView;
        setView(v);
        setLocalOnly(false);
        if (!v.isDemo) clientStore.saveAnalysis(v);
        return v;
      }
      const local = clientStore.getAnalysis(id);
      if (local) {
        setView(local);
        setLocalOnly(true);
        return local;
      }
      setLoadError(res.status === 404 ? "This ecosystem could not be found. It may have expired." : "Something went wrong loading this ecosystem.");
    } catch {
      const local = clientStore.getAnalysis(id);
      if (local) {
        setView(local);
        setLocalOnly(true);
        return local;
      }
      setLoadError("We couldn't reach the server. Check your connection and try again.");
    }
    return null;
  }, [id]);

  useEffect(() => {
    // Demo access links issued from the admin area carry a signed token once; store it and clean the URL.
    try {
      const url = new URL(window.location.href);
      const granted = url.searchParams.get("access");
      if (granted) {
        clientStore.setEntitlement(id, granted);
        url.searchParams.delete("access");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    } catch {
      /* ignore */
    }
    const tok = clientStore.getEntitlement(id);
    setToken(tok);
    setImported(clientStore.getImportedOrgs(id));
    fetch("/api/capabilities").then((r) => r.json()).then(setCaps).catch(() => undefined);
    load(tok).then((v) => {
      if (!v) return;
      const saved = clientStore.getWeights(id);
      if (saved) {
        setPreset(saved.preset);
        setWeights(saved.weights);
      } else {
        const p = presetForGrowthPriority(v.profile.growthPriority);
        setPreset(p);
        setWeights({ ...WEIGHT_PRESETS[p].weights });
      }
      if (tok && v.access.tier !== "free" && !v.isDemo) {
        fetch(`/api/discover?analysisId=${id}`, { headers: { "x-entitlement": tok } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d && setDiscovery(d))
          .catch(() => undefined);
      }
    });
  }, [id, load]);

  useEffect(() => {
    if (!isDesktop) setTab((t) => (t === "map" ? "list" : t));
  }, [isDesktop]);

  const ranked = useMemo(() => (view ? rankCategories(view.categories, weights) : []), [view, weights]);

  // Analytics: which relationships testers actually open, and which views they use.
  useEffect(() => {
    if (!selectedId || !view) return;
    const c = view.categories.find((x) => x.id === selectedId);
    trackClient("relationship_explored", {
      analysisId: view.id,
      once: `${view.id}:${selectedId}`,
      props: { categoryId: selectedId, type: c?.relationshipType ?? null, overlooked: Boolean(c?.overlooked) },
    });
  }, [selectedId, view]);
  useEffect(() => {
    if (view) trackClient("view_changed", { analysisId: view.id, once: `${view.id}:tab:${tab}`, props: { tab } });
  }, [tab, view]);
  useEffect(() => {
    if (view && view.access.tier === "free" && !view.isDemo) trackClient("upgrade_viewed", { analysisId: view.id, once: `${view.id}:upgrade` });
  }, [view]);
  const filtered = useMemo(() => ranked.filter((c) => visibleTypes.has(c.relationshipType)), [ranked, visibleTypes]);
  // Large ecosystems are unreadable when fitted to one screen: show the strongest 12 first.
  const [showAllOnMap, setShowAllOnMap] = useState(false);
  const MAP_DEFAULT = 12;
  const mapCategories = useMemo(
    () => (showAllOnMap || filtered.length <= MAP_DEFAULT + 2 ? filtered : filtered.slice(0, MAP_DEFAULT)),
    [filtered, showAllOnMap],
  );
  const presentTypes = useMemo(() => TYPE_ORDER.filter((t) => ranked.some((c) => c.relationshipType === t)), [ranked]);
  const selected = ranked.find((c) => c.id === selectedId) ?? null;
  const allOrgs = useMemo(() => [...(discovery?.organizations ?? []), ...imported], [discovery, imported]);
  const entitled = Boolean(view && view.access.tier !== "free");

  const onWeights = (p: string, w: Weights) => {
    setPreset(p);
    setWeights(w);
    clientStore.setWeights(id, { preset: p, weights: w });
  };

  const toggleType = (t: RelationshipType) =>
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t) && next.size > 1) next.delete(t);
      else next.add(t);
      return next;
    });

  const toggleCollapse = useCallback((t: RelationshipType) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);


  async function switchProfile(archetypeId: string) {
    if (!view) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputFromView(view), archetypeId, forceKnowledgeBase: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      clientStore.saveAnalysis(data);
      router.push(`/ecosystem/${data.id}`);
    } catch {
      setSwitching(false);
    }
  }

  async function exportPng() {
    setExportError(null);
    trackClient("export_downloaded", { analysisId: view?.id, props: { kind: "png" } });
    if (tab !== "map") setTab("map");
    await new Promise((r) => setTimeout(r, 350));
    try {
      await mapRef.current?.exportPng(`${slugify(view!.profile.displayName)}-referral-ecosystem.png`);
    } catch {
      setExportError("The image export failed in this browser. Try the printable report instead.");
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <AlertCircle className="mx-auto size-6 text-ink-3" />
        <h1 className="mt-3 text-lg font-semibold">{loadError}</h1>
        <Button asChild className="mt-5"><Link href="/generate">Generate a new ecosystem</Link></Button>
      </div>
    );
  }

  if (!view || !caps) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="h-6 w-64 animate-pulse rounded bg-line" />
        <div className="mt-6 h-[60vh] animate-pulse rounded-xl bg-subtle" />
      </div>
    );
  }

  const engineBadge =
    view.engine.mode === "demo" ? (
      <Badge variant="warn"><Info className="size-3" /> Example: a hypothetical business, not research</Badge>
    ) : view.engine.archetypeId === "generic" ? (
      <Badge variant="neutral"><BookOpen className="size-3" /> General referral framework</Badge>
    ) : (
      <Badge variant="neutral" className="whitespace-normal text-left"><BookOpen className="size-3 shrink-0" /> Industry focus: {view.engine.archetypeLabel}</Badge>
    );

  const flow = ecosystemFlow(filtered);

  const sidebar = (
    <div className="space-y-4">
      {view.access.tier === "free" && !view.isDemo && (
        <UpgradeCard analysisId={view.id} lockedCount={view.access.lockedCategoryCount} caps={caps} />
      )}
      <div className="rounded-xl border border-line bg-panel p-4">
        <h2 className="text-[13px] font-semibold text-ink">How this ecosystem works</h2>
        <ul className="mt-2 space-y-2.5">
          {flow.map((f) => (
            <li key={f.type} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-2">
              <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: TYPE_META[f.type].color }} />
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-line bg-panel p-4">
        <WeightsPanel preset={preset} weights={weights} onChange={onWeights} />
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-6">

      <header className="flex flex-col gap-3 pt-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">{engineBadge}
            {view.access.tier !== "free" && !view.isDemo && <Badge variant="high">{view.access.devUnlocked ? "Demo access" : view.access.tier === "basic" ? "Basic report" : "Comprehensive report"}</Badge>}
          </div>
          <h1 className="truncate text-[24px] font-semibold tracking-tight text-ink sm:text-[28px]">{view.profile.displayName}</h1>
          <p className="text-[13.5px] text-ink-3">
            {view.profile.industry} · {view.profile.serviceArea} · {view.categories.length} partner types
            {view.access.lockedCategoryCount > 0 && ` shown (${view.access.lockedCategoryCount} more in the full report)`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportPng} data-testid="export-png"><FileImage /> Image</Button>
          <Button variant="outline" size="sm" onClick={() => { trackClient("export_downloaded", { analysisId: view.id, props: { kind: "csv" } }); downloadText(`${slugify(view.profile.displayName)}-opportunities.csv`, opportunitiesCsv(ranked)); }} data-testid="export-csv">
            <FileSpreadsheet /> CSV
          </Button>
          <Button size="sm" asChild><Link href={`/report/${view.id}`} data-testid="open-report"><FileText /> View report</Link></Button>
        </div>
      </header>

      {exportError && <p className="mt-2 text-[12.5px] text-[#b42318]">{exportError}</p>}

      {(view.engine.notes.length > 0 || localOnly) && (
        <div className="mt-4 space-y-2">
          {localOnly && (
            <div className="flex gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[12.5px] text-ink-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
              This is a copy saved in your browser. Generate the ecosystem again to upgrade or research companies.
            </div>
          )}
          {view.engine.notes.map((n) => (
            <div key={n} className="flex gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[12.5px] text-ink-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
              <span>{n}</span>
            </div>
          ))}
          {view.engine.mode === "knowledge_base" && view.engine.matchConfidence !== "high" && !localOnly && (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
              <span>Industry focus:</span>
              <Select
                className="h-8 w-auto text-[12.5px]"
                value={view.engine.archetypeId ?? "generic"}
                disabled={switching}
                onChange={(e) => switchProfile(e.target.value)}
                aria-label="Change industry focus"
              >
                {PROFILE_CATALOG.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
              {switching && <span className="text-ink-3">Updating your map…</span>}
            </div>
          )}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="mt-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TabsList className="w-full overflow-x-auto md:w-auto">
            <TabsTrigger value="map"><MapIcon className="max-sm:hidden" /> Map</TabsTrigger>
            <TabsTrigger value="list"><List className="max-sm:hidden" /> Opportunities</TabsTrigger>
            <TabsTrigger value="triggers"><Zap className="max-sm:hidden" /> Triggers</TabsTrigger>
            <TabsTrigger value="orgs"><Building2 className="max-sm:hidden" /> Companies</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-1.5">
            {presentTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                aria-pressed={visibleTypes.has(t)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors",
                  visibleTypes.has(t) ? "border-line-2 bg-panel text-ink" : "border-transparent bg-transparent text-ink-4 line-through",
                )}
              >
                <span className="size-2 rounded-full" style={{ background: visibleTypes.has(t) ? TYPE_META[t].color : "#c8ccd3" }} />
                {TYPE_META[t].short}
              </button>
            ))}
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setWeightsOpen(true)}><SlidersHorizontal /> Priorities</Button>
          </div>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <TabsContent value="map" forceMount className="data-[state=inactive]:hidden">
              <div className="overflow-hidden rounded-xl border border-line bg-panel">
                <div className="h-[62vh] min-h-[440px] lg:h-[calc(100vh-300px)]">
                  <EcosystemMap
                    ref={mapRef}
                    profile={view.profile}
                    categories={mapCategories}
                    visibleTypes={visibleTypes}
                    collapsed={collapsed}
                    onToggleCollapse={toggleCollapse}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </div>
                <div className="border-t border-line px-3 py-2"><MapLegend types={presentTypes} /></div>
              </div>
              {filtered.length > MAP_DEFAULT + 2 && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
                  <span>{showAllOnMap ? `Showing all ${filtered.length} partner types.` : `Showing your top ${MAP_DEFAULT} of ${filtered.length} partner types.`}</span>
                  <button type="button" onClick={() => setShowAllOnMap((v) => !v)} className="font-medium text-accent hover:underline" data-testid="map-show-all">
                    {showAllOnMap ? `Show top ${MAP_DEFAULT}` : "Show all"}
                  </button>
                  <span className="text-ink-4">The full list is under Opportunities.</span>
                </div>
              )}
              <p className="mt-2 text-[12px] text-ink-3">Click a partner for details. Click a group label to collapse or expand it. Scroll or pinch to zoom.</p>
            </TabsContent>
            <TabsContent value="list">
              <OpportunityList categories={filtered} onSelect={setSelectedId} selectedId={selectedId} />
            </TabsContent>
            <TabsContent value="triggers">
              <TriggerTable categories={filtered} onSelect={setSelectedId} />
            </TabsContent>
            <TabsContent value="orgs">
              <OrganizationsPanel
                analysisId={view.id}
                businessName={view.profile.displayName}
                categories={ranked}
                caps={caps}
                entitled={entitled}
                token={token}
                discovery={discovery}
                onDiscovery={setDiscovery}
                imported={imported}
                onImported={(o) => {
                  setImported(o);
                  clientStore.setImportedOrgs(id, o);
                }}
                isDemo={view.isDemo}
              />
            </TabsContent>
          </div>

          <aside className="hidden lg:block">
            {selected && isDesktop ? (
              <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-line bg-panel p-5" data-testid="detail-panel">
                <button type="button" onClick={() => setSelectedId(null)} className="mb-3 text-[12px] text-ink-3 hover:text-ink">← Back to overview</button>
                <DetailContent category={selected} weights={weights} organizations={allOrgs.filter((o) => o.categoryId === selected.id)} />
              </div>
            ) : (
              sidebar
            )}
          </aside>
        </div>
      </Tabs>

      <div className="mt-6 lg:hidden">{sidebar}</div>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-4">
          <h2 className="text-[13px] font-semibold text-ink">Assumptions to validate</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-ink-2">
            {view.assumptions.map((a) => <li key={a}>{a}</li>)}
            <li>All priority ratings are strategic inferences. Validate them in conversations with real partners before committing significant time.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <h2 className="text-[13px] font-semibold text-ink">Guardrails</h2>
          <ul className="mt-2 space-y-2 text-[12.5px] leading-relaxed text-ink-2">
            {view.guardrails.map((g) => (
              <li key={g.title}><span className="font-medium text-ink">{g.title}.</span> {g.body}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Mobile / tablet detail sheet */}
      <Sheet open={Boolean(selected) && !isDesktop} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="max-w-full sm:max-w-[520px]">
          <SheetTitle className="sr-only">{selected?.name ?? "Partner details"}</SheetTitle>
          <div className="overflow-y-auto p-5" data-testid="detail-sheet">
            {selected && <DetailContent category={selected} weights={weights} organizations={allOrgs.filter((o) => o.categoryId === selected.id)} />}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={weightsOpen} onOpenChange={setWeightsOpen}>
        <SheetContent>
          <SheetTitle className="px-5 pt-5 text-[15px] font-semibold">Priorities</SheetTitle>
          <div className="overflow-y-auto p-5"><WeightsPanel preset={preset} weights={weights} onChange={onWeights} /></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
