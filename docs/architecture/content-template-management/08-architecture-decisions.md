# 08 — Architecture Decisions

> Status values: **Proposed** (needs team decision), **Recommended** (evidence is strong), **Open** (needs input from outside FE).

---

## ADR-001: CMS style — Hybrid, block-centric. **Recommended**

### Context
- **[FACT]** 13 pages already compose from an ordered `components[]` list (`layouts/template.hbs:11-77`).
- **[FACT]** Per-page variation is order, images and CSS.
- **[FACT]** There are only 4 real page shapes: landing, document, collection list, collection detail.

### Options
| | Schema-driven | Component-driven | Template-driven | **Hybrid (blocks + typed content + few templates)** |
|---|---|---|---|---|
| Idea | Content types first; rendering separate | Pages = trees of components | Pick a template per page, fill slots | Content types validate entries; templates (4) own structure; blocks are the admin unit |
| Fit to repo | Legal docs ✓, landing ✗ (no rendering model) | Landing ✓, legal docs ✗ (1,000s of paragraphs as components is unwieldy) | Matches today's per-page `.hbs`, which is exactly the duplication problem | Uses `components[]` for landing and the section/blocks tree for documents |
| Admin flexibility | Low | High | Low–medium | High within guard-rails |
| Complexity | Low | Medium | Low | Medium |
| Extensibility | New type = schema + renderer | New component = registry entry | New template = code + copy | New block = folder; new type rare |
| Risk | Rendering logic leaks into templates again | Admins build "anything", inconsistent UX | Copy-paste continues (P1) | Must keep template count small |

### Decision
Hybrid:
- Typed content entries.
- **Four** templates.
- A self-registering block registry.
- Themes instead of per-page CSS.

### Consequences
- Block contracts (`block.json`) become the main developer artifact.
- `allowedBlocks` per template stops admins composing documents out of marketing blocks.

---

## ADR-002: Keep Handlebars + Node static build. **Recommended**

> **Revision proposed (2026-10-31):** keep the own Node engine, but render new blocks with Preact JSX/TSX (`preact-render-to-string`) and keep Handlebars only as the legacy renderer during migration. Pending a 1-week spike. See [10-template-engine-evaluation.md](10-template-engine-evaluation.md).

### Context
- **[FACT]** The build is deterministic (107/107 identical).
- **[FACT]** It has a single dependency.
- **[FACT]** Output is plain HTML in a WebView, with no client framework.
- **[FACT]** The team edits `.hbs` daily.

### Alternatives
- **Astro / Eleventy.** Better DX (components, bundling), but a migration cost on every template.
  - Eleventy keeps Handlebars and would be the cheapest upgrade *if* the custom build becomes a burden.
- **React / Next static export.** Adds a JS runtime to every WebView page for no interactive need. Rejected.

### Decision
- Keep Handlebars.
- Rewrite `build.js` into small modules (`cvp/core`).
- **Re-evaluate Eleventy at the end of Phase 3.**

### Consequences
Bundling per-block CSS/JS is hand-written (simple concatenation is enough).

---

## ADR-003: Git as the content store; no database CMS. **Recommended**

### Context
- No backend exists.
- Pages are cached static files.
- Every change today already goes through git + PR + `sync-*.yaml`.
- An audit trail and rollback are needed for financial-product T&C.

### Alternatives
- **Strapi / Payload / Directus.** Needs hosting, a DB, auth, backups and a build trigger. It adds an always-on system for content that changes a few times a week.
- **SaaS headless CMS (Contentful, Sanity).** Data residency and vendor approval are **[UNKNOWN]** for a bank, and it adds cost.

### Decision
- JSON in git.
- The admin UI writes PRs.

### Consequences
- Editors need a GitHub identity, or the OAuth proxy maps one for them.
- Concurrency is handled by one file per collection item.

---

## ADR-004: Build-time data binding only; runtime limited to query params and app bridge. **Recommended**

### Context
- **[FACT]** No runtime API calls exist anywhere.
- Runtime behaviour today is driven only by `hasTopSpace`, `hasCard`, `productScheme`, `category` and postMessage.

### Decision
- Resolve all content and collections at build.
- `visibleWhen` may only reference declared runtime params.

### Consequences
- Promotions are updated by rebuild + deploy (minutes), which is acceptable at the current cadence.
- If real-time data is ever needed (live rates), it becomes a specific block with its own API, not a CMS feature.

---

## ADR-005: Merge three legal-document renderers into one `document` template. **Recommended**

### Evidence
- `static.hbs`, `legal-document.hbs` and `fee.hbs`, plus the `static/*` and `legal/*` partials, render the same block vocabulary in 4 nesting shapes.
- `legal-document.hbs:169` puts the page body in `<head>`.

### Decision
- One recursive `section{title, blocks[], sections[]}` model.
- `variant: tc | fee | legal` selects the header and TOC behaviour.

---

## ADR-006: Version blocks, not templates. **Recommended**

### Context
- Templates will be few and stable.
- What breaks content is a change to a block's props.

### Decision
- Semver in `block.json`.
- Keep old majors until the usage report shows zero.
- Optional `migrate.js` per major.
- Git history is the template and content revision log.

---

## ADR-007: Admin UI — Decap CMS (generated config) vs thin in-house editor. **Proposed**

### Decap
**For:**
- Git-native.
- Editorial workflow is built in.
- Its list widget with typed items already models block lists.
- Config can be generated from `registry.json`.

**Against:**
- Custom preview requires registering preview templates (we can reuse the Handlebars renderer).
- Needs a GitHub OAuth proxy.
- Limited UX customisation.

### In-house
**For:**
- Exact WebView preview.
- Tailored for image-heavy CVPs.

**Against:**
- More code to maintain.

### Recommendation
- Run a 1-week Decap spike in Phase 4.
- Choose in-house only if the preview or the OAuth constraint fails.
- **Open:** the org policy on GitHub OAuth apps, and whether business editors can have GitHub accounts.

---

## ADR-008: Where the generator and content live. **Decided (2026-10-31): option (b), a separate repository**

> Decision: the CVP generator, content and bespoke pages move to a new repository. The static repo keeps only generated output under `*/vikki-cvp/**` (Stage A: published by a bot PR), and later possibly nothing (Stage B: direct deploy via OIDC). Design: [09-standalone-repo-design.md](09-standalone-repo-design.md). The original analysis is kept below.

### Context
- **[FACT]** `front-end/` sits inside `dev/s3-bucket-apse5-dev-vikki/`, so its sources are uploaded to the bucket.
- **[FACT]** The repo is owned by HRE and backoffice maintainers (CODEOWNERS), and its workflows are infra-oriented.

### Options
**(a) `cvp/` + `content/` at the root of this repo.**
- Minimal change.
- Path-filtered workflows are untouched.
- A new CI job is needed for the build check.

**(b) A separate `vikki-cvp` repo.**
- Builds, then opens PRs (or pushes) to this repo's env folders.
- Clean ownership and its own CI.
- The cost is a cross-repo pipeline.

### Recommendation
Start with (a). Move to (b) only if content ownership or CI needs diverge. This needs agreement from the HRE CODEOWNERS.

---

## ADR-009: Bespoke iframe widgets stay outside the block system. **Recommended**

### Evidence
- `booking-vja`, `golden-saving-landing-page` and `td-interest-cvp` use jQuery/Slick/GSAP/moment.
- They target a parent website through `setHeight`, and each has its own data embedded in JS.

### Decision
- Keep them as custom apps.
- Put them under the env build only for host substitution.
- Reconsider `td-interest-cvp` once a `rates` collection exists.

---

## Answers to the brainstorming questions

**1. What CMS capabilities does the repository already have?**
- **[FACT]** A deterministic static generator with:
  - partials
  - layouts chosen by data
  - an ordered, typed block list for landing pages (`components[]`, 10 types)
  - a structured document model for T&C/fee (`sections/articles/blocks`, 4 block types)
  - collections with list/detail generation (promotion, card-intro, safe-plus details)
  - opt-in en/vi localization
  - a watch-mode preview server
  - git history as versioning
- **[FACT]** A rudimentary business import (Excel → JSON for promotions).

**2. What is missing to make it a configurable CMS?**
- Declared content types and schemas, with validation.
- A self-registering block registry with prop contracts. Unknown blocks are silently dropped today.
- Themes instead of copied CSS.
- A single build for all environments, with no hand copying and no orphan cleanup.
- A documented runtime contract.
- An admin UI that writes to git.
- Rich-text sanitisation.

**3. Which existing modules should become the CMS foundation?**
- `build.js`: the render and partial-registration logic.
- `layouts/template.hbs`: the block dispatch, which becomes the registry.
- `components/*.hbs`: these become blocks.
- `components/static/*`: becomes the document blocks.
- The `components[]` / `sections` JSON shapes.
- `scripts.hbs`: becomes the runtime core.
- `convertExcelToJson.html`: becomes the import tool.

**4. Should Content, Template, Layout and Block be separate concepts?**
- Content, Template and Block: **yes**.
- Layout: **no**. Merge it into a single HTML shell plus the template. The evidence is 8 layouts that duplicate `<head>`, plus 8 page "templates" that are only CSS, which become **themes**, a separate concept the brief didn't list.

**5. What is controlled by code vs CMS?**
- **Code:**
  - blocks (markup, CSS, JS, props schema)
  - templates and their allowed blocks
  - themes and tokens
  - runtime actions and params
  - content-type schemas
  - validation rules
  - env config
- **CMS:**
  - pages and their block order and props
  - documents
  - collection items
  - FAQ
  - assets
  - theme and variant selection
  - locale content
  - env promotion

**6. How do developers add capabilities without CMS core changes?**
- Add `cvp/blocks/<type>/` with `block.json` + `block.hbs` (+ css/js/examples).
- The registry discovers it, the validator enforces its schema, and `registry.json` exposes it to the admin UI.
- No central list is edited.

**7. How do administrators configure content without code?**
- Forms generated from content-type and block schemas.
- Block picker restricted by the template.
- Enumerated variants and themes.
- Actions chosen from registered types.
- WebView-size preview.
- Saving opens a PR.
- Until Phase 4, the same contracts make JSON editing safe, because CI validates it.

**8. How should the system support different business domains?**
- Domains (cards, loans, savings, insurance, FX, promotions) differ in **blocks and themes**, not in architecture.
- Domain-specific widgets become namespaced custom blocks (`custom/safe-plus-*`) and domain data becomes collections.
- Domain owners get CODEOWNERS on `content/pages/<domain>-*`.

**9. What is the simplest architecture that scales without becoming a monolith?**
- A static build pipeline (validate → resolve → render → assemble) over files in git.
- Capabilities are added as self-contained block folders, and content as self-contained entry folders.
- No server, no database, no runtime CMS.
- The only shared core is about 5 small modules plus the runtime contract.

**10. The first three changes with the highest architectural value:**
1. **A CI check that committed output == build, extended to all envs**, plus orphan cleanup. This removes the biggest operational risk: drift and stale pages across dev/uat/stg (P5, P6).
2. **A block registry with JSON-Schema props and fail-on-unknown**, replacing the `template.hbs` if-chain. This turns the existing `components[]` model into an extensible, validated contract and is the foundation for the admin UI (P3).
3. **Themes replacing the CSS-only page templates.** After this, a new CVP page is JSON plus assets only, which removes most of the copy-paste work in the history (P1).
