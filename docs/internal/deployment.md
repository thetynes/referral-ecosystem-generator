# Deploying the protected beta (owner checklist)

**Internal.** This deploys the **web application** to Vercel. Publishing a Claude artifact (such as the Beta Readiness page) is unrelated and does not deploy anything.

Result: a private, invite-only web app at a Vercel preview URL that you can use and demonstrate to selected businesses. Test-mode checkout, a persistent database, and a private `/admin` area.

Time: about 45 minutes. Cost at beta scale: Vercel (preview deployments are included; use Pro for commercial use), Supabase Free, Stripe test mode (free), Google Places pay-as-you-go if enabled, AI off by default.

---

## Step 1: Supabase (database), about 10 minutes
1. Go to supabase.com → **New project**. Choose a Canadian region if offered and set a strong database password.
2. **SQL Editor → New query**: paste the contents of `supabase/migrations/0001_init.sql` and click **Run**.
3. **Connect** (top bar) → **Connection string** → **Transaction pooler**. Copy the URI (port `6543`), replace `[YOUR-PASSWORD]`, and do **not** add `?sslmode=…`. This is your `DATABASE_URL`.
4. Optional: download the CA certificate (Database settings → SSL configuration) for `DATABASE_CA_CERT`.

## Step 2: Generate secrets, about 2 minutes
Run this four times and keep the outputs for `BETA_SECRET`, `ENTITLEMENT_SECRET`, `ADMIN_KEY` and one invite code:
```bash
openssl rand -base64 24
```
Invite codes are `label:code` pairs, one per business, e.g. `northshore:Q7k2-p9vX-4mLs`. Remove a pair later to revoke access.

## Step 3: Vercel project, about 10 minutes
1. vercel.com → **Add New → Project** → import `thetynes/referral-ecosystem-generator` (connect GitHub if asked). Framework: Next.js; leave build settings as they are.
2. **Before the first deploy**, open **Settings → Environment Variables** and add the variables in the table below with the **Preview** environment ticked only.
3. **Settings → Deployment Protection**: leave **Vercel Authentication** on (Standard Protection). Then, under **Protection Bypass for Automation**, create a secret and copy it for Step 4.
4. Function timeouts: the analysis route declares a 180-second limit (needed only if AI is turned on; playbook analyses finish in seconds), and company search declares 120 seconds. Current Vercel plans with Fluid Compute allow this. If a deploy fails with a function-duration error, your plan's limit is lower. Lower `maxDuration` in `src/app/api/analyze/route.ts` to 60, or ask me to.
5. **Deployments**: deploy the branch `claude/peaceful-keller-4dsnhg` (pushes deploy automatically once the project is connected). Copy the **branch URL**, which looks like `referral-ecosystem-generator-git-claude-peaceful-keller-4dsnhg-<team>.vercel.app`. It stays the same across pushes.
6. Do **not** assign a production domain or promote to Production.

> **Who can open the preview?** With Vercel Authentication on, visitors must be logged into Vercel *and* have access to your team. For outside businesses, either (a) use Vercel's **Shareable Link** for the deployment, or (b) set Deployment Protection to **Only Production Deployments** for this project, so the app's own invite-code gate (`BETA_MODE=true`) protects the preview. Option (b) is simpler for demos; the app still requires an invite code on every page.

### Environment variables (Preview scope)
| Variable | Value |
|---|---|
| `BETA_MODE` | `true` |
| `BETA_INVITES` | your `label:code` pairs, comma-separated |
| `BETA_SECRET` | from Step 2 |
| `ENTITLEMENT_SECRET` | from Step 2 |
| `ADMIN_KEY` | from Step 2. Opens `/admin` |
| `DATABASE_URL` | from Step 1 |
| `DATABASE_CA_CERT` | optional, from Step 1 |
| `STRIPE_SECRET_KEY` | Stripe **test** secret key `sk_test_…` (Step 4) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (Step 4) |
| `PRICE_CURRENCY` | `cad` |
| `PRICE_BASIC_CENTS` / `PRICE_COMPREHENSIVE_CENTS` | e.g. `14900` / `29900` |
| `CONTACT_EMAIL` | optional, shown as "Want help with research and outreach?" |
| `COMPANY_RESEARCH_ENABLED` | `false` until Step 5 |
| `GOOGLE_PLACES_API_KEY` | optional (Step 5) |
| `AI_ACCESS` | leave unset (off). Set to `testers` only if you want AI analyses; see `implementation-report.md` |
| `DEV_MODE` | **leave unset** |

## Step 4: Stripe (test mode), about 10 minutes
1. Stripe Dashboard → turn on **Test mode** → **Developers → API keys** → copy the **Secret key** (`sk_test_…`) into `STRIPE_SECRET_KEY`. Live keys are refused by the app unless `STRIPE_ALLOW_LIVE=true`.
2. **Developers → Webhooks → Add endpoint**: URL `https://<branch-url>/api/stripe/webhook?x-vercel-protection-bypass=<bypass-secret>`. Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Redeploy (Deployments → … → Redeploy) so the new variables take effect.

## Step 5 (optional): Google Places company research
Follow `discovery-providers.md` → *Google Places setup*, read its **Unresolved provider restrictions**, then set `GOOGLE_PLACES_API_KEY` and `COMPANY_RESEARCH_ENABLED=true` and redeploy.

## Step 6: Smoke test, about 10 minutes
1. Open the branch URL. You should see **Private preview**; enter an invite code.
2. Generate an ecosystem for one of your target businesses. Open a few partners and the report.
3. Click **Basic** in the upgrade box and pay with `4242 4242 4242 4242`, any future date, and any CVC. You should return unlocked.
4. Open `/admin` and sign in with `ADMIN_KEY`. Under **Setup checklist**, every item should read *ready*, except Company research if you skipped Step 5. Under **Funnel**, *Purchases completed* should show 1 under **Simulated**.
5. In `/admin → Demo access`, paste an ecosystem link to create a demo link for a business you are presenting to.

If something fails, check `/admin → Diagnostics` first, then Vercel → Deployments → **Functions logs**.
