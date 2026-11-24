# Customer experience review: first-time visitor (internal)

Reviewed on 24 November 2026 against a local production build configured like the beta deployment: invite-only, development mode off, test-mode checkout, playbook analysis (AI off), company research off, `/admin` enabled. Screenshots are in [`cx-review/`](cx-review/), and every visible line of text from the main pages is in [`cx-review/all-text.txt`](cx-review/all-text.txt).

## The three experiences

| Experience | Routes | Protection |
|---|---|---|
| **Public marketing** | `/` (landing, demo map, pricing, FAQ), `/ecosystem/demo` (labelled example) | In beta: invite code. After launch: public. |
| **Customer application** | `/generate`, `/ecosystem/[id]`, `/report/[id]`, `/saved`, `/checkout/success` | Invite code in beta. Full report requires payment or an admin demo link. |
| **Private administration** | `/admin`, `/api/admin/*` | Separate `ADMIN_KEY`, never linked from the customer UI. The whole area returns 404 when `ADMIN_KEY` is unset, and admin APIs return 404 without an admin session. |

## Walkthrough

| # | Screen | What the visitor sees | Status |
|---|---|---|---|
| 1 | `01-invite` | "Private preview" with an invite-code field and a short note on usage tracking | Good |
| 2 | `02-landing` | Headline, subheadline, primary CTA, labelled example map, benefits, how it works, pricing, FAQ | Good |
| 3 | `03-intake`, `04-intake-filled` | Three short sections plus example chips; an optional website read | Good |
| 4 | `05-loading` | "Building your referral ecosystem" with plain-language steps. Playbook analyses finish in about a second, so this is barely seen | Good |
| 5 | `06-ecosystem` | Industry focus badge, interactive map with the 5 free partner types, upgrade box, "How this ecosystem works" | Good after fixes |
| 6 | `07-relationship-detail` | Who decides, why it works, trigger events, mutual value, first step, priority breakdown | Good |
| 7 | `08-opportunities`, `09-triggers` | Filterable list; trigger table | Good |
| 8 | `10-companies` | "Find companies in your area" says *coming soon*; spreadsheet upload works | Honest. Not operational until Google Places is configured. |
| 9 | `11-report-free` | Printable report for the free tier | Good |
| 10 | `12-unlocked`, `12b-report-full` | After payment or a demo link: all 22 partner types; the map shows the top 12 with "Show all" | Good after fixes |
| 11 | `14-mobile-landing`, `15-mobile-ecosystem` | Phone layout with list-first opportunities and a bottom-sheet detail | Good after fixes |
| — | `13-admin` | Owner only: setup checklist, configuration, demo links, funnel, testers, AI spend, diagnostics | Internal only |

## Fixed during this review
- Removed from customer screens: AI and model names, "curated profile/knowledge base", match-confidence labels, development-mode banner and unlock buttons, JSON export, "configured provider" and data-licensing wording, Stripe internals, server and API error wording, "not sent to AI providers" hints, and the AI toggle on the intake form.
- AI fallbacks, budget limits and cache hits now go to internal diagnostics and `/admin`. They never reach the customer.
- Error messages rewritten in customer language, e.g. "We couldn't build your ecosystem just now. Please try again in a few minutes."
- Company results labelled "Google Maps listing", with "View on Google Maps" links and "Confirmed by source / Inferred / From your list / Not found" field labels. Partial search failures are stated plainly.
- Large maps open on the top 12 partner types instead of an unreadable 22.
- The long industry badge no longer makes phone pages scroll sideways (now covered by an automated test).
- Upgrade buttons and the contact line no longer crowd each other; "partner categories" and "partner types" are now used consistently.
- Narrative wording ("A typical moment: … Usually spotted first by: …").
- Demo links were built with the wrong host when `APP_URL` was unset; they now use the address the admin is on.
- An automated test fails if customer pages show developer or provider terms (API, model names, knowledge base, pipeline, and so on).

## Remaining items (not changed: your call or outside this build)
1. **Company research is "coming soon"** until you add a Google Places key and enable it. It is not testable from the build environment.
2. **Basic and Comprehensive differ little** while company research is off. Consider hiding Comprehensive for the beta.
3. **Preview checkout wording** ("no charge is made, use card 4242…") is intentional for testers and disappears with live payments.
4. **Saved ecosystems live in the visitor's browser.** Opening the same link on another device works, but the Saved list won't show it there.
5. **"Save as PDF" uses the browser's print dialog.** It works, but the dialog wording varies by browser.
6. **Blended industry labels can be long**, e.g. "Basement waterproofing & foundation repair + Excavation & site construction". They wrap correctly but read as busy.
7. **Invite page wording** says "closed beta", which is appropriate now; change it when you launch publicly.
