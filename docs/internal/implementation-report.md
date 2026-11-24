# Controlled beta — implementation report (internal)

_Status as of 23 November 2026. Branch `claude/peaceful-keller-4dsnhg`._

## 1. What's complete

| Area | Status |
|---|---|
| **Industry depth** | 7 new curated profiles: basement waterproofing, concrete, renovation, custom home builders, family law, criminal defence, and property management. Excavation, immigration law, and marketing/SEO were deepened. Every relationship in these 10 profiles names **who decides** at the partner, and **often-overlooked** relationships are flagged (at least 2 per profile, tested). Businesses spanning two related trades are blended, e.g. *excavation + waterproofing*, with the business's own trades removed and near-duplicates merged. |
| **AI integration** | Anthropic and OpenAI providers. Model, reasoning effort, max output tokens, batch size, daily and monthly USD caps, per-tester daily runs, per-token prices, and fallback behaviour (`knowledge_base` or `error`) are all configurable. AI runs **only for invited testers** by default. Anonymous visitors always get the curated analysis at zero AI cost. Spend is recorded from actual token usage, including partial runs. |
| **Private beta** | Invite-code gate (`BETA_MODE`, revocable `label:code` invites), `noindex` everywhere, and `robots.txt` blocks crawling on preview and beta deployments. |
| **Analytics** | First-party events for intake started/submitted, maps generated, relationships explored (with type and overlooked flag), views, exports, reports opened/printed, upgrade seen, checkout started, purchase completed, AI runs and fallbacks. Each event carries the environment and a **`simulated`** flag that marks dev mode, demo, dev unlocks, and Stripe test-mode payments. The `/admin` dashboard shows real versus simulated counts, per-tester activity, and AI spend. |
| **Payments** | Stripe Checkout, webhook verification, and an idempotent purchase record. **Live keys are refused** unless `STRIPE_ALLOW_LIVE=true`. Test-mode purchases are labelled in the UI and counted as simulated. Paid tiers no longer depend on or promise company research. |
| **Licensing** | Paid company research is **hard-disabled** (`COMPANY_RESEARCH_ENABLED=false`, enforced by the API and the UI). The research and recommended workflow are in [`data-licensing.md`](data-licensing.md). |
| **Persistence** | Postgres store with TLS options for the Supabase pooler; analytics table; migration in `supabase/migrations/0001_init.sql` (RLS on, no public grants). |
| **Deployment** | Step-by-step guide for a protected Vercel preview, Supabase, and Stripe test mode in [`deployment.md`](deployment.md). |
| **Validation** | Complete sample ecosystems and a usefulness evaluation in [`sample-ecosystems.md`](sample-ecosystems.md) and [`samples/`](samples/). |

## 2. Tested with live services

| Service | Result |
|---|---|
| **OpenAI (gpt-5.5)** | Six live end-to-end runs of the full AI pipeline: structured outputs, usage tracking, cost estimates, and caps all worked. **$0.55–$0.61 and 95–130 seconds per analysis, $3.42 total.** No fallbacks occurred. Details are in `sample-ecosystems.md` §5. The latency means the analyze function needs a timeout of at least 180 seconds (set in code; check that your Vercel plan allows it). |
| Anthropic | **Not run live.** Anthropic keys cannot be stored as a network secret in this build environment. The provider code is unchanged from the version covered by mocked tests. Run `npm run compare:engines` with `LLM_PROVIDER=anthropic` once a key is available. |
| Supabase / Postgres | **Not run against a live instance.** The store and analytics SQL run against `pg-mem` in tests. Live Supabase requires your project (see `deployment.md`). |
| Stripe | **Not run against Stripe's API.** Webhook signature verification, purchase recording, test/live separation, and live-key refusal are tested with Stripe's own test-signature helper. A real test-mode checkout needs your keys on the preview. |
| Vercel | **Not deployed.** The Vercel API is blocked from this build environment, and the deployment needs your account. |

## 3. Still simulated or unverified
- **Payments:** test mode only, by design.
- **Dev unlock** (`DEV_MODE=true`) bypasses payment for local testing. It must be **unset** on the preview, and if it is set, all activity is flagged as simulated.
- **AI cost figures** are estimates from token usage multiplied by configured list prices. Reconcile them with the provider's billing.
- The **rate limiter and AI caps are per instance or not transactional**. Concurrent bursts can overshoot a cap by about one run. Also set a hard limit in the provider dashboard.

## 4. Licensing blockers (company research)
- **Google Places:** terms prohibit exporting Maps content for use outside Google's services. A downloadable report containing Places data is not supportable without written authorisation from Google.
- **Brave Search:** the general terms prohibit retaining results. Storage requires a separate contract.
- **Recommended path:** openly licensed data (Overture Places, Statistics Canada ODBus) plus first-party website verification, user-supplied lists, and human review, after counsel signs off. See `data-licensing.md` §3 and §5.

## 5. What you need to configure
1. Supabase project, then run the migration and copy the pooler URI (`deployment.md` §1).
2. Vercel project from the GitHub repo, with Preview-scoped env vars, Deployment Protection, and a bypass secret (§2 and §4).
3. Stripe **test** keys plus a webhook with the bypass parameter (§3).
4. An AI key: `OPENAI_API_KEY` (tested) or `ANTHROPIC_API_KEY`, plus a **hard monthly limit in the provider dashboard**.
5. Invite codes, `BETA_SECRET`, `ADMIN_KEY`, and `ENTITLEMENT_SECRET`.
6. Decisions on the licensing items in `data-licensing.md` §5.

## 5b. Update (24 November 2026): customer, app, and admin separation
- Customer-facing screens no longer show developer, AI-provider, model, configuration or infrastructure wording. Internal diagnostics go to `/admin` and server logs. See `customer-experience-review.md`.
- Private administration has moved to `/admin`: setup checklist, configuration, demo-access links, funnel, testers, AI spend, and diagnostics. It is protected by `ADMIN_KEY`; the admin APIs return 404 without an admin session.
- AI is now **off by default** (`AI_ACCESS=none`); everyone gets the industry playbooks. Set `AI_ACCESS=testers` to re-enable it for invited testers.
- Company discovery with Google Places is a configurable, working integration (`COMPANY_RESEARCH_ENABLED`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACES_IN_EXPORTS`, `DISCOVERY_RETENTION_DAYS`). Unresolved provider restrictions are tracked in `discovery-providers.md`.
- Deployment steps: `deployment.md`.

## 6. Recommendations before inviting testers
See the closing section of `sample-ecosystems.md`. In short: keep the curated engine as the default free experience, treat AI as a tester-only comparison, and measure whether testers open relationship details and reports before testing price.
