# Private beta deployment (Vercel preview + Supabase + Stripe test mode)

This is a **private preview**. It is not a public launch. Live payments are blocked in code (live Stripe keys are refused unless `STRIPE_ALLOW_LIVE=true`), company research is off (`COMPANY_RESEARCH_ENABLED=false`), and AI is limited to invited testers with hard spend caps.

Expected cost at beta scale: **Vercel Hobby or Pro (preview deployments are included), Supabase Free tier, Stripe test mode (free), AI capped at `AI_MONTHLY_BUDGET_USD` (default $40).** Vercel Hobby is for non-commercial use, so use Pro once testers are paying customers.

## What you need to do (about 30 minutes)

### 1. Supabase (persistence)
1. Create a project at supabase.com (Free tier, region `ca-central-1` if offered, to keep data in Canada).
2. Open **SQL Editor**, paste `supabase/migrations/0001_init.sql`, and run it.
3. Go to **Project Settings → Database → Connection string → Transaction pooler** (port `6543`) and copy the URI. Replace `[YOUR-PASSWORD]`. Do **not** add `?sslmode=…`; the app sets TLS itself.
4. Optional but recommended: download the Supabase CA certificate (Database settings → SSL) and set `DATABASE_CA_CERT` to its contents (use `\n` for newlines). This enables full certificate verification. Without it, TLS is still used, but the certificate chain isn't verified.

The tables have RLS enabled with no policies and no grants to `anon`/`authenticated`. They are reachable only through the server-side connection string, not through Supabase's public APIs.

### 2. Vercel (protected preview)
1. In Vercel, choose **Add New → Project** and import `thetynes/referral-ecosystem-generator`.
2. Framework: Next.js (auto-detected). No build settings to change.
3. Under **Settings → Deployment Protection**, set **Vercel Authentication: Standard Protection** (the default). Preview URLs then require a Vercel login. For testers without Vercel accounts, either invite them to the team or rely on the app's own invite-code gate (`BETA_MODE=true`). Vercel's "Shareable Links" also work per deployment.
4. Under **Settings → Deployment Protection → Protection Bypass for Automation**, create a secret. You need it for the Stripe webhook URL in step 3.
5. Add the **environment variables** below with scope **Preview** only, then push to (or redeploy) the branch `claude/peaceful-keller-4dsnhg`. Vercel builds a preview at a URL like `referral-ecosystem-generator-git-claude-peaceful-keller-4dsnhg-<team>.vercel.app`.
6. Do **not** promote to Production.

> I could not create the Vercel project or the Supabase project from my build environment: the Vercel API is blocked by its network policy, and I don't have credentials for your Vercel or Supabase accounts. Everything else is ready for you to connect.

### 3. Stripe (test mode only)
1. In the Stripe Dashboard, make sure **Test mode** is on and copy the **test** secret key (`sk_test_…`).
2. Under **Developers → Webhooks**, add the endpoint `https://<preview-url>/api/stripe/webhook?x-vercel-protection-bypass=<bypass-secret>` and select the events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy the signing secret (`whsec_…`).
   - The query parameter is needed because Vercel Authentication would otherwise block Stripe. The secret appears in Stripe's logs; rotate it after the beta.
   - Use the **branch** preview URL (it stays the same across pushes), not a per-commit URL.
3. Testers pay with `4242 4242 4242 4242`, any future date, and any CVC. Every purchase is recorded as **simulated** in analytics because Stripe reports `livemode: false`.

### 4. Environment variables (Vercel → Preview scope)

| Variable | Value |
|---|---|
| `BETA_MODE` | `true` |
| `BETA_INVITES` | `alice:7f3k-q9xm,acme-excavating:p2v8-41nd` (label:code pairs; codes of 6 or more characters; remove a pair to revoke access) |
| `BETA_SECRET` | random, e.g. `openssl rand -base64 32` |
| `ADMIN_KEY` | random. Unlocks `/beta/admin` |
| `ENTITLEMENT_SECRET` | random (`openssl rand -base64 32`) |
| `DATABASE_URL` | Supabase transaction-pooler URI |
| `DATABASE_CA_CERT` | optional, see Supabase step 4 |
| `STRIPE_SECRET_KEY` | `sk_test_…` (live keys are refused) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `PRICE_CURRENCY` | `cad` (or `usd`) |
| `PRICE_BASIC_CENTS` / `PRICE_COMPREHENSIVE_CENTS` | e.g. `14900` / `29900` |
| `LLM_PROVIDER` | `openai` or `anthropic` |
| `OPENAI_API_KEY` **or** `ANTHROPIC_API_KEY` | from your provider account. Set a **monthly spend limit in the provider's dashboard as well** |
| `OPENAI_MODEL` / `ANTHROPIC_MODEL` | `gpt-5.5` / `claude-opus-5-5` (defaults) |
| `AI_ACCESS` | `testers` (default). Anonymous visitors always get the curated analysis |
| `AI_DAILY_BUDGET_USD` / `AI_MONTHLY_BUDGET_USD` | e.g. `5` / `40` |
| `AI_PER_TESTER_DAILY_RUNS` | e.g. `5` |
| `AI_PRICE_INPUT_PER_MTOK` / `AI_PRICE_OUTPUT_PER_MTOK` | set to your model's current list price (defaults assume gpt-5.5 at $5/$30, Claude Opus 5.5 at $4/$20) |
| `AI_FALLBACK` | `knowledge_base` (default) or `error` |
| `COMPANY_RESEARCH_ENABLED` | `false`. Leave off until licensing is resolved (see `data-licensing.md`) |
| `DEV_MODE` | **unset**. If set, the preview shows dev unlocks and all activity counts as simulated |
| `CONTACT_EMAIL` | optional |

`APP_URL` is optional on Vercel because the app derives it from `VERCEL_BRANCH_URL`.

### 5. Smoke test after deploy
1. Open the preview URL. You should be redirected to `/beta/join`. Enter an invite code.
2. Generate an ecosystem, open a few relationships, then open the report.
3. Buy the Basic report with the test card. You should return unlocked.
4. Visit `/beta/admin`, sign in with `ADMIN_KEY`, and confirm the funnel shows your events with `purchase_completed` under **Simulated**.

## Cost guardrails summary
- AI runs only for invited testers (`AI_ACCESS=testers`), only when the tester leaves "Use AI analysis" checked, and only within the daily, monthly, and per-tester caps. Identical business descriptions are served from a 7-day cache.
- Over-cap requests fall back to the curated analysis (or return an error if `AI_FALLBACK=error`) and say so on screen.
- Also set a hard limit in your OpenAI or Anthropic billing settings. The app's caps are estimates based on configured prices.
