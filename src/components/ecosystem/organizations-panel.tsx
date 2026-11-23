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
        body: JSON.stringify({ analysisId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Research failed.");
      onDiscovery(data);
      if (data.organizations.length === 0) setMessage("The search provider returned no matching organisations for your service area.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Research failed.");
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
      setMessage(result.errors[0] ?? "No organisations were found in that file.");
      return;
    }
    const merged = [...imported, ...result.organizations];
    onImported(merged);
    setMessage(
      `Imported ${result.organizations.length} organisation${result.organizations.length === 1 ? "" : "s"}.` +
        (result.errors.length ? ` ${result.errors.length} issue(s): ${result.errors[0]}` : ""),
    );
  }

  const grouped = categories
    .map((c) => ({ c, orgs: all.filter((o) => o.categoryId === c.id) }))
    .filter((g) => g.orgs.length > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Search className="size-4" /> Named-organisation research
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
            Searches official business-data APIs for organisations in your service area that match your top partner categories. Each result
            records its source and which fields are verified, inferred, or unknown.
          </p>
          <div className="mt-3">
            {isDemo ? (
              <p className="text-[12px] text-ink-3">Not available for the illustrative example. Generate your own ecosystem first.</p>
            ) : !caps.researchAvailable ? (
              <p className="flex gap-2 rounded-md bg-subtle px-3 py-2 text-[12px] text-ink-3" data-testid="research-unavailable">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Not available yet. We are confirming data-licensing permissions before researching and storing company information. Use
                CSV import to add organisations you already know.
              </p>
            ) : !entitled ? (
              <p className="flex items-center gap-2 text-[12px] text-ink-3">
                <Lock className="size-3.5" /> Included in the paid report.
              </p>
            ) : (
              <Button onClick={runDiscovery} disabled={busy} size="sm" data-testid="run-discovery">
                {busy ? "Researching…" : discovery ? "Research complete" : "Research organisations"}
              </Button>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <FileUp className="size-4" /> Import your own list (CSV)
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
            Add organisations you already know, such as association member lists or contacts. Imported details are marked “from your list”
            and are not independently verified. Files stay in your browser.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} data-testid="csv-input" />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={isDemo}>Choose CSV file</Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                downloadText(
                  "partner-list-template.csv",
                  `${CSV_TEMPLATE_HEADERS.join(",")}\n"Example Org (replace me)",https://example.com,"City, Region","Category","Services","info@example.com",https://example.com/source,"${categories[0]?.name ?? ""}"\n`,
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
        <p className="text-[12px] text-ink-3">Some searches failed: {discovery.errors.map((e) => nameOf(e.categoryId)).join(", ")}.</p>
      ) : null}

      {grouped.length > 0 ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] text-ink-3">
              {all.length} organisation{all.length === 1 ? "" : "s"}
              {discovery ? ` · researched via ${discovery.provider} on ${discovery.researchedAt.slice(0, 10)}` : ""}
            </p>
            <Button size="sm" variant="outline" onClick={() => downloadText(`${slugify(businessName)}-organisations.csv`, organizationsCsv(all, nameOf))}>
              <Download /> Export CSV
            </Button>
          </div>
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
          No organisations yet. Research or import a list to see named partners here.
        </p>
      )}
    </div>
  );
}
