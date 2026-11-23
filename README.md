# Referral Ecosystem Generator

**Discover the businesses that could send you your next customer.**

A Next.js application that maps the organisations surrounding a business's customers: upstream referral sources, complementary providers, downstream relationships, shared-audience partners, and commercial distribution channels. It explains *why* each relationship works through concrete trigger events, ranks opportunities with a transparent weighted model, and (as a paid feature) researches real organisations through official APIs, recording where every fact came from.

> **Private beta:** see [`docs/beta/implementation-report.md`](docs/beta/implementation-report.md) for current status,
> [`docs/beta/deployment.md`](docs/beta/deployment.md) for the Vercel + Supabase + Stripe test-mode setup,
> [`docs/beta/data-licensing.md`](docs/beta/data-licensing.md) for why paid company research is disabled, and
> [`docs/beta/sample-ecosystems.md`](docs/beta/sample-ecosystems.md) for the commercial-usefulness evaluation.

---

## 1. Architecture overview

```
src/
  app/                      Next.js App Router (pages + API routes)
    page.tsx                Landing page with the interactive illustrative map
    generate/               Conversational intake (with optional website read)
    ecosystem/[id]/         Workspace: map · opportunities · triggers · organisations
    report/[id]/            Print-optimised consulting report (Save as PDF)
    api/
      analyze               POST: run the pipeline, store, return the free/full view
      analysis/[id]         GET: view gated by a signed entitlement token
      extract               POST: SSRF-safe website read → intake suggestions
      discover              GET/POST: named-organisation research (paid)
      checkout, checkout/verify, stripe/webhook   Stripe Checkout + server-side verification
      dev/unlock            Testing-only unlock (DEV_MODE=true)
  lib/
    schema.ts               Zod data model (single source of truth)
    engine/                 Pipeline: normalize → kb-engine | ai-engine → orchestrator
    knowledge/              Curated industry profiles + matcher + guardrails
    llm/                    Provider abstraction (Anthropic, OpenAI) with retries
    scoring.ts              Explainable weighted prioritisation + presets
    discovery/              Google Places / Brave providers, verification, CSV import
    extract/                SSRF guard + HTML fact extraction
    payments/               Stripe Checkout + HMAC-signed entitlement tokens
    store/                  KV persistence: memory | file | Postgres
    graph-layout.ts         Radial layout with collision resolution (pure, tested)
    narrative.ts            Deterministic summaries built only from analysis data
  components/               UI (shadcn/ui-style primitives on Radix, React Flow map)
```

### Intelligence pipeline

| Stage | What | Where |
|---|---|---|
| 1 | Normalise & validate input, detect geography/scope | `lib/engine/normalize.ts` |
| 2 | Candidate partner categories across the customer journey | AI: `ai-engine.ts` · fallback: curated profiles |
| 3 | Relationship + trigger analysis, batched in parallel | AI: `ai-engine.ts` · fallback: curated profiles |
| 4 | Weighted scoring (user-adjustable in the browser) | `lib/scoring.ts` |
| 5 | Research real organisations via permitted APIs | `lib/discovery/*` |
| 6 | Verify & structure: per-field provenance, dedupe, completeness | `lib/discovery/verify.ts` |
| 7 | Network, narrative, report | `graph-layout.ts`, `narrative.ts`, report page |

**Two analysis engines, one schema.**
- **AI mode** (when `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set) uses structured outputs validated with Zod. It never generates the report in one giant prompt: one call proposes candidates and parallel calls analyse batches of five. Results are cached by a hash of the business description. Failures fall back to the knowledge base and say so in the UI.
- **Knowledge-base mode** (no keys required) uses 8 curated industry profiles (≈95 partner categories with triggers, mutual value, approaches, and regulatory notes) adapted to the user's services, customers, geography, and existing relationships. Unknown industries get a clearly labelled low-confidence generic framework and an industry-profile switcher.

**Data minimisation:** AI providers receive only business-level fields (industry, services, area, customer type). Business name, website, and named existing partners are **never** sent (covered by a unit test). Website and search content is wrapped and labelled as untrusted data.

### Honesty rules enforced in code
- Every criterion rating is labelled `inferred`. Scores are heuristics, not probabilities, volumes, or forecasts.
- Organisations come only from Google Places, Brave Search, or the user's CSV. Each field carries `verified | inferred | user_provided | unknown` plus a source URL.
- With no discovery provider, research shows **"Requires configuration"**. It is never simulated.
- Checkout is only offered when Stripe **and** a discovery provider **and** `ENTITLEMENT_SECRET` are configured.
- The demo dataset is a hypothetical business, labelled as illustrative everywhere it appears.

---

## 2. Local development

Requirements: Node 20+ (tested on Node 22).

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Open http://localhost:3000. With the default `.env.example` (`DEV_MODE=true`, no keys), you get the full free experience plus a development-mode unlock for paid views. Try the three example chips on `/generate`.

## 3. Environment variables

See [`.env.example`](.env.example). Summary:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` / `LLM_EFFORT` | Claude analysis (default model `claude-opus-5-5`, effort `medium`; server-side refusal fallback enabled) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAI analysis (Responses API + structured outputs) |
| `LLM_PROVIDER` | Force `anthropic`, `openai`, or `none` |
| `GOOGLE_PLACES_API_KEY` / `BRAVE_SEARCH_API_KEY` / `DISCOVERY_PROVIDER` | Named-organisation research |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments (Checkout + webhook) |
| `PRICE_BASIC_CENTS` / `PRICE_COMPREHENSIVE_CENTS` / `PRICE_CURRENCY` | Configurable, unvalidated prices (default $149 / $299 USD) |
| `ENTITLEMENT_SECRET` | HMAC secret for access tokens (required for paid access) |
| `STORE_DRIVER` / `DATABASE_URL` / `DATA_DIR` | Persistence (`postgres` on serverless) |
| `DEV_MODE` | Testing unlock + banner. **Never in production.** |
| `CONTACT_EMAIL` | "Request a quote" link for Advanced Research & Execution |

## 4. Tests

```bash
npm test
```

```bash
npm run build && npm run test:e2e
```

- **Unit / integration (Vitest): 62 tests.** They cover the three acceptance examples producing materially different ecosystems (Jaccard overlap < 0.15), the unknown-industry fallback, scoring and layout (no node overlaps), free-tier gating, AI pipeline staging, clamping, caching, fallback, and data minimisation with a mock provider, Google Places and Brave mapping with provenance, dedupe, CSV import including formula-injection and `javascript:` URL defences, SSRF (private IPs, redirects, size caps), HTML extraction ignoring script content, entitlement tampering, Stripe webhook signature verification and the verify→token flow, and memory/file/Postgres (pg-mem) stores.
- **End-to-end (Playwright, desktop + Pixel 7): 12 tests.** Landing, intake validation, the full generate → map → node details → collapse → PNG export → list → triggers → CSV export → dev unlock → CSV import → report flow, the unknown-industry path, and demo labelling.

## 5. Deployment

**Vercel** (or Netlify with the Next.js runtime):
1. Create a Postgres database (Supabase works) and set `DATABASE_URL`. The `kv_store` table is created automatically. File storage does not persist on serverless hosts.
2. Set `APP_URL`, `ENTITLEMENT_SECRET`, and any provider keys. Leave `DEV_MODE` unset.
3. In Stripe, add a webhook endpoint `https://YOUR_DOMAIN/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and copy its signing secret to `STRIPE_WEBHOOK_SECRET`.
4. AI analysis can take 30–90 s. The analyze route sets `maxDuration = 120`, so make sure your plan allows it.
5. The built-in rate limiter is per instance. Add platform WAF or a shared limiter for production traffic.

Local Stripe testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## 6. Remaining dependencies & unfinished work

- **Live provider verification:** the Anthropic, OpenAI, Google Places, Brave, and Stripe integrations are implemented against their documented APIs and covered by mocked tests, but they were **not exercised against live credentials** in this build environment.
- **PDF export** uses the browser's print-to-PDF with a print stylesheet. It is not server-generated.
- **Saved projects** live in browser storage. Server copies expire after 180 days, and there are no accounts (V3).
- **Organisation contact details** are limited to what the APIs return (phone and website). No email harvesting by design.
- **Google Places terms** limit caching of Places content. Discovery results are kept for at most 7 days. Review the terms for your use case.
- UI primitives follow shadcn/ui conventions on Radix (`components.json` included) but were written by hand rather than generated by the shadcn CLI.

## 7. Recommended next improvements (commercial value)

1. **Validate pricing before scaling** with a small test: show both tiers to early users and measure checkout starts against completions. $149/$299 are hypotheses.
2. **Partner-level evidence enrichment:** fetch each discovered organisation's own site (through the SSRF guard) to extract services and verify relevance. This upgrades `services` from unknown to verified.
3. **Relationship tracker (V3):** statuses (researched → contacted → meeting → referring), notes, and follow-up reminders. This turns a one-time report into a retained workflow.
4. **Association and directory connectors:** licensed member-directory data for high-value partner types (builders' associations, law societies' public directories where permitted).
5. **Outreach drafting with consent checks:** personalised first-touch drafts that record the CASL/CAN-SPAM consent basis, without ever auto-sending.
6. **Agency white-label (V3):** branded reports and multi-client workspaces. Agencies are the most likely repeat buyers.
