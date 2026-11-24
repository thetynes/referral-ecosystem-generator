"use client";

import { useRef, useState } from "react";
import { Download, FileUp, Search, Lock, Info } from "lucide-react";
import type { Organization, ScoredCategory } from "@/lib/schema";
import type { Capabilities } from "@/lib/config";
import { importOrganizationsCsv, CSV_TEMPLATE_HEADERS } from "@/lib/discovery/csv";
import { downloadText, organizationsCsv, slugify } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { OrganizationCard } from "./organization-card";

export interface DiscoveryState {
  organizations: Organization[];
  errors: { categoryId: string; message: string }[];
  provider: string;
  researchedAt: string;
  categoriesSearched?: number;
}

export function OrganizationsPanel({
  analysisId,
  businessName,
  categories,
  caps,
  entitled,
  token,
  discovery,
  onDiscovery,
  imported,
  onImported,
  isDemo,
}: {
  analysisId: string;
  businessName: string;
  categories: ScoredCategory[];
  caps: Capabilities;
  entitled: boolean;
  token: string | null;
  discovery: DiscoveryState | null;
  onDiscovery: (d: DiscoveryState) => void;
  imported: Organization[];
  onImported: (orgs: Organization[]) => void;
  isDemo: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const all = [...(discovery?.organizations ?? []), ...imported];
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  async function runDiscovery() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "x-entitlement": token } : {}) },
        body: JSON.stringify({ analysisId, refresh: Boolean(discovery?.errors?.length) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Company research couldn't be completed. Please try again.");
      onDiscovery(data);
      if (data.organizations.length === 0) setMessage("We didn't find matching companies in your area for these partner types.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Company research couldn't be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setMessage(null);
    if (file.size > 2_000_000) {
      setMessage("That file is too large (2 MB maximum).");
      return;
    }
    const text = await file.text();
    const result = importOrganizationsCsv(text, categories, categories[0]?.id);
    if (result.organizations.length === 0) {
      setMessage(result.errors[0] ?? "We didn't find any companies in that file. Check that it has a 'name' column.");
      return;
    }
    const merged = [...imported, ...result.organizations];
    onImported(merged);
    setMessage(
      `Added ${result.organizations.length} compan${result.organizations.length === 1 ? "y" : "ies"} from your file.` +
        (result.errors.length ? ` Some rows couldn't be read: ${result.errors[0]}` : ""),
    );
  }

  // Some listing providers don't allow their content in downloads; those results stay viewable in the app.
  const exportable = caps.listingExportsAllowed ? all : all.filter((o) => o.origin !== "google_places");
  const hasGoogle = all.some((o) => o.origin === "google_places");

  const grouped = categories
    .map((c) => ({ c, orgs: all.filter((o) => o.categoryId === c.id) }))
    .filter((g) => g.orgs.length > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Search className="size-4" /> Find companies in your area
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
            We search business listings for companies in your service area that match your top partner types. Each result shows where it
            came from and which details are confirmed by that source.
          </p>
          <div className="mt-3">
            {isDemo ? (
              <p className="text-[12px] text-ink-3">Generate your own ecosystem to find companies in your area.</p>
            ) : !caps.researchAvailable ? (
              <p className="flex gap-2 rounded-md bg-subtle px-3 py-2 text-[12px] text-ink-3" data-testid="research-unavailable">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Company research is coming soon. In the meantime, you can add companies you already know from a spreadsheet.
              </p>
            ) : !entitled ? (
              <p className="flex items-center gap-2 text-[12px] text-ink-3">
                <Lock className="size-3.5" /> Included with the full report.
              </p>
            ) : (
              <Button onClick={runDiscovery} disabled={busy} size="sm" data-testid="run-discovery">
                {busy ? "Searching… this can take a minute" : discovery ? "Search again" : "Find companies"}
              </Button>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <FileUp className="size-4" /> Add companies you already know
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
            Upload a spreadsheet (CSV) of companies, such as an association member list or your own contacts. They are marked “from your
            list” and stay in your browser.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} data-testid="csv-input" />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={isDemo}>Upload CSV</Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                downloadText(
                  "partner-list-template.csv",
                  `${CSV_TEMPLATE_HEADERS.join(",")}\n"Example Company (replace me)",https://example.com,"City, Region","Category","Services","info@example.com",https://example.com/source,"${categories[0]?.name ?? ""}"\n`,
                )
              }
            >
              Download template
            </Button>
          </div>
        </div>
      </div>

      {message && <p className="rounded-md bg-subtle px-3 py-2 text-[12.5px] text-ink-2" role="status">{message}</p>}

      {discovery?.errors?.length ? (
        <p className="rounded-md bg-[#fff4e5] px-3 py-2 text-[12.5px] text-[#7a4a00]" role="status">
          We couldn't search for {discovery.errors.map((e) => nameOf(e.categoryId).toLowerCase()).join(", ")}. Results for these partner types are
          missing; try searching again later.
        </p>
      ) : null}

      {grouped.length > 0 ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] text-ink-3">
              {all.length} compan{all.length === 1 ? "y" : "ies"}
              {discovery ? ` · searched ${discovery.researchedAt.slice(0, 10)}` : ""}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadText(`${slugify(businessName)}-companies.csv`, organizationsCsv(exportable, nameOf))}
              disabled={exportable.length === 0}
            >
              <Download /> Download CSV
            </Button>
          </div>
          {hasGoogle && (
            <p className="text-[12px] text-ink-3">
              Business details marked “Google Maps listing” come from Google Maps.
              {!caps.listingExportsAllowed && " They can be viewed here but aren't included in downloads."}
            </p>
          )}
          {grouped.map(({ c, orgs }) => (
            <section key={c.id} className="space-y-2">
              <h3 className="text-[13px] font-semibold text-ink">{c.name}</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {orgs.map((o) => <OrganizationCard key={o.id} org={o} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line-2 p-6 text-center text-[13px] text-ink-3">
          No companies yet. Find companies in your area or upload a list to see them here.
        </p>
      )}
    </div>
  );
}
