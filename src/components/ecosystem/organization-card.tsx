import { ExternalLink } from "lucide-react";
import type { FieldStatus, Organization, ProvenancedField } from "@/lib/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS: Record<FieldStatus, { label: string; cls: string }> = {
  verified: { label: "Confirmed by source", cls: "text-high" },
  inferred: { label: "Inferred", cls: "text-medium" },
  user_provided: { label: "From your list", cls: "text-ink-3" },
  unknown: { label: "Not found", cls: "text-ink-4" },
};

const ORIGIN: Record<Organization["origin"], string> = {
  google_places: "Google Maps listing",
  brave_search: "Web search result",
  csv_import: "Imported from your CSV",
};

function safeHref(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function FieldRow({ label, field, link }: { label: string; field: ProvenancedField; link?: boolean }) {
  const s = STATUS[field.status];
  const href = link ? safeHref(field.value) : null;
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0">
        {field.value ? (
          href ? (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-accent hover:underline">
              {field.value.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          ) : (
            <span className="break-words">{field.value}</span>
          )
        ) : (
          <span className="text-ink-4">Not found</span>
        )}
        <span className={cn("ml-1.5 text-[10.5px] font-medium", s.cls)}>{field.value ? s.label : ""}</span>
      </dd>
    </>
  );
}

export function OrganizationCard({ org, compact }: { org: Organization; compact?: boolean }) {
  const status =
    org.verificationStatus === "verified_listing"
      ? { v: "high" as const, l: "Listing confirmed" }
      : org.verificationStatus === "partially_verified"
        ? { v: "medium" as const, l: "Partly confirmed" }
        : { v: "low" as const, l: "Not confirmed" };
  return (
    <div className="rounded-lg border border-line bg-panel p-3 text-[12.5px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium text-ink">{org.name.value}</div>
          <div className="text-[11px] text-ink-3">{ORIGIN[org.origin]} · {org.researchedAt.slice(0, 10)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant={status.v}>{status.l}</Badge>
          <Badge variant="outline" title="How complete this company's details are, weighted by how well each is confirmed">{org.completeness}% complete</Badge>
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-[84px_1fr] gap-x-3 gap-y-1">
        <FieldRow label="Website" field={org.website} link />
        <FieldRow label="Location" field={org.location} />
        {!compact && <FieldRow label="Category" field={org.businessCategory} />}
        {!compact && <FieldRow label="Services" field={org.services} />}
        <FieldRow label="Contact" field={org.contactChannel} />
      </dl>
      {!compact && (
        <div className="mt-2 space-y-1 border-t border-line pt-2 text-ink-2">
          <p><span className="text-ink-3">Why included: </span>{org.inclusionReason}</p>
          <p><span className="text-ink-3">Suggested approach (based on the partner type, not this company): </span>{org.partnershipOpportunity}</p>
        </div>
      )}
      {org.sourceUrls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {org.sourceUrls.map((u) => {
            const href = safeHref(u);
            return href ? (
              <a key={u} href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-[11px] text-ink-3 hover:text-accent">
                <ExternalLink className="size-3" /> {org.origin === "google_places" && u.includes("google") ? "View on Google Maps" : "Source"}
              </a>
            ) : null;
          })}
        </div>
      )}
      <p className="mt-2 text-[10.5px] text-ink-4">A confirmed listing doesn't mean the company is interested in a partnership.</p>
    </div>
  );
}
