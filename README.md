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
| `src/data/selector.rules.json` | Questions, weights, hard rules, gaps, outcome copy. Consulting edits this by pull request |
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

## Open items before launch

**[CONFIRM] Mysoft decisions**

- Link map (D6): all URLs came from mysoftx3.com search listings on 29 Sep 2026. `mysoft-rapid-deploy` points to the Kickstart page and `mysoft-tco` to the Toolkit calculator until dedicated pages exist.
- Company details in `src/data/site.json`: number 05208408 (Companies House listing for MYSOFT LIMITED) and the Fleet trading address. The registered office on Companies House is a London address, so check which one the footer should show.
- Jamie's personal LinkedIn URL (the author file currently uses the Mysoft company page) and years of experience for the author box.
- Portrait: add `public/images/jamie-watts.jpg` (square, at least 176px). Until then a "JW" block is shown.
- Webfonts (D4): see `docs/fonts.md`. The site uses the system stack until the files are added.
- Corrections inbox `guide@sagereseller.com`, the sales notification address, and the Zoho `Lead_Source` picklist value and Sub-Source field name.
- ISV partners (D7): only Sage's marketplaces and X3CloudDocs are listed. Add partners as JSON files in `src/content/marketplace/` with `relationship` and `sponsored` set.
- Indicative timeline and cost ranges for the report email. The email currently offers a call instead.
- Privacy notice retention period (three years is a placeholder) and legal review (D3, D8).

**[VERIFY] Consulting review**

- Every comparison and guide has `verified: false`. The content check lists these as warnings; set `verified: true` after review.
- Selector weights, hard rules and fit profile (rules marked `"verify": true`), with Amey Richardson.
- Competitor statements, particularly for Rillet and Campfire, which are new and change quickly.

## Not built yet

- Per-page OG images (one default image is used).
- Phase 3 comparisons: Sage X3 vs Business Central, Sage X3 vs Acumatica.
- US variants and hreflang (phase 2).
