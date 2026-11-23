"use client";

import { useEffect, useState } from "react";
import { trackClient } from "@/lib/track-client";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Globe, Loader2 } from "lucide-react";
import { BusinessInputSchema, type BusinessInput } from "@/lib/schema";
import { clientStore } from "@/lib/client-store";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const EMPTY: BusinessInput = {
  businessName: "", website: "", industry: "", serviceArea: "", idealCustomer: "", services: "", projectValue: "",
  targetIndustries: "", growthPriority: "", existingReferrals: "", expansionMarkets: "",
};

const EXAMPLES: { label: string; input: Partial<BusinessInput> }[] = [
  {
    label: "Excavation contractor · Sarnia",
    input: {
      businessName: "Example Excavating", industry: "Excavation contractor", serviceArea: "Sarnia, Ontario",
      idealCustomer: "Homeowners, property managers, general contractors, builders, and commercial property owners",
      services: "Excavation, grading, drainage, demolition, foundation-related work", growthPriority: "recurring",
    },
  },
  {
    label: "Immigration law firm · Toronto",
    input: {
      businessName: "Example Immigration Law", industry: "Immigration law firm", serviceArea: "Toronto, Ontario",
      idealCustomer: "Individuals, families, businesses, educational institutions, and foreign nationals",
      services: "Immigration legal services, work permits, sponsorship, refusals and appeals",
    },
  },
  {
    label: "App development agency · Fort Lauderdale",
    input: {
      businessName: "Example App Studio", industry: "Mobile app development agency", serviceArea: "Fort Lauderdale, Florida",
      idealCustomer: "Companies requiring custom software and mobile applications",
      services: "iOS and Android apps, custom software, web applications", growthPriority: "higher_value",
    },
  },
];

const STAGES = [
  "Normalising your business details",
  "Identifying candidate partner categories",
  "Analysing referral triggers and mutual value",
  "Scoring and prioritising opportunities",
  "Assembling your ecosystem map",
];

type Suggestion = { businessName: string | null; industry: string | null; services: string | null; serviceArea: string | null; idealCustomer: string | null; notes: string[] };

export function IntakeForm() {
  const router = useRouter();
  const [form, setForm] = useState<BusinessInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof BusinessInput, string>>>({});
  const [showOptional, setShowOptional] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const [ai, setAi] = useState<{ available: boolean; reason: string | null; model: string | null } | null>(null);
  const [useAi, setUseAi] = useState(true);
  useEffect(() => {
    fetch("/api/capabilities")
      .then((r) => r.json())
      .then((c) => setAi({ available: Boolean(c.aiForYou?.available), reason: c.aiForYou?.reason ?? null, model: c.aiModel ?? null }))
      .catch(() => undefined);
  }, []);

  const set = (k: keyof BusinessInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    trackClient("intake_started", { once: "intake_started" });
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function readWebsite() {
    if (!form.website.trim()) return;
    setExtracting(true);
    setExtractMsg(null);
    setSuggestion(null);
    try {
      const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: form.website }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "We couldn't read that website.");
      setSuggestion(data.suggestion);
    } catch (e) {
      setExtractMsg(e instanceof Error ? e.message : "We couldn't read that website.");
    } finally {
      setExtracting(false);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    setForm((f) => ({
      ...f,
      businessName: f.businessName || suggestion.businessName || "",
      industry: suggestion.industry || f.industry,
      services: suggestion.services || f.services,
      serviceArea: suggestion.serviceArea || f.serviceArea,
      idealCustomer: suggestion.idealCustomer || f.idealCustomer,
    }));
    if (suggestion.services) setShowOptional(true);
    setSuggestion(null);
    setExtractMsg("Applied. Review each field below, because website information can be incomplete or out of date.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const parsed = BusinessInputSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Partial<Record<keyof BusinessInput, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof BusinessInput;
        if (k && !errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: parsed.data, useAi: ai?.available ? useAi : false }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      clientStore.saveAnalysis(data);
      router.push(`/ecosystem/${data.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (submitting) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-line bg-panel p-6" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-[15px] font-semibold"><Loader2 className="size-4 animate-spin" /> Building your referral ecosystem</div>
        <p className="mt-1 text-[12.5px] text-ink-3">AI analysis can take up to a minute. The curated profile analysis is near-instant.</p>
        <ol className="mt-4 space-y-2 text-[13px] text-ink-2">
          {STAGES.map((s) => (
            <li key={s} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-ink-4" />{s}</li>
          ))}
        </ol>
      </div>
    );
  }

  const field = (k: keyof BusinessInput, label: string, hint: string | null, el: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      {el}
      {errors[k] ? <p className="text-[12px] text-[#b42318]">{errors[k]}</p> : hint ? <p className="text-[12px] text-ink-4">{hint}</p> : null}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
        <span>Try an example:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex.label} type="button" onClick={() => { setForm({ ...EMPTY, ...ex.input }); setErrors({}); }} className="rounded-full border border-line-2 bg-panel px-2.5 py-1 text-ink-2 hover:bg-subtle">
            {ex.label}
          </button>
        ))}
      </div>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><span className="font-mono text-[12px] text-ink-4">01</span> Who are you?</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("businessName", "Business name", "Or just enter your website.", <Input id="businessName" value={form.businessName} onChange={set("businessName")} placeholder="Acme Excavating" aria-invalid={Boolean(errors.businessName)} />)}
          <div className="space-y-1.5">
            <Label htmlFor="website">Website <span className="font-normal text-ink-4">(optional)</span></Label>
            <div className="flex gap-2">
              <Input id="website" value={form.website} onChange={set("website")} placeholder="acme.com" inputMode="url" />
              <Button type="button" variant="outline" onClick={readWebsite} disabled={!form.website.trim() || extracting} className="h-10 shrink-0">
                {extracting ? <Loader2 className="animate-spin" /> : <Globe />} Read site
              </Button>
            </div>
            <p className="text-[12px] text-ink-4">We read your public homepage to suggest details. You review everything.</p>
          </div>
        </div>
        {extractMsg && <p className="rounded-md bg-subtle px-3 py-2 text-[12.5px] text-ink-2">{extractMsg}</p>}
        {suggestion && (
          <div className="rounded-lg border border-line bg-panel p-3 text-[12.5px]">
            <div className="font-medium text-ink">From your website, we found:</div>
            <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-ink-2">
              {(["businessName", "industry", "services", "serviceArea", "idealCustomer"] as const).map((k) => (
                <div key={k} className="contents">
                  <dt className="text-ink-3">{{ businessName: "Name", industry: "Industry", services: "Services", serviceArea: "Service area", idealCustomer: "Customers" }[k]}</dt>
                  <dd>{suggestion[k] ?? <span className="text-ink-4">Not found</span>}</dd>
                </div>
              ))}
            </dl>
            {suggestion.notes.length > 0 && <p className="mt-2 text-ink-3">{suggestion.notes.join(" ")}</p>}
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" onClick={applySuggestion}><Check /> Use these</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSuggestion(null)}>Dismiss</Button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><span className="font-mono text-[12px] text-ink-4">02</span> What do you do, where, and for whom?</h2>
        {field("industry", "Primary industry or service", "Be specific: “residential excavation contractor” works better than “construction”.", <Input id="industry" value={form.industry} onChange={set("industry")} placeholder="e.g. Excavation contractor" aria-invalid={Boolean(errors.industry)} />)}
        {field("serviceArea", "Geographic market or service area", null, <Input id="serviceArea" value={form.serviceArea} onChange={set("serviceArea")} placeholder="e.g. Sarnia, Ontario, or Remote, United States" aria-invalid={Boolean(errors.serviceArea)} />)}
        {field("idealCustomer", "Ideal customer or customer type", null, <Textarea id="idealCustomer" value={form.idealCustomer} onChange={set("idealCustomer")} placeholder="e.g. Homeowners with drainage problems, property managers, custom home builders" aria-invalid={Boolean(errors.idealCustomer)} />)}
      </section>

      <section className="space-y-4">
        <button type="button" onClick={() => setShowOptional((v) => !v)} className="flex w-full items-center justify-between text-left" aria-expanded={showOptional}>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><span className="font-mono text-[12px] text-ink-4">03</span> Sharpen the analysis <span className="text-[12.5px] font-normal text-ink-3">(optional)</span></h2>
          <ChevronDown className={cn("size-4 text-ink-3 transition-transform", showOptional && "rotate-180")} />
        </button>
        {showOptional && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{field("services", "Services or specialisations", "Comma-separated.", <Textarea id="services" value={form.services} onChange={set("services")} placeholder="Excavation, grading, drainage, demolition" />)}</div>
            {field("projectValue", "Typical project or customer value", "Used only to describe commercial value. It is never presented as a forecast.", <Input id="projectValue" value={form.projectValue} onChange={set("projectValue")} placeholder="e.g. $8k–$40k per project" />)}
            {field(
              "growthPriority",
              "Main growth priority",
              "Sets the starting prioritisation preset.",
              <Select id="growthPriority" value={form.growthPriority} onChange={set("growthPriority")}>
                <option value="">No preference</option>
                <option value="more_leads">More leads, quickly</option>
                <option value="higher_value">Higher-value projects</option>
                <option value="recurring">Recurring, predictable work</option>
                <option value="new_markets">Entering new markets</option>
                <option value="authority">Authority & visibility</option>
              </Select>,
            )}
            {field("targetIndustries", "Target customer industries", "For B2B: the industries your customers are in.", <Input id="targetIndustries" value={form.targetIndustries} onChange={set("targetIndustries")} placeholder="e.g. healthcare, logistics" />)}
            {field("expansionMarkets", "Markets you want to expand into", null, <Input id="expansionMarkets" value={form.expansionMarkets} onChange={set("expansionMarkets")} placeholder="e.g. London, Ontario" />)}
            <div className="sm:col-span-2">{field("existingReferrals", "Existing referral relationships", "Partner types only, such as “two home builders, a plumber”. These are flagged on your map and are not sent to AI providers.", <Textarea id="existingReferrals" value={form.existingReferrals} onChange={set("existingReferrals")} placeholder="e.g. two local home builders, one plumbing company" />)}</div>
          </div>
        )}
      </section>

      {submitError && <p className="rounded-md bg-[#fdecec] px-3 py-2 text-[13px] text-[#8a1c1c]" role="alert">{submitError}</p>}

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          {ai?.available && (
            <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} className="size-3.5 accent-[#0e1116]" data-testid="use-ai" />
              Use AI analysis (beta{ai.model ? ` · ${ai.model}` : ""}). Uncheck to see the curated industry profile.
            </label>
          )}
          {ai && !ai.available && ai.reason && <p className="text-[12px] text-ink-4">{ai.reason} You'll get the curated analysis.</p>}
          <p className="text-[12px] text-ink-4">The free analysis includes the interactive map and your top five partner categories.</p>
        </div>
        <Button type="submit" size="lg" data-testid="generate-submit">Generate my referral ecosystem <ArrowRight /></Button>
      </div>
    </form>
  );
}
