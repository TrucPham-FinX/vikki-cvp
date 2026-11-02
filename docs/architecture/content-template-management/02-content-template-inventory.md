# 02 — Content & Template Inventory and Classification

> `FE/` = `dev/s3-bucket-apse5-dev-vikki/front-end/`, `OUT/` = `dev/s3-bucket-apse5-dev-vikki/vikki-cvp/`.
> **[FACT]** verified in code, **[REC]** recommendation, **[ASSUMPTION]**/**[UNKNOWN]** not verified.

This document classifies what actually exists. It only recommends concepts that the codebase gives evidence for. Concepts from the brief that have no evidence are listed in §6 as **not needed now**.

---

## 1. Content that exists today

| Content kind | Instances [FACT] | Where it lives | Shape | Authored by |
|---|---|---|---|---|
| **CVP landing page** (product value proposition inside the app) | 13 JSON-driven (`layout:"template"`) + 4 hand-coded hbs (go, pro, go-plus, co-badged) + 6 hand-written HTML (td-cvp, loan-cvp, credit-card-sale, sim, hd-saison, vneid) | `FE/data/<page>/index.json` · `<page>.json` · `en.json`/`vi.json` | `{title, layout, className, hasTopSpace, hasBackground, bannerVideoHlsSrc?, components[], qaGroup[]}` | Developers |
| **Legal document** (T&C, claim guide, insurance wording) | ~20 | `FE/data/<page>/tc*.json`, `claim-*.json`, `insurance-wording-*.json` | `{id, version, layout, header{img,h1,intro[]}, sections[]{id,title,defaultExpanded, articles[]{id,title,blocks[]} \| blocks[] \| sections[]}, note, footer}` (4 nesting variants) | Developers transcribing Legal's Word/PDF |
| **Fee schedule** | 6 | `FE/data/<page>/fee.json` | `{id, version, layout:"fee", blocks[]}` with `table` blocks (`headerRows[]`, `rows[].cells[]{value,colspan,rowspan}`) | Developers |
| **Promotion** (collection) | 43 current, 70 orphaned in `OUT/` | `FE/data/promotion/list.json` → `items[]` | `{id, promotionGroup, promotionCate, promotionCode, name, thumbnail, shortDesc, longDesc(HTML), startDate, endDate, createdDate, updatedDate, isHotDeal, extraData}` | Business in Excel → `convertExcelToJson.html` → dev pastes |
| **Card intro** (collection) | 5 | `FE/data/card-intro/list.json` | `{id, cardGroup, thumbnail, name, longDesc}` | Developers |
| **FAQ** | ~15 sets; one-connect alone has 200 Q&As | Embedded in each landing page: `qa[]` (inline teaser) + `qaGroup[]{title, children[]{title, content(HTML)}}` (full popup) + legacy `qaItems[]` (base layout) | Same Q&A stored **twice** per page (teaser and full list); `qaItems`/`tempQA` unused on template pages | Developers |
| **Product plan details** | 3 (safe-plus) | `FE/data/vikki-safe-plus-cvp/{en,vi}.json` → `details[]` | Benefits tables, allowances | Developers |
| **Calculator / rate data** | 1 (TD interest) | **Hard-coded in JS** in `OUT/td-interest-cvp/index.html:681-760` | `termOptions`, `interest` maps | Developers |
| **Campaign schedules / FAQ** | 1 (golden-saving landing) | Hard-coded in JS, `OUT/golden-saving-landing-page/index.html:888-1168` | arrays | Developers |
| **SEO metadata** | `<title>` only; `<meta name="description" content="">` empty everywhere (`FE/components/header.hbs:6`) | – | – | – |
| **Localized content** | 3 pages (foreign-exchange, safe-plus, nnn [en only]) | `en.json`/`vi.json`, `<tpl>-<locale>.json` | Full-document duplication per locale | Developers |

**[FACT] Observations**
- Most "marketing copy" is not text but **images**: 55 `imageSection` blocks plus slider slides and section titles. Text appears mainly in FAQs and legal documents.
- **SEO is irrelevant here.** These pages render inside a WebView or iframe; `<meta description>` is empty everywhere and there is no sitemap.

---

## 2. Templates that exist today

| Template kind | Exists? | Evidence | Classification |
|---|---|---|---|
| Page template (landing) | Yes, as `layouts/template.hbs` (generic block renderer) **plus** 18 per-page `.hbs` that are mostly CSS overrides | 8 of 18 page `.hbs` are 100% `<style>`; `home-loan-cvp/index.hbs` ≡ `consumer-secured-loan-cvp/index.hbs` modulo class prefix; `vikki-nnn-cvp/index.hbs` ≡ `vikki-od-at-branch-cvp/index.hbs` byte-for-byte | Per-page `.hbs` is **styling, not a template**. Real template = `template.hbs` |
| Legal-document template | Yes, three of them: `static.hbs`, `legal-document.hbs`, `fee.hbs` | Same block vocabulary (`paragraph/subheading/list/table`), two partial sets `static/*` and `legal/*` | Should be **one** template with variants |
| Listing template | Yes: `pages/promotion/list.hbs` (client-side filter by `?category=`) | `list.hbs:29-46` | Collection list |
| Detail template | Yes: `pages/promotion/detail.hbs`, `pages/card-intro/detail.hbs`, `safePlusPlanDetails` | `build.js:318-345` / `180-221` | Collection detail; two build mechanisms (`items[]` vs `details[]`) |
| Email / notification / document (PDF) / dashboard templates | **No** | Not in this repo. T&C PDFs are linked, not generated | Out of scope |
| Business-specific templates | Yes, implicitly: safe-plus overview, one-connect (partners + bridge), golden/kilo (hotspots + custom slider) | `components/safePlus*.hbs`; `pages/vikki-one-connect/index.hbs:233-303`; `pages/vikki-golden-savings/index.hbs:313-588` | Should become **custom blocks**, not templates |

---

## 3. Layouts that exist today

| Layout concept | Exists? | Evidence |
|---|---|---|
| Global layout (HTML shell, fonts, base CSS/JS) | Yes, but copied 8 times: each layout re-declares `<head>`, Google Font link, `box-sizing` reset | `layouts/*.hbs` |
| Page layout | Yes, by `data.layout` string | `build.js:111` |
| Section layout | Partially: the `gjs-row container` / `gjs-cell` wrapper repeated inside blocks and inside `template.hbs:37,50` | `components/image.hbs:1`, `activation.hbs:1` |
| Grid / responsive layouts | No grid system. Pages are single-column mobile; responsiveness is done by full-width images. Only iframe widgets have media queries | `golden-saving-landing-page/index.html:433,443` |
| Nested layouts | Only in legal docs (`sections → sections → articles → blocks`) | `components/static/section.hbs:21-25` |

---

## 4. Components / blocks that exist today

Counts are taken from all `"type"` values in `FE/data/**/*.json` **[FACT]**:

| Block `type` | Uses | Renderer | Category | Notes |
|---|---|---|---|---|
| `imageSection` | 55 | `components/image.hbs` | Content block | Optional `link` (opens popup), `loading` spinner, `id` anchor |
| `topMenu` | 16 | `components/topMenu.hbs` | Navigation block | Items either `popup` or `scroll`; hard-coded `id='qa'` wrapper |
| `qa` | 13 | `template.hbs:49-71` + `components/qa.hbs` | Content block | Title is an image; optional "see more" button opens FAQ popup |
| `activation` | 13 | `components/activation.hbs` | CTA block | `feeButton` / `termsButton` / `termsButtonFullW` (3 variants of "legal links") |
| `slider` | 9 | `template.hbs:36-43` + `components/slider.hbs` | Content block | Swiper; slides may open popups |
| `video` | 8 | `components/video.hbs` + `scripts.hbs:139-204` | Hero block | **Ignores its own props**; source comes from page-level `bannerVideoHlsSrc` |
| `tooltip` | 1 | `components/tooltip.hbs` (ships own `<script>`) | Interactive widget | |
| `title` | 1 | `components/title.hbs` | Content block | Raw HTML `{{{title}}}` |
| `flex` | 1 | `components/partners.hbs` | Business widget | Partner grid; behaviour lives in one-connect page JS |
| `cardInfo` | 0 | `components/cardInfo.hbs` | – | Dead |
| `paragraph` / `subheading` / `list` / `table` | 1199 / 78 / 623 / 70 | `static/blocks/*`, `legal/blocks/*` | Document blocks | Two parallel renderers; `legal` has no table |
| *(implicit)* safe-plus overview, plan details | 1 page | `safePlusOverview.hbs`, `safePlusPlanDetails.hbs` | Business widget | Driven by ~30 top-level JSON keys |
| *(implicit)* golden hotspots + custom pagination | 2 pages | page `<script>` | Interactive widget | Selects DOM by image filename |
| *(implicit)* FAQ popup | all landing pages | layout + `qaTemplate` | Global UI | |

---

## 5. Classification decisions

For each concept in the brief:

| Concept | Exists? | Overlaps with | Independent entity? | Reusable across types? | Owner | Runtime config? |
|---|---|---|---|---|---|---|
| **Page (content entry)** | Yes | – | **Yes** | – | Admin | No (build-time) |
| **Content Type** | Implicit (4) | Template | **Yes** — needed to validate data | – | Developer | No |
| **Content Schema** | No | Content Type | Part of Content Type, not separate | – | Developer | No |
| **Template** | Yes (over-produced) | Layout, Content Type | **Yes, but few**: one per content type (`landing`, `document`, `collection-list`, `collection-detail`) | – | Developer | No |
| **Template Version** | No | Block version | **No** — git history is enough; version blocks instead (§08 ADR-006) | – | – | – |
| **Layout** | Yes (8) | Template | **No**: fold the HTML shell into one `shell` partial; "layout" becomes a template concern | – | Developer | No |
| **Section** | Implicit (`gjs-row` wrapper) | Block | **No**: a section is just a block's wrapper. Exception: legal `sections`, which are content structure | – | – | – |
| **Block / Component** | Yes (10 + 4 doc blocks) | Partial | **Yes**: the main admin-facing building unit | Yes (landing, detail) | Developer defines, Admin uses | Props only |
| **Theme / variant** | Implicit (per-page CSS copies) | Template | **Yes**: replaces the per-page CSS-only templates | Yes | Developer defines, Admin selects | No |
| **Data Source** | No runtime sources | – | **Only build-time collections** (promotions, card-intro, FAQ sets) | Yes | Developer | No |
| **Data Binding** | No (only URLs pointing at other pages) | – | **Lightweight**: references like `{"$ref":"promotion?category=VIKKI_ONE"}` resolved at build | Yes | Admin picks, Developer defines | No |
| **Media Asset** | Files per page | – | Keep as files; add a manifest and lint, **not** a DAM | Per page | Admin uploads | No |
| **Localization** | Opt-in per page | – | **Locale is a dimension of an entry**, not an entity | Yes | Admin | No |
| **Publishing configuration** | Implicit (git + manual copy) | – | **Yes**: an env promotion manifest | – | Admin + Dev | – |
| **Runtime context** (query params, app bridge) | Yes, undocumented | – | **Yes, as a code contract** | Yes | Developer | **Yes**: the only true runtime config |

---

## 6. Explicitly not recommended now (no evidence in the codebase)

| Concept from the brief | Why not now |
|---|---|
| Email / notification / document / dashboard templates | Nothing in this repo produces them. Different delivery channels belong to different systems |
| Runtime content API / headless delivery | Pages are static and cached by CloudFront, with no backend. A runtime API adds latency and an availability dependency for zero current benefit |
| Template inheritance trees | Only one real landing template exists. Composition (blocks + theme) covers all observed variation |
| Grid / responsive layout builder | All landing pages are single-column mobile WebView pages made of full-width images |
| Per-template versioning entities | Git already versions everything. What needs compatibility tracking is **block prop schemas** |
| Fine-grained RBAC | No admin UI exists yet. Start with git/CODEOWNERS path ownership |
| SEO metadata management | WebView/iframe pages are not indexed |
