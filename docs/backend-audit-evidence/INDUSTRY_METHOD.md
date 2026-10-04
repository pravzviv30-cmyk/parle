# 100-app/service public-disclosure benchmark

Completed 3 October 2026 for the Luvani backend production audit.

Deliverables:

- `100-app-source-register.csv`: 100 distinct app/service entries, 100 unique primary source URLs, stated practice, relevance/inference, evidence scope, retrieval date, source title/date, validation method/status and explicit assurance limits.
- `100-app-source-register.json`: equivalent structured register.
- [BACKEND_INDUSTRY_BENCHMARK.md](../BACKEND_INDUSTRY_BENCHMARK.md): 25 sourced production practices with specific implementation/verification criteria and a recommended architecture boundary for Luvani.
- `validation-summary.json`: exact scope and retrieval counts.
- Original fetch failures were preserved during research. The final register explicitly identifies six primary web-reader fallbacks/corrections rather than claiming all Firecrawl requests succeeded.

Method: broad web discovery followed by primary company engineering posts, official product/API/security documentation, and vendor-published first-party customer case studies. Firecrawl retrieved original page content; the web reader was used when Firecrawl refused a domain, failed a fetch, or exposed an incorrect/outdated source. Stated disclosures were checked against retrieved content. Security statements and case-study performance metrics are publisher disclosures, not independently reproduced tests.

Completed targeted verification: **100/100** entries. Retrieval used **94 Firecrawl page bodies and 6 web-reader primary-source bodies**. The six fallback/correction entries are Reddit, LinkedIn, Telegram, HBO Max, Roblox, and Instacart.

Evidence scopes: 61 app technical, 19 app security, 6 app API, 3 platform technical, 7 company technical, 2 subsystem technical, 1 app operations, 1 company operations. `app-technical` means an app-specific component disclosure, not a complete stack. Company and subsystem rows are deliberately explicit about scope. No complete private architecture was inspected.

This is a representative 100-entry research cohort, **not a universal top-100 ranking**. App categories include education, wellness, fitness, social/messaging, communications, streaming, gaming, productivity, commerce, delivery/mobility, travel and finance. Distinct apps sharing a parent are not treated as independent proof of different private infrastructures; each row has a different source URL and names what the source actually establishes.

Historical posts remain historical. A current retrieval date does not turn a 2011–2017 disclosure into evidence of the app's 2026 architecture. Source publication dates are retained when stated in the article or metadata; otherwise the register states that they were not determined. Raw JSON page metadata may contain inconsistent dates and is not deployment evidence.

Raw scraped pages and search outputs were used for validation in the temporary research workspace; they are not copied into this deliverable. The source register, titles, dates, retrieval methods and limitations retain provenance without redistributing complete third-party pages.
