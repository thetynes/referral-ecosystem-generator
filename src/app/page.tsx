import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { DemoMap } from "@/components/landing/demo-map";
import { Button } from "@/components/ui/button";
import { capabilities } from "@/lib/config";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BENEFITS = [
  {
    title: "See who meets your customer first",
    body: "Upstream partners such as inspectors, engineers, advisors, and plumbers diagnose the problem before anyone gets hired. The map shows who they are and where they sit in the buying journey.",
  },
  {
    title: "Know the moment a referral happens",
    body: "Every relationship is explained through trigger events: what happens to the customer, who notices, when to refer, and what the referrer gains.",
  },
  {
    title: "Lead with value, not a favour",
    body: "Each partner type comes with a mutual-value case and a practical first step, so your outreach is about solving their problem, not asking for leads.",
  },
  {
    title: "Prioritise transparently",
    body: "Opportunities are ranked on nine explicit criteria you can reweight. You see why each one scores the way it does. Nothing is a made-up probability.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "How is this different from joining a networking group?",
    a: "Networking groups give you access to whoever shows up. This starts from your customer's journey and works backwards to the specific professions that encounter your customers before, during, and after they need you. Then it tells you which of those to approach first and why.",
  },
  {
    q: "Where do the recommendations come from?",
    a: "Either a configured AI model, run through a staged and schema-validated pipeline, or curated industry profiles written for common business types. The analysis tells you which one produced your results. Named organisations only come from official business-data APIs or your own CSV. The tool never invents companies, contacts, or sources.",
  },
  {
    q: "Are the priority scores predictions?",
    a: "No. They are weighted strategic ratings that help you decide where to start. They do not estimate referral volume, conversion rates, or revenue, and you can change the weights to match your goals.",
  },
  {
    q: "Should I start with the highest-scoring partner type?",
    a: "Not always. A medium-priority category where you already know someone often beats a high-priority one where you know nobody. A practical approach is to pick three categories, have two or three exploratory conversations in each, and use what you learn to re-rank.",
  },
  {
    q: "What can I offer a partner who doesn't need referrals back?",
    a: "Usually something other than referrals: reliable response times, clear documentation, capacity they lack, expertise they can share with their clients, or simply making them look good for recommending you. The analysis spells this out for each partner type.",
  },
  {
    q: "Can I pay partners for referrals?",
    a: "It depends on your industry and jurisdiction. Lawyers, healthcare providers, financial advisors, and real estate professionals often face strict limits or outright prohibitions. This tool treats partnership development and compensated referral arrangements as different things and flags regulated situations.",
  },
  {
    q: "Is a backlink a partnership?",
    a: "No. Shared-audience partners can produce useful, earned links through co-authored resources or expert contributions, but a link exchange is not a relationship and can breach search engine policies. The report focuses on collaboration that benefits both audiences.",
  },
  {
    q: "Can I email the organisations in my report?",
    a: "Possibly, but anti-spam laws apply. In Canada, CASL generally requires consent (express or, in limited cases, implied). In the US, CAN-SPAM sets rules for commercial email and stricter rules apply to texts and calls. The tool never sends outreach for you.",
  },
  {
    q: "What happens to my information?",
    a: "Your analysis is saved in your browser and stored on the server so it can be unlocked later. If an AI provider is used, it receives only a business-level description (industry, services, area, customer type). Your business name, website, and named existing partners are never sent.",
  },
];

export default function Home() {
  const caps = capabilities();
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-[12px] text-ink-3">
              Referral ecosystem mapping for any industry
            </div>
            <h1 className="text-[36px] font-semibold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[54px]">
              Discover who could be sending you customers
            </h1>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2 sm:text-[18px]">
              Map your industry&apos;s referral ecosystem, uncover overlooked partnership opportunities, and identify businesses worth building
              relationships with.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/generate" data-testid="hero-cta">Generate My Referral Ecosystem <ArrowRight /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/ecosystem/demo">Explore an example</Link>
              </Button>
            </div>
            <p className="mt-3 text-[12.5px] text-ink-4">Free. No account required. About two minutes.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <DemoMap />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-2xl text-[24px] font-semibold tracking-tight sm:text-[30px]">Your next customer is probably already talking to someone else first.</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-3">
            Most businesses chase customers directly. The organisations that advise, inspect, supply, and serve those customers already have
            their trust. This tool finds them systematically.
          </p>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="border-t border-line pt-4">
                <h3 className="text-[15px] font-semibold text-ink">{b.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-line bg-panel">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3">
            {[
              ["01", "Describe your business", "Enter your industry, service area, and ideal customer, or let us read your website and suggest them."],
              ["02", "Explore the ecosystem", "Upstream sources, complementary providers, downstream relationships, shared-audience partners, and distribution channels, all mapped with the reasoning behind each."],
              ["03", "Research and act", "Prioritise with transparent criteria, then research real organisations in your market and work through a ranked action plan."],
            ].map(([n, t, d]) => (
              <div key={n}>
                <div className="font-mono text-[12px] text-ink-4">{n}</div>
                <h3 className="mt-2 text-[15px] font-semibold">{t}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6">
          <h2 className="text-[24px] font-semibold tracking-tight sm:text-[30px]">Start free. Go deeper when it&apos;s worth it.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-line bg-panel p-5">
              <div className="text-[13px] font-medium text-ink-3">Free</div>
              <div className="mt-1 text-[28px] font-semibold">{formatMoney(0, caps.prices.currency)}</div>
              <ul className="mt-4 space-y-2 text-[13.5px] text-ink-2">
                {["Interactive referral ecosystem map", "Top five partner categories", "Referral mechanisms and trigger events", "Opportunity list with exports", "Import your own partner list (CSV)"].map((f) => (
                  <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ink-3" />{f}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-ink bg-panel p-5">
              <div className="text-[13px] font-medium text-ink-3">Basic Opportunity Report</div>
              <div className="mt-1 text-[28px] font-semibold">{formatMoney(caps.prices.basic, caps.prices.currency)} <span className="text-[13px] font-normal text-ink-3">one-time</span></div>
              <ul className="mt-4 space-y-2 text-[13.5px] text-ink-2">
                {["Every partner category identified", "Named organisations for your top five categories, with sources", "Verified, inferred, and unknown fields clearly marked", "Ranked top-10 action plan", "PDF and CSV report exports"].map((f) => (
                  <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ink-3" />{f}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-line bg-panel p-5">
              <div className="text-[13px] font-medium text-ink-3">Comprehensive Partnership Report</div>
              <div className="mt-1 text-[28px] font-semibold">{formatMoney(caps.prices.comprehensive, caps.prices.currency)} <span className="text-[13px] font-normal text-ink-3">one-time</span></div>
              <ul className="mt-4 space-y-2 text-[13.5px] text-ink-2">
                {["Everything in Basic", "Named-organisation research across all categories", "Shared-audience and digital-authority opportunities", "Engagement strategy for every partner type"].map((f) => (
                  <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ink-3" />{f}</li>
                ))}
              </ul>
              <p className="mt-4 text-[12.5px] text-ink-3">Need research and outreach support? Advanced Research & Execution is available on request.</p>
            </div>
          </div>
          <p className="mt-4 text-[12.5px] text-ink-4">
            {caps.paidReportsAvailable
              ? "Paid reports are purchased from inside your ecosystem workspace."
              : "Paid reports are not yet available on this deployment. They are only sold where live business research is configured."}
          </p>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
          <h2 className="text-[24px] font-semibold tracking-tight">Questions worth asking</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-ink">
                  {f.q}
                  <span className="text-ink-4 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-3">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Button size="lg" asChild><Link href="/generate">Generate My Referral Ecosystem <ArrowRight /></Link></Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
