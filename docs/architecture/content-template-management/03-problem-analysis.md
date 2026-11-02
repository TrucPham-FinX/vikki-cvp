# 03 — Problem Analysis & Restructuring Opportunities

> `FE/` = `dev/s3-bucket-apse5-dev-vikki/front-end/`, `OUT/` = `dev/s3-bucket-apse5-dev-vikki/vikki-cvp/`.
> Every item cites evidence. **[FACT]** verified; **[REC]** recommendation.

## 1. Problems found

### P1. Per-page templates are copy-pasted CSS forks **[FACT]**
**Evidence:**
- 8 of 18 page `.hbs` files contain only `<style>`: home-loan, consumer-secured-loan, lixi, loan, nnn, od-at-branch, od-cbnv, and safe-plus/tc/claim.
- Measured with `diff | grep -c '^[<>]'`:

| Pair | Differing lines | What differs |
|---|---|---|
| `home-loan-cvp/index.hbs` vs `consumer-secured-loan-cvp/index.hbs` | 48 | Only the class prefix |
| `vikki-od-at-branch-cvp` vs `vikki-nnn-cvp` | 0 | Nothing |
| `vikki-od-at-branch-cvp` vs `vikki-od-cbnv-cvp` | 7 | One CSS rule moved |
| `vikki-golden-savings` vs `vikki-savings-kilo-gold` | 134 | 126 are the class prefix |

- `vikki-lixi-2026/index.hbs` still uses the `.vikki-one-connect` prefix, which matches nothing on that page.

**Impact:**
- Each new CVP starts by copying about 220 lines of CSS.
- Fixes don't propagate. For example, `33ac990 "update heigh for other cvp"` had to touch many pages.

### P2. Content and presentation are mixed in templates **[FACT]**
**Evidence:**
- **vikki-go, vikki-pro, vikki-go-plus, card-co-badged** hard-code these in `.hbs`: the menu, 15–23 image paths, category codes (`VIKKIGO_HDB`, `VIKKI_PRO`) and CTA URLs.
- **vikki-go-plus and card-co-badged** also have a JSON `topMenu`, so the page renders **two menus**.
- **vikki-go** links its T&C through a **Google Docs viewer** of a prod PDF (`vikki-go-cvp.hbs:164`). The `fee.html`/`tc.html` built for that page are unused.
- **vikki-one-connect/intro.hbs** hard-codes about 70 lines of Vietnamese copy.

### P3. Block dispatch is a silent `if` chain **[FACT]**
**Evidence:** `FE/layouts/template.hbs:11-77` dispatches with `{{#if (eq type "…")}}` per type.
- A typo such as `"imagesection"` renders **nothing**, with no warning.
- No block declares its props. `video` ignores its own `src`/`id`/`className`; the real source is page-level `bannerVideoHlsSrc` (`scripts.hbs:156`).
- Wrapper markup for `slider` and `qa` lives in the layout (`template.hbs:36-71`), not in the block.

### P4. Three renderers for one document model **[FACT]**
**Evidence:**
- `layouts/static.hbs`, `layouts/legal-document.hbs` and `layouts/fee.hbs` all render the same vocabulary (`paragraph`, `subheading`, `list`, `table`).
- They use two partial sets: `components/static/blocks/*` and `components/legal/blocks/*`. The legal set has no `table`.
- The data uses 4 nesting shapes:
  - `blocks[]`
  - `sections[].blocks[]`
  - `sections[].articles[].blocks[]`
  - `sections[].sections[].articles[].blocks[]`
- The `static` and `legal` paragraph/subheading partials are near-identical one-liners (`static/blocks/paragraph.hbs` = `<div class=…>{{{text}}}</div>`), so every fix has to be made twice. A check of 30 data files found no paragraph or subheading text missing from the output.
- `legal-document.hbs:169` renders `{{{body}}}` inside `<head>`.

### P5. Committed output, no deletion, no CI build **[FACT]**
**Evidence:**
- The build runs only on a developer's machine (`FE/README.md`). CI only uploads files (`sync.sh:62-103`).
- **70 orphaned** `OUT/promotion/promo-0XX.html` files, plus `promotion/detail.html` and `vikki-foreign-exchange-cvp/index.html`. All remain reachable by URL.
- **Today, rebuilding reproduces the committed output byte-for-byte.** Nothing guarantees it stays that way, because there is no CI check.

### P6. Environments are hand-copied and drift **[FACT]**
**Evidence:**
- `front-end/` exists only in dev.
- STG has 11 of 28 page folders.
- **The newest version of a page sits in different environments:**
  - `td-cvp-mua-2.html`: UAT is newest.
  - `vikki-go-cvp.html`: dev is newer.
  - `td-interest-cvp`: STG still has December 2025 rates.
- **Env-specific URLs are hard-coded in pages:**
  - `td-interest-cvp/iframe.html:18` (dev → **sit** CDN)
  - `credit-card-sale-cvp` (dev → **uat** PDF)
  - `booking-vja/iframe.html` (UAT uses an absolute host)

### P7. Build sources are uploaded to the bucket **[FACT]**
**Evidence:**
- `front-end/` sits inside the synced folder, and `sync.sh` uploads every changed file under `dev/s3-bucket-apse5-dev-vikki/`.
- That includes `.hbs`, `.json`, `promotionTemplate.xlsx` and `convertExcelToJson.html`.
- **[UNKNOWN]** Whether CloudFront exposes `/front-end/*`. This should be checked.

### P8. Dead and duplicate source files **[FACT]**
- `FE/pages/vikki-foreign-exchange-cvp/{en,vi}/` and `FE/data/vikki-foreign-exchange-cvp/{en,vi}/` are never read (`build.js:131` reads only the top level).
- The same Q&A is stored as `qa[]` (teaser) and `qaGroup[].children[]` (full). `qaItems[]` and `tempQA[]` are unused on template pages.
- `components/cardInfo.hbs` is unused.
- 17 empty (0-byte) page `.hbs` files exist only so that `build.js` emits `fee.html`/`tc.html`/`list.html`.
- Copy-pasted ids: tc `id`s `vikki-go-tnc`, `vikki-pro-tnc` and `vikki-go-plus-tnc` are reused on other products, and the od-cbnv `title` reads "Vikki OD At Branch".

### P9. Fragile interactive code tied to content **[FACT]**
- **vikki-golden-savings hotspots** select `img[src$="p-2.png"]` (`index.hbs:525`). Renaming the image for cache-busting breaks the "Thể lệ" (rules) button. kilo-gold already fixed this with a stable class; golden did not.
- **vikki-one-connect** calls `params.get("productScheme").toUpperCase()` (`index.hbs:243`). It throws when the parameter is missing, so the `'HDBANK'` fallback is unreachable.
- **vikki-one-connect click handler** tests `id === 'vikkibank'`, but `mapOrg` returns `'vikki'`.
- **`closePopup` is declared twice** in `scripts.hbs` (130, 306); see 01 §2.4.
- **CDN scripts are unpinned:** `hls.js@1`, `swiper@11`.

### P10. Runtime contracts are undocumented **[FACT]**
**Query params:**
- `hasTopSpace`
- `hasCard`
- `productScheme`
- `category`

**App bridge messages:**
- `{action:'OPEN_CARD'}`
- `{redirectTo, additionalData:{campaignCode}}`
- `{redirectTo, actionType:'navigate-screen'}` (UAT)
- inbound `change_video_state`

**Iframe messages:**
- `setHeight`
- `redirect`
- `OPEN_PROMO_DETAIL`

Each is implemented ad hoc per page. No list exists that the app team and the web team share.

### P11. Business authoring path is manual and broken **[FACT]**
**The current path:** Excel → `FE/data/promotion/convertExcelToJson.html` → copy JSON → a developer pastes it into `list.json` → build → commit → copy to UAT.

**Defects in the tool:**
- A missing `imageInput` element causes an error at load.
- `generate`/`copy`/`download` are dead code.
- Ids are not zero-padded (`promo-78`).
- Thumbnails are always `.png`.

### P12. Data embedded in JS **[FACT]**
- `td-interest-cvp/index.html` hard-codes the TD interest rates and terms in JS (`:681-760`).
- `golden-saving-landing-page/index.html` hard-codes the draw schedule and FAQ in JS.

These are business data that change on a schedule (rate changes), yet they can only be edited inside a 1,000-line HTML file.

---

## 2. Recommendations, classified

| # | Recommendation | Class | Evidence |
|---|---|---|---|
| R1 | Keep **build-time static generation**, Handlebars, and JSON-in-git as the content store | **KEEP** | Deterministic: 107/107 identical rebuild. Fits S3/CloudFront/WebView. Team already knows it |
| R2 | Keep the `components[]` ordered block list as the page composition model | **KEEP** | 13 pages already use it (`template.hbs:11-77`) |
| R3 | Replace the `if (eq type)` chain with a **block registry**: one folder per block holding template, JSON Schema, CSS, JS and metadata. Unknown types fail the build | **REFACTOR** | P3 |
| R4 | Merge `static.hbs`, `legal-document.hbs` and `fee.hbs` plus the `static/*` and `legal/*` partials into one **document** template with `variant: tc \| fee \| legal`. Normalise data to a single recursive `section{title, blocks[], sections[]}` shape (an `article` is a `section`) | **MERGE** | P4 |
| R5 | Merge `base.hbs` and `template.hbs` into one `landing` template. Convert the 4 hand-coded card pages to JSON blocks | **MERGE** | P2, P3 |
| R6 | Replace the 8 CSS-only per-page templates with **themes**: a shared stylesheet plus design tokens and named variants (`theme: "loan-blue"`, `qaStyle: "card"`) | **REPLACE** | P1 |
| R7 | Split `scripts.hbs` into per-block JS modules plus a small core (popup, bridge, env). Load each only when its block is on the page. Fix the duplicate `closePopup` | **SPLIT** | P9, 310-line monolith |
| R8 | Split `styles.hbs` (714 lines) into core CSS plus per-block CSS. Emit only what the page uses | **SPLIT** | |
| R9 | Unify collections: promotion, card-intro and safe-plus `details` become one **collection** mechanism with `list` and `detail` templates. Replace the two code paths in `build.js` | **MERGE** | `build.js:180-221` vs `318-345` |
| R10 | Add **JSON Schema validation** for every content type and block (Ajv). Lint rules: unique ids, existing asset paths, valid cross-page references, no env hosts in content | **NEW** | P8, P6 |
| R11 | Add a **build manifest** and clean output. Remove orphans from git, and optionally run a CI `--delete` pass scoped to `vikki-cvp/` | **NEW** | P5 |
| R12 | Add a **single build for all environments** with `env` config (CDN host, bridge flags), writing to `dev/`, `uat/` and `stg/` output folders. Add a CI check that committed output equals the build | **NEW** | P5, P6 |
| R13 | Move generator source **out of the bucket folder** (e.g. `cvp/` at repo root) | **REFACTOR** | P7 |
| R14 | Define a **runtime contract** module: typed app-bridge actions, iframe messages and query params. Blocks declare actions as data (`{"action":{"type":"navigate","screen":"LuckySpinScreen","campaignCode":"…"}}`) instead of inline JS | **NEW** | P10 |
| R15 | Store FAQ once (`faq` collection or page-level `faq.groups[]`). The inline `qa` block picks `featured: 5` instead of duplicating the entries | **REFACTOR** | P8 |
| R16 | Turn the Excel→JSON tool into a supported **import** (CLI `cvp import promotions.xlsx`) with validation, then into the admin UI | **EXTEND** | P11 |
| R17 | Move rate tables and schedules into data (`data/rates/td.json`) consumed by a `calculator` block | **EXTEND** (Phase 5+) | P12 |
| R18 | Leave the bespoke iframe widgets (booking-vja, golden-saving landing, td-interest) **outside** the CMS for now, but bring them under the env build so hosts are not hard-coded | **KEEP** (as custom apps) | Different stack (jQuery/GSAP/moment), different consumer (parent website) |
| R19 | Migrate GrapesJS-era hand-written pages (td-cvp, loan, credit-card-sale, sim, hd-saison, vneid) to `landing` JSON when next touched; otherwise freeze them | **REPLACE** (lazily) | They map 1:1 onto existing blocks (video + images + popup buttons) |
| R20 | Delete dead files: FX `en/`/`vi/` subtrees, `cardInfo`, `qaItems`/`tempQA`, `vikki-lixi-2026_temp/`, the 0-byte `.hbs` placeholders (once the build no longer needs them) | **REFACTOR** | P8 |

### Things that look duplicated but should **not** be merged
- **Landing vs document templates.** Different consumers (image-heavy marketing vs long accessible text) and different block vocabularies. Keep them separate.
- **Bespoke iframe widgets vs landing pages.** They run in a different host (a parent website), use different libraries and have a different lifecycle. Forcing them into blocks would cost more than it returns.
- **Safe-plus.** Its structure is legitimately richer (plans, benefits tables). Model it as a few **custom blocks** (`planSlider`, `planDetail`, `stepsSlider`), not as a generic template.
