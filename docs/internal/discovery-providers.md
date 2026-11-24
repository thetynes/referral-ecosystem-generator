# Company discovery: providers, settings and unresolved restrictions (internal)

**Audience:** the owner and administrators only. Not customer-facing. This is not legal advice.

## How discovery works in the product

1. A customer with a full report (paid, or a demo link from `/admin`) opens **Companies → Find companies**.
2. The server searches the configured provider for each of the customer's top partner types in their service area: 5 types for Basic, up to 15 for Comprehensive, and 5–6 companies per type.
3. Each company is stored with **field-level provenance**:
   - **Confirmed by source**: the value came directly from the provider's listing (Google Maps listing name, address, website, phone, category).
   - **Inferred**: derived by us, e.g. a company name taken from a web-search page title.
   - **From your list**: uploaded by the customer (CSV).
   - **Not found**: the field wasn't available.
4. The *partnership approach* shown on each company is explicitly labelled as based on the partner type, not on that company. A confirmed listing is never presented as a willing partner.
5. Partial failures are shown to the customer ("We couldn't search for …") and logged as `discovery_run` events with `failedCategories` in `/admin → Diagnostics`. Customers can re-run a search that had failures.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `COMPANY_RESEARCH_ENABLED` | `false` | Master switch. When false, customers see "Company research is coming soon" and the API refuses searches. |
| `GOOGLE_PLACES_API_KEY` | none | Enables Google Places (preferred when set). |
| `DISCOVERY_PROVIDER` | auto | `google_places`, `brave`, or `none`. |
| `BRAVE_SEARCH_API_KEY` | none | Alternative web-search provider (weaker evidence: names are inferred). |
| `GOOGLE_PLACES_IN_EXPORTS` | `false` | Whether Google-sourced companies are included in CSV downloads. When false they stay viewable in the app and the printable report but are left out of CSV files, and customers are told so. |
| `DISCOVERY_RETENTION_DAYS` | `30` | How long search results are kept before they expire. |
| `DISCOVERY_MAX_RESULTS` | `8` | Provider page size. |

### Google Places setup (your action)
1. In Google Cloud, create or select a project, enable **Places API (New)**, and attach billing.
2. Create an API key. Under **API restrictions**, restrict it to Places API (New). The key is used server-side only; it is never sent to browsers.
3. Set a **quota cap** and a **budget alert** in Google Cloud. The app requests website and phone fields, which bill at a higher Text Search tier than basic fields.
4. In Vercel (Preview scope): set `GOOGLE_PLACES_API_KEY`, then `COMPANY_RESEARCH_ENABLED=true` once you accept the restrictions below.
5. Run one search from a demo link and check `/admin → Diagnostics` for `discovery_run` with `failedCategories=0`.

I could not test Google Places from the build environment because the API needs a custom key header that this environment cannot inject. The integration is covered by mocked tests only until you run step 5.

## Unresolved provider restrictions (decide before charging customers)

| Topic | What the terms appear to say | What the product does now | Your decision |
|---|---|---|---|
| **Exporting Google content** | Google Maps Platform terms prohibit exporting or extracting Google Maps Content for use outside Google's services. | CSV downloads exclude Google-sourced companies unless `GOOGLE_PLACES_IN_EXPORTS=true`. The printable report still shows them, and a printed or PDF report is arguably also "outside the Services". | Keep excluded, seek written clarification or authorisation from Google, or switch report research to a source licensed for redistribution. |
| **Caching / storage** | Most Places content may not be cached beyond what the Service Specific Terms allow. Place IDs may be stored indefinitely. | Results are kept for `DISCOVERY_RETENTION_DAYS` (default 30). | Shorten retention, or store only place IDs and re-fetch details on view (more API cost, cleaner compliance). |
| **Attribution** | Places content shown without a Google map requires Google attribution. | Each Google result is labelled "Google Maps listing" with a "View on Google Maps" link, and the companies list and report state that details come from Google Maps. | Confirm the wording and logo requirements against Google's current attribution policy. |
| **Use with AI** | Not established. | Discovery results are **not** sent to the AI provider. | Keep it that way unless terms permit it. |
| **Brave Search** | General terms prohibit retaining results; storage requires a separate agreement. | Brave is configurable but not recommended; names from Brave are labelled "Inferred". | Don't enable without a storage-rights agreement. |
| **Personal information** | PIPEDA treats business contact information used for business communication differently from personal information. | Only business listing contact channels (phone, website) are stored; no personal emails. | Confirm with counsel before any outreach features. |

### Lower-risk alternatives (not built)
Openly licensed datasets (Overture Maps Places under CDLA-Permissive-2.0 or Apache-2.0, and Statistics Canada's Open Database of Businesses under the Open Government Licence – Canada) combined with first-hand checks of each company's own website. See `data-licensing.md` for the full analysis and sources.
