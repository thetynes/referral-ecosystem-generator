# Business-data licensing for paid company research

**Status:** Paid company research is **disabled** (`COMPANY_RESEARCH_ENABLED=false`). Do not enable it until the decisions in §5 are signed off.

**Not legal advice.** This is product and engineering research based on publicly available terms as found in November 2026. Several primary pages could not be fetched from the build environment (see §6), so treat each finding as something to confirm, and have Canadian counsel review before charging for company data.

## 1. What we need to be allowed to do

| Need | Why it matters |
|---|---|
| Discover candidate organisations in a market | Core of the paid report |
| **Store** findings beyond a session | Reports are generated, reviewed, and re-downloaded |
| **Include** names, websites, locations, and business contact channels in a **paid, downloadable** PDF/CSV the customer keeps | This is the product |
| Process results with an LLM (classification, relevance) | Needed for quality at scale |

Short-term caching does not solve this. The question is whether we may **extract and redistribute** the data, not how long we hold it.

## 2. Findings by source

### Google Places API: not suitable for paid, exported reports
- Google Maps Platform terms prohibit exporting, extracting, or scraping Google Maps Content for use outside the Services. A third-party clause tracker quotes the wording as *"will not export, extract, or otherwise scrape Google Maps Content for use outside the Services"*, and Google's own archived Terms of Service carry the same "no scraping / no caching" restrictions. See [Google Maps Platform Terms (archive)](https://cloud.google.com/archive/maps-platform/terms-20250130) and [Conduct Atlas summary](https://conductatlas.com/platform/google-maps/google-maps-platform-terms-of-service/no-scraping-or-content-extraction/).
- Caching is permitted only as the Service Specific Terms expressly allow. Place IDs may be cached; some fields have 30-consecutive-day limits. See [Maps Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms).
- The [Universal Acceptable Use Policy](https://cloud.google.com/maps-platform/terms/other/universal-aup) also limits pre-fetching, caching, indexing, and storing outside Google's services.
- **Conclusion:** a CSV or PDF containing Places names, addresses, and phone numbers that the customer keeps is very likely "use outside the Services". Live, in-app display with Google attribution, storing only place IDs, is the narrow permitted pattern. That is not our product. **Use Google only with written authorisation from Google (e.g. an enterprise agreement), or not at all.**

### Brave Search API: retention needs a special contract
- Brave's help documentation states that retaining data received through the API is prohibited under the general terms, and that storage rights are granted only under special plans or contracts. See [Brave Search API](https://brave.com/search/api) and [Terms of Service](https://api-dashboard.search.brave.com/terms-of-service).
- The API grants **no rights to third-party content** (the web pages behind the results).
- There is conflicting public information about whether "Data for AI" plans include storage. Brave's own pages pair storage with a separate "storage rights" option ([community thread](https://community.brave.app/t/data-w-storage-rights-tos/571395)).
- **Conclusion:** at most, use Brave transiently as a pointer that surfaces an organisation's own website URL. That URL is then verified first-party (§3, step 3) and Brave's snippets are never stored. Even this should be confirmed with Brave in writing. Storing results requires a storage-rights contract.

### Openly licensed alternatives (recommended starting points)
| Source | Licence | Commercial + redistribution | Notes |
|---|---|---|---|
| **Overture Maps — Places** | CDLA-Permissive-2.0 for most sources; Apache-2.0 for Foursquare-sourced records (per-record `sources` field) | Yes | Include licence text when sharing data; Foursquare records carry Apache notice/change obligations. No ODbL share-alike in Places. [Attribution](https://docs.overturemaps.org/attribution) · [Places guide](https://docs.overturemaps.org/guides/places) · [Sept 2025 release notes](https://docs.overturemaps.org/blog/2025/09/24/release-notes/) |
| **Foursquare OS Places** | Apache-2.0 (applied to data — legally unusual) | Described as available for commercial use with attribution | Access now via registration/token. [Announcement](https://foursquare.com/resources/blog/products/foursquare-open-source-places-a-new-foundational-dataset-for-the-geospatial-community/) · [Evolving FSQ OS Places](https://foursquare.com/resources/blog/data/evolving-fsq-open-source-places/) |
| **Statistics Canada — Open Database of Businesses (ODBus)** | Open Government Licence – Canada | Yes, with attribution | Names, addresses, industry codes from municipal/provincial sources; **coverage is incomplete**. v2.0 released Nov 2024. [ODBus](https://www150.statcan.gc.ca/n1/en/catalogue/21260003) |
| **Municipal open-data business licence lists** | Usually OGL variants | Usually yes | Coverage varies by city; check each licence |
| **OpenStreetMap** | ODbL | Produced works yes; **derivative databases are share-alike** | Avoid storing OSM-derived records in our database unless we accept share-alike. |

Open data trades legal clarity for coverage and freshness. Expect gaps, especially for home-service businesses without storefronts. That is why first-party verification (§3) carries most of the weight.

## 3. Recommended discovery and verification workflow

1. **Candidate generation (lawful sources only).** Query Overture Places (filtered by category and service area), ODBus, and municipal open data. Store the record-level `licence`, `source`, and `retrieved_at` with every record. Exclude OSM-derived records from storage.
2. **User-supplied lists.** These are already supported through CSV import. The customer confirms they have the right to use the list. Values stay labelled "from your list".
3. **First-party verification.** For each candidate with a website, fetch only the organisation's own public site through the existing SSRF guard. Respect `robots.txt`, identify our crawler, rate-limit, and never go behind logins. Extract facts only: name, services, service area, and the business contact channel the organisation itself publishes (contact page URL, general phone or email). Store the facts, the page URL, and the date. Do not copy substantial page text; facts are not protected by copyright, but expression is.
4. **Field-level provenance (already built).** Mark each field verified (seen on the first-party site or a licensed record), inferred, user-provided, or unknown. Re-verify before every paid report export older than 90 days.
5. **Human review for paid tiers.** At beta scale, an analyst spot-checks each report before delivery. This is also what makes the "Advanced Research" tier credible.
6. **Personal information.** Collect only business contact information. PIPEDA does not apply to business contact information used solely to communicate with someone about their business role. Do not collect personal emails or mobile numbers of individuals, and do not infer email addresses. Outreach remains subject to CASL; the report already explains implied consent for conspicuously published business addresses.
7. **Report disclosures.** Add a sources and licences appendix (Overture/ODbus attribution text), the provenance legend (already built), and the statement that a verified business is not a willing partner (already built).

## 4. What changed in the product now

- `COMPANY_RESEARCH_ENABLED` (default **false**) hard-gates the discovery API and all UI. Paid reports no longer depend on, or promise, company research.
- Google Places and Brave providers remain in the code, but are unusable for paid research until this flag is on. The setup docs state the licensing conditions.
- CSV import (user-supplied data) remains available. It is the one discovery path with a clear rights position today.

## 5. Decisions needed before enabling paid research

1. Counsel review of: Overture/FSQ licence obligations for paid deliverables (Apache-2.0-for-data ambiguity), OGL-Canada attribution, first-party website fetching (terms of use, robots, copyright in compilations), and PIPEDA/CASL handling.
2. Decide on Google: obtain written authorisation, or drop it.
3. Decide on Brave: obtain written confirmation for transient pointer use or a storage-rights contract, or drop it.
4. Approve the build of the Overture/ODbus ingestion and first-party verifier (not built yet, per your instruction not to expand features).

## 6. Research limitations
Direct fetches of Google, Brave, Overture, Foursquare, Statistics Canada, open.canada.ca, OSM and ontario.ca pages were blocked by this build environment's network policy. Findings come from search-engine summaries of those pages plus archived copies. Every row above links the primary page to confirm against.
