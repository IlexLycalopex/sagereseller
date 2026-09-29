# sagereseller.com: The Sage Buyer's Guide

Astro static site with one selector island and a Cloudflare Pages Function for report requests. Built to the v1.0 specification and the 3a "Navy chrome" design statement.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm test` | Selector fixtures (spec D2), UTM builder, report function helpers |
| `npm run build` | Content checks, Astro build, then rendered-site checks. Fails on any breach |
| `npm run og` | Regenerates `public/images/og-default.png` |

Build-time checks (`scripts/check-content.mjs`, `scripts/check-dist.mjs`) fail the build on: em dashes or exclamation marks; `lastReviewed` older than 120 days; missing author or sources; a missing disclosure strip, footer disclosure or author box; any mysoftx3.com link without the `utm.ts` parameters; inline executable scripts; more than one `<h1>`; titles over 60 characters.

## Where things live

| Path | Purpose |
|---|---|
| `src/data/selector.rules.json` | Questions, weights, hard rules, gaps, outcome copy and the sources behind every capability statement |
| `src/lib/scoring.ts` | Pure engine `score(answers, rules)`, also used server-side |
| `src/data/links.json` + `src/lib/utm.ts` | Mysoft link map; every Mysoft link goes through `mysoftUrl()` or `<MysoftLink>` |
| `src/content/comparisons`, `guides`, `marketplace` | Editorial content with typed frontmatter (`src/content.config.ts`) |
| `src/pages/sage-intacct-or-sage-x3.astro` | Crawlable decision guide generated from the rules file |
| `src/islands/` | Selector renderer (shared with the server-rendered first question) and controller |
| `functions/api/report.ts` | Turnstile, Zoho upsert, Resend email, KV queue |
| `functions/api/retry-leads.ts` | Flushes queued leads; call on a schedule with `RETRY_TOKEN` |

## Cloudflare Pages settings

Build command `npm run build`, output `dist`.

Public build variables: `PUBLIC_GA4_ID`, `PUBLIC_TURNSTILE_SITE_KEY`, and `PUBLIC_NOINDEX=true` on preview.

Secrets: `TURNSTILE_SECRET`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNTS_URL`, `ZOHO_API_DOMAIN`, `ZOHO_SUBSOURCE_FIELD`, `RESEND_API_KEY`, `REPORT_FROM`, `REPORT_REPLY_TO`, `SALES_NOTIFY_TO`, `RETRY_TOKEN`. KV binding: `LEAD_QUEUE`.

Zone settings outside the repo: www to apex Redirect Rule; allow the AI crawlers listed in `public/robots.txt` in bot management; IndexNow.

## Content standard

Every factual statement on the site must be checkable against a source listed on the same page. Pages carry `verified: true` only when that is the case, and the build fails on any comparison or guide without it.

- Vendor capabilities are stated only where the vendor's own pages, documentation or a named third-party source say so. Where no source covers a capability, the table says "Check in a demo" rather than guessing.
- Mysoft facts (delivery options, cost views, industry positioning) cite Mysoft's own pages, labelled as Mysoft.
- Advice, checklists, supplier questions and the selector's weights are presented as the guide's view, not as fact.
- Sources were checked on 29 September 2026 by web search and direct fetch. sage.com, netsuite.com and mysoftx3.com could not be fetched directly from the build environment, so those facts were confirmed from search results quoting those pages.

When you edit content, keep to the same rule: add the source first, then the claim.

## Open items before launch

- Jamie's portrait: add `public/images/jamie-watts.jpg` (square, at least 176px). Until then a "JW" block is shown.
- Webfonts (D4): see `docs/fonts.md`. The site uses the system stack until the files are added.
- Corrections inbox `guide@sagereseller.com`, the sales notification address, and the Zoho `Lead_Source` picklist value and Sub-Source field name.
- `mysoft-tco` points to the Toolkit calculator until a dedicated TCO page exists.
- Add-on partners: only Sage's marketplaces and X3CloudDocs are listed. Add others as JSON files in `src/content/marketplace/` with `relationship` and `sponsored` set.

## Not built yet

- Per-page OG images (one default image is used).
- US variants and hreflang (phase 2).
