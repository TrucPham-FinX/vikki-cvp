# 03: Research on template engines and static generation solutions

> **Research date:** 2026-11-02.
> - **Versions and dates:** `registry.npmjs.org/<pkg>`.
> - **Downloads:** `api.npmjs.org/downloads/point/last-week`, for the week 2026-10-23 to 2026-10-29.
> - **Advisories:** GitHub Advisory Database (GHSA) and NVD.
>
> **Evidence labels:**
> - **[DOC]:** official documentation or the project's repo.
> - **[REG]:** npm registry or GitHub API.
> - **[RUN]:** checked hands-on in `research/static-content-engine/experiments/` (see [05](05-practical-evaluation.md)).
> - **UNVERIFIED:** could not be confirmed.

---

## 0. Template engine vs SSG vs component renderer: they are not equivalent

| Layer | What it does | What it does **not** do | Examples |
|---|---|---|---|
| **Template engine** | Takes (template string + data) and returns a string. Provides syntax for expressions, conditionals, loops, partials and layouts | Routing, data loading, asset pipeline, i18n routing, build orchestration | Handlebars, Mustache, Nunjucks, Liquid, EJS, Eta, Pug, doT |
| **Component renderer** | Takes a tree of functions/components with props and returns a string. Composition goes through function calls and props, and props can be type-checked | Build orchestration, routing | Preact/React `renderToString`, Vue SSR, Svelte `render`, Lit SSR, JSX-to-string (kitajs, hono/jsx) |
| **Static site generator (SSG)** | Owns the whole pipeline: discovers files, builds the data cascade, routes, paginates, runs **one or more** engines/renderers, processes assets, writes output | n/a (it *contains* an engine) | Eleventy (uses Nunjucks/Liquid/…), Astro (uses its own component compiler) |

This repo has already built **its own SSG**: `front-end/build.js` and `core/*`. So swapping the "engine" (Handlebars → X) and swapping the "SSG" (own pipeline → Eleventy/Astro) are two separate decisions with very different costs.

---

## 1. String template engines

### 1.1 Handlebars (`handlebars`)
- **Version / maintenance [REG]:**
  - 4.7.10 (2026-10-05), 4.7.9 (2026-03-26), 4.7.8 (2023-08-01).
  - Both 2026 releases were driven by security fixes, after almost three years with no release.
  - `master` is at `5.0.0-alpha.1` (switch to ESM in 2026-04) and is **not published**.
  - 57.9M downloads/week, ~18.7k stars.
- **Mechanism [DOC]:** compiles a template into a JS function. Rendering is synchronous only (no async helpers, no streaming). Supports precompilation and a runtime-only build.
- **Templates and data:** context is a JSON object. `{{a.b}}` for property access, `../` for the parent scope, `@root` for the root.
- **Reuse:**
  - Partials, dynamic partials `{{> (expr)}}`, partial blocks `{{#> layout}}…{{/layout}}` with `@partial-block`, and inline partials `{{#*inline "slot"}}`.
  - **There is no `extends` keyword.** Multi-slot layouts are built from inline partials. [RUN] This works well: `engines/handlebars/templates/layouts/shell.hbs` has 3 slots: head, main, scripts.
- **Conditionals and loops:** `#if`/`#unless`/`#each`/`#with` test truthiness only, with no comparison operators. [RUN] The built-in `if` cannot be used as a subexpression (`(if x "y")` throws "#if requires exactly one argument"), so a `when` helper is needed.
- **Helpers:** `registerHelper` and block helpers. Decorators are deprecated.
- **Escaping [DOC][RUN]:**
  - `{{x}}` escapes HTML; `{{{x}}}` outputs raw.
  - Escaping is **HTML only, not context-aware.** [RUN] `src="{{src}}"` lets `javascript:` through.
- **CSS/JS/assets, i18n:** none built in; you supply them yourself.
- **TypeScript:** bundled `.d.ts`, but the template context is `any`. Templates are not type-checked.
- **Security [REG]:**
  - CVE-2021-23369 and CVE-2021-23383 (critical, fixed in 4.7.7).
  - **2026:** CVE-2026-33937 (critical) and 33938–33941, fixed in 4.7.9; CVE-2026-106444, 106445 (critical) and 106446 (critical), fixed in 4.7.10.
  - Most of these concern compiling untrusted templates or AST type confusion. **Anything below 4.7.10 still has open critical advisories.**
- **DX:** easy to learn and familiar to the team. Error messages for missing partials are clear. [RUN] Partial names are case-sensitive (registered in a map), so a typo throws on every OS.

### 1.2 Mustache (`mustache`)
- **Version / maintenance [REG]:** 4.2.0 (2021-03-28). Last commit to master 2023-01-21. **Stalled.** 25.1M downloads/week.
- **Mechanism:** parses to tokens and interprets them, with a cache.
- **Templates:**
  - Partials only.
  - **No template inheritance:** the spec's `{{< parent}}`/`{{$block}}` are not implemented (verified in the tag regex in `mustache.js`).
  - No helpers; only lambdas in data.
- **Escaping:** escapes HTML by default; `{{{ }}}` outputs raw.
- **TypeScript:** `@types/mustache`.
- **Security:** no advisories in the last 5 years.
- **Assessment:** too logic-less for the document model here: recursive lists, dispatch by type, and 4-level nesting all require pushing logic into data. On top of that it is not maintained. **Ruled out.**

### 1.3 Nunjucks (`nunjucks`)
- **Version / maintenance [REG]:**
  - Still at 3.2.4 (2023-04-13).
  - The repo still gets commits (docs/CI/dependencies, last one 2026-10-03), but there has been **no release in about 3.5 years**. **Maintenance-only.**
  - 5.05M downloads/week, ~9k stars.
- **Mechanism:** compiles to JS. Has async (`asyncEach`, async filters) and precompilation. Runs in the browser.
- **Reuse [DOC][RUN]:**
  - `extends` + multiple `block`s + `super()`.
  - `include` (dynamic name allowed).
  - `macro` (recursion allowed), `import`/`from`, `call`.
  - Custom filters, globals and extensions.
- **Conditionals [DOC][RUN]:** native comparison/logic/math operators and inline `if` expressions (`'is-hot' if p.isHotDeal`). There is no `eq` helper problem as in Handlebars.
- **Escaping [DOC][RUN]:**
  - `autoescape: true` by default; `| safe` outputs raw. HTML only.
  - The docs warn that templates are not sandboxed.
- **TypeScript:** `@types/nunjucks`. Context is not typed.
- **Security:** CVE-2023-2142 (autoescape bypass, fixed in 3.2.4).
- **Notes [RUN]:**
  - Imported macros do not see the outer context unless you write `with context`.
  - A **dynamic include resolves through the filesystem**, so on case-insensitive macOS (APFS) `blocks/imagesection.njk` loads `imageSection.njk`. It does not throw, even though it would on Linux CI.

### 1.4 LiquidJS (`liquidjs`) and the Liquid language
- **Version / maintenance [REG]:**
  - 10.30.1 (2026-10-28); `next` is 11.0.0-alpha.1. **Very active.**
  - 3.36M downloads/week, ~1.9k stars.
- **Mechanism:** parses to an AST and **interprets** it, without compiling to JS. Has both sync and async APIs, and **streaming** (`renderToNodeStream`).
- **Design goal:** safe for **untrusted** templates (Shopify/Jekyll style): `ownPropertyOnly`, `memoryLimit`, `renderLimit`.
- **Reuse:** `{% layout %}` + multiple `{% block %}`s, `{% render %}` (**isolated scope**), and `{% include %}` (shared scope). Custom filters and tags. **No macros.**
- **Conditionals:** `==`, `!=`, `<`, `contains`, `and`/`or`. Filter chains (`| append`, `| default`).
- **Escaping [DOC][RUN]:**
  - **Output is NOT escaped by default.** You must set `outputEscape: "escape"` and use `| raw` for raw output.
  - **Liquid truthiness:** `""` counts as truthy (Ruby semantics). [RUN] Without `jsTruthy: true`, the output contains `class=""` where Handlebars would output nothing.
- **TypeScript:** written in TS with bundled types. Context is generic.
- **Security [REG]:**
  - About 18 advisories in 2026, including CVE-2026-45618 (RCE, fixed in 10.26.0) and CVE-2026-106120 (GHSA-fwxr-j5w2-587m, `ownPropertyOnly` bypass, fixed in 10.27.2; **confirmed to exist**).
  - The sandbox itself is a large attack surface. That surface only matters if *non-developers write templates*, which is not the model here: admins edit data.
- **DX notes [RUN]:**
  - `{% render %}` isolates scope, so values like `assetBase`/`ui` must be passed through `globals`.
  - String concatenation needs `assign` + `append`, which makes templates long-winded.

### 1.5 EJS (`ejs`)
- **Version / maintenance [REG]:**
  - 7.0.2 (2026-10-18). Four majors in 2026: v6 hardened the prototype chain; v7 stopped reading options from data.
  - 58.9M downloads/week.
- **Mechanism:** templates contain **arbitrary JS**, compiled with `new Function`. `<%= %>` escapes, `<%- %>` outputs raw.
- **Reuse:** **`include()` only. No layouts or inheritance** without a third-party package.
- **TypeScript:** `@types/ejs` still targets v3. Not bundled.
- **Security:** CVE-2022-29078 (critical), CVE-2024-33883.
- **Assessment:** lacks layouts/slots, and four breaking changes in one year is a maintenance burden. **Not chosen for the experiment.** Eta covers the same "JS template" style with better layout support.

### 1.6 Eta (`eta`)
- **Version / maintenance [REG]:**
  - 4.6.0 (2026-04-25). Single maintainer (bgub), active.
  - 10.6M downloads/week.
- **Mechanism:** JS templates compiled to a function. Has async. Runs on Node, Deno and in the browser.
- **Reuse:** `include()`, and `layout()` with data passing. Helpers are plain JS functions. `autoFilter` hook.
- **Escaping [DOC][RUN]:** `autoEscape: true`. `<%= %>` escapes, `<%~ %>` outputs raw.
- **Notes from the experiment [RUN]:**
  - **`include()` must use `<%~ %>`**, so every include is a "raw" output site. It becomes hard to grep for real raw-HTML spots: 24 sites, compared with 8–10 in the other engines.
  - Without `autoFilter`, Eta prints the literal string `undefined` for optional fields.
  - JS is allowed in templates, so business logic tends to creep back in.
- **TypeScript:** bundled types, but the `it` data is not typed against templates.
- **Security:** CVE-2022-25967 and CVE-2023-23630, both fixed in 2.0.0.

### 1.7 Pug (`pug`)
- **Version / maintenance [REG]:** 3.0.4 (2026-03-13). Security fixes only. **Maintenance-only.**
- **Mechanism:** indentation-based syntax that compiles to JS.
- **Reuse:** `extends`/`block`/`mixin`.
- **Escaping:** text and attributes are escaped by default.
- **Security:** CVE-2021-21353, CVE-2024-36361.
- **Assessment:** templates would have to be **rewritten entirely in a non-HTML syntax**. The cost of converting 1,437 HTML strings and the existing markup, plus training cost, is high, and maintenance is weak. **Ruled out.**

### 1.8 doT (`dot`)
- **Version / maintenance [REG]:** 1.1.3 (2019-12-07). **Abandoned.**
- **Escaping:** not escaped by default.
- **Security:** GHSA-4859-gpc7-4j66 has no patch. **Ruled out.**

### 1.9 Other engines worth noting
| Engine | Note [REG/DOC] |
|---|---|
| **Edge.js** 6.5.1 | Components with props and named slots. Async rendering. Part of the AdonisJS ecosystem; little adoption outside it (108k/week) |
| **Marko** 6.4.7 | Very fast streaming. Escaping is context-aware for script/style. It is a full UI framework and needs a compiler. CVE-2026-41591 |
| **Tempura** 1.0.1 | Handlebars-like syntax with JS expressions. ESM only, Node 22+. No layouts |
| **Squirrelly** 9.1.1 | Low activity. CVE-2024-40453 |

---

## 2. Component renderers (render to string)

### 2.1 Preact + `preact-render-to-string`
- **Version [REG]:** preact 11.1.1 (2026-10-31, 53.6M/week); preact-render-to-string 6.8.2 (2026-10-27, 13.2M/week).
- **Mechanism:** a component is a function `(props) => VNode`, and `render()` produces a string. `renderToStringAsync` and streaming are also available.
- **Reuse:**
  - Composition through function calls with **typed props**.
  - "Slots" are just props or `children`.
  - Dispatch by type is a map lookup.
  - [RUN] A mapped type `{[K in Component['type']]: …}` **forces every declared type to have an implementation**.
- **Escaping [RUN]:** text and attributes are escaped. Raw output only via `dangerouslySetInnerHTML`. [RUN] The experiment confines this to a single `<Rich>` component.
- **TypeScript [RUN]:**
  - `tsc --noEmit` catches `type: 'imagesection'` (*"Did you mean 'imageSection'?"*) and `isHotDeal: 'yes'` (string vs boolean) **before the build runs**.
  - A compile step is needed (esbuild, ~40 ms).
- **CSS/JS:** nothing built in. Plain CSS files next to each component plus an assembler; client JS stays vanilla. Preact is not shipped to the WebView.
- **Notes [RUN]:**
  - JSX attribute names: use `class` with Preact (`className` also works); `playsInline` renders as `playsinline`.
  - Templates are longer: 215 lines, including about 35 lines of type definitions.

### 2.2 React (`react-dom/server`, `react-dom/static`)
- **Version [REG]:** react-dom 19.3.1.
- **APIs [DOC]:**
  - `renderToStaticMarkup` is still current. It does not wait for Suspense.
  - `prerender` / `prerenderToNodeStream` (React 19) wait for all data to load.
- **Escaping:** same as Preact. React 19 also hoists `<title>`/`<meta>`.
- **Compared with Preact:** same programming model with a larger runtime. At build time the difference is negligible. Choose by team familiarity.

### 2.3 Vue (`@vue/server-renderer` 3.5.44) and Svelte (`svelte/server` 5.57.3)
- **Vue:**
  - `renderToString(createSSRApp(...))` returns a Promise.
  - `{{ }}` escapes; `v-html` outputs raw.
  - Vue's docs recommend VitePress for content sites.
- **Svelte:**
  - `render(Component, {props})` returns `{head, body}`.
  - Scoped CSS per component, compiled.
- **Assessment:** both need SFC compilation (`.vue`/`.svelte`), and the toolchain is heavier than TSX + esbuild. Svelte's scoped CSS is attractive. Neither was implemented in the experiment, because the target team is assumed to be React/RN (doc 10 R10, UNVERIFIED).

### 2.4 Web Components
- **Lit SSR** (`@lit-labs/ssr` 4.1.0):
  - **Still in Labs (experimental).**
  - Output relies on Declarative Shadow DOM.
  - Shadow DOM duplicates styles per instance.
  - DSD support in Android WebView / WKWebView is UNVERIFIED.
- **Enhance SSR** 4.0.3 (2024): **does not escape strings** (read in `lib/transcode.mjs`). Low activity.
- **WebC** (Eleventy): 0.11.4 stable (2023); 0.12 beta in 2026-10. Light DOM, scoped CSS, per-page bundles.
- **Assessment:** for pure static HTML in a WebView, Web Components bring no clear benefit and add DSD/polyfill risk.

### 2.5 JSX-to-string without a framework
| Library | Escaping by default [DOC/source] | Status |
|---|---|---|
| `@kitajs/html` 4.2.13 | **Children are NOT escaped** (README: "WILL expose you to XSS"); you need `safe` or the TS plugin to catch it | Active |
| `hono/jsx` (hono 4.13.16) | Escapes; `raw()` outputs raw | Very active |
| `vhtml` 2.2.0 | Escapes, but has a global "safe" cache keyed by string | Unmaintained since 2019 |
| `typed-html` 3.0.1 | **No escaping** | Unmaintained |

`tools/spike-template-engine.js` in this repo writes "JSX" by hand as template literals **with no escaping**. It is closer to `typed-html` than to Preact, which is a further reason not to use its results.

---

## 3. Static site generators

### 3.1 Eleventy 3 ("Build Awesome")
- **Version [REG]:** `@11ty/eleventy` 3.1.7 (2026-10-15); canary 4.0.0-alpha.10. 293k downloads/week.
- **Organisation [DOC]:**
  - Joined Font Awesome in 2024-09.
  - On 2026-03-03 it announced "Eleventy is now **Build Awesome**… Eleventy v4 will be Build Awesome v4" (free/OSS, with a paid Pro tier on top).
  - The npm `repository` field now points to `11ty/buildawesome`.
- **Template languages:** v3 core supports HTML, Markdown, JS (`11ty.js`, including JSX/TS), Liquid and Nunjucks. **Handlebars, Pug, EJS and Mustache were moved out to plugins.** `@11ty/eleventy-plugin-handlebars` is at 1.0.0 (2024-09), 4.2k downloads/week.
- **Data cascade:** computed → front matter → template data → directory data → layout → global data. Layouts can chain. Pagination generates many pages from one template.
- **i18n:** a bundled plugin for URLs (`locale_url`); it **does not translate strings**.
- **Incremental builds:** `--incremental` exists, but there is **no cache across restarts**.
- **Experiment [RUN]:**
  - Eleventy rendered the **Nunjucks templates unchanged**. Only 23 lines of glue were needed (2 page stubs and a data file).
  - The cost is mapping the data model: `eleventyComputed` to lift `vm.*` keys to the top level.
  - Integration seams: `addFilter()` output gets autoescaped, so `addNunjucksFilter` with a `SafeString` from **Eleventy's own Nunjucks instance** is needed.
  - Building 4 pages took ~560 ms; a bare Node process takes ~40 ms.

### 3.2 Astro
- **Version [REG]:** 7.4.4 (2026-10-28). 10.8M downloads/week, ~63.7k stars.
- **Astro 7 [DOC]:**
  - Compiler rewritten in Rust; uses Vite 8/Rolldown.
  - The compiler **no longer auto-fixes markup** (unclosed tags are errors).
  - Self-reported build time 15–61% faster on an M4 Pro.
- **Components [DOC]:**
  - `.astro` = frontmatter plus a JSX-like template. `interface Props` for typing. Default and named slots.
  - Expressions escape; `set:html` outputs raw.
  - Zero client JS by default.
  - Scoped CSS (`scopedStyleStrategy`).
  - `build.inlineStylesheets: 'always'` can produce self-contained HTML.
  - Hashed bundles live in `_astro/`.
- **Content collections [DOC]:** `defineCollection({loader, schema})` with Zod 4 (`astro/zod`). Generates TS types and JSON Schema.
- **i18n [DOC]:** routing only, no string translation.
- **Rendering outside the build [DOC]:**
  - The Container API is **still experimental** (it may break even in patch releases).
  - Incremental builds are experimental since 7.2.0.
- **Assessment:** best-in-class DX for the components + content collection model. But it **replaces the whole pipeline**: `core/*`, the manifest, the parity gate, and the `vikki-cvp/<page>/<file>.html` output format.
  - Not implemented in the experiment: an Astro project plus Vite/Rolldown is much heavier, and the core question for this repo (component model + types) is already answered by the Preact experiment.
  - The cost to switch to Astro is set out in [07](07-architecture-proposals.md).

### 3.3 Vite-based HTML templating
- **Vite 8.3.5 [DOC]:** multi-page builds via `rolldownOptions.input`, but **no native templating or partials**.
- **Plugins:**
  - `vite-plugin-handlebars` 2.0.3 (2026-04, depends on handlebars ^4.7.9).
  - `vite-plugin-html` 3.2.2 (**stale since 2024-01**).
  - `vituum` 2.0.2 (small).
- **Assessment:** useful if you need an asset pipeline (hashing, minification) for 1–2 bespoke pages. Not a solution for content generation from JSON.

---

## 4. Schema and type tools for JSON → template

| Tool | Version [REG] | Role here |
|---|---|---|
| **Ajv** 8.20.0 | already in the repo | Validates JSON Schema 2020-12. `ajv/dist/standalone` precompiles validators |
| **Zod** 4.6.7 | not installed | **`z.toJSONSchema()` is first-party since 4.0** (draft-2020-12). One schema yields both a TS type (`z.infer`) and a JSON Schema for Ajv/admin forms |
| **TypeBox** 1.4.3 | not installed | JSON Schema objects that infer TS types. 1.x is ESM only |
| **json-schema-to-typescript** 16.0.0 | not installed | Generates TS from the existing `*.block.json` files. Partial support for 2020-12; ignores `pattern`/`min`/`max` |

Here the value of the schema layer is greater than the value of the engine. F2 (a lost block) is a **data contract** failure that a closed schema, `type` with an `enum` and `additionalProperties: false`, would catch *before* rendering, whichever engine is used.

---

## 5. Published benchmarks (with sources and stated environments; no figures invented)

| Source | Environment as stated | Result (summary) | Credibility |
|---|---|---|---|
| itsarnaud/template-engine-bench (README) | Node 21.7.2, MacBook Air M2 16 GB, 2000 runs; ejs ^3.1.10, eta ^4.0.1, handlebars ^4.7.8, liquidjs ^10.24.0, pug ^3.0.3 | "projects-escaped": hbs 41 ms, pug 86, ejs 140, liquid 162, eta 378. "friends": liquid 14,361 ms (much slower) | Low (10 stars, one author) |
| Tempura README | Node 26.11.1, M1 Max; engine versions not stated | Escaped ops/s: tempura 5,191, pug 4,641, hbs 2,135, ejs 808 | Not neutral (the author's own library) |
| eknkc/ssr-benchmark | Node 20.6.1, M1 Pro; no date or versions | 1,000-row table: marko 6,675 ops/s, kita 3,074, hono 945, vue 897, react 764 | The author calls it "not scientific" |
| Zach Leatherman, build benchmark (2022) | M1 Air 16 GB, Node not stated; old versions | 4,000 markdown files: Eleventy 1.9 s, Astro 1.0 22.9 s, Hugo 0.68 s | Out of date (Astro 1 vs 7) |
| Astro 7 blog | M4 Pro 48 GB | docs.astro.build 6,313 pages: 114.5 s → 73.5 s | Self-published |

Benchmarks disagree on the ranking (Eta is slowest in one and fastest in this repo's experiment), which shows how much results depend on the workload. **The benchmark in [05](05-practical-evaluation.md) uses this repo's own data, and every engine produces equivalent output.** That is the result to rely on for decisions here.

---

## 6. Sources (accessed 2026-11-02)

**npm registry and download statistics**
- https://registry.npmjs.org/handlebars · /mustache · /nunjucks · /liquidjs · /ejs · /eta · /pug · /dot · /edge.js · /marko · /tempura · /squirrelly
- https://registry.npmjs.org/astro · /@11ty%2Feleventy · /preact · /preact-render-to-string · /react-dom · /@vue/server-renderer · /svelte · /@lit-labs/ssr · /@enhance/ssr · /@kitajs/html · /hono · /zod · /typebox · /ajv · /json-schema-to-typescript · /vite-plugin-handlebars · /vite-plugin-html
- https://api.npmjs.org/downloads/point/last-week/<pkg>

**Handlebars**
- https://github.com/handlebars-lang/handlebars.js/releases/tag/v4.7.9 · /v4.7.10
- https://raw.githubusercontent.com/handlebars-lang/handlebars.js/master/package.json
- https://handlebarsjs.com/guide/partials.html · /guide/expressions.html#html-escaping

**Other string engines**
- https://github.com/janl/mustache.js/blob/master/mustache.js
- https://github.com/mozilla/nunjucks/blob/master/docs/templating.md · /docs/api.md
- https://github.com/harttle/liquidjs/blob/master/docs/source/tutorials/escaping.md · /src/liquid-options.ts
- https://github.com/mde/ejs/tree/main/notes
- https://github.com/bgub/eta/blob/main/src/config.ts

**Advisories**
- https://github.com/advisories?query=handlebars · ?query=liquidjs · ?query=ejs · ?query=pug · ?query=dot
- https://github.com/advisories/GHSA-fwxr-j5w2-587m
- https://nvd.nist.gov/vuln/detail/CVE-2026-106120
- https://github.com/advisories/GHSA-4r6h-8v6p-xvw6 · /GHSA-5pgg-2g8v-p4x9 (xlsx)

**Astro**
- https://astro.build/blog/astro-7/ · https://astro.build/blog/astro-720
- https://docs.astro.build/en/reference/container-reference/
- https://docs.astro.build/en/guides/content-collections/
- https://docs.astro.build/en/reference/configuration-reference/
- https://docs.astro.build/en/guides/internationalization/

**Eleventy**
- https://www.11ty.dev/blog/build-awesome/ · https://blog.fontawesome.com/pausing-kickstarter/
- https://github.com/11ty/eleventy/releases/tag/v3.0.0
- https://www.11ty.dev/docs/languages/handlebars/ · /docs/data-cascade/ · /docs/plugins/i18n/ · /docs/usage/incremental/ · /docs/languages/webc/

**Component renderers**
- https://github.com/preactjs/preact-render-to-string
- https://react.dev/reference/react-dom/server/renderToStaticMarkup · https://react.dev/reference/react-dom/static/prerender
- https://vuejs.org/guide/scaling-up/ssr.html · https://svelte.dev/docs/svelte/svelte-server
- https://lit.dev/docs/ssr/overview/ · https://unpkg.com/@enhance/ssr@4.0.3/lib/transcode.mjs
- https://unpkg.com/@kitajs/html@4.2.13/README.md · https://hono.dev/docs/guides/jsx

**Schema tools**
- https://zod.dev/v4 · https://zod.dev/json-schema · https://github.com/sinclairzx81/typebox · https://ajv.js.org/guide/schema-language.html

**Vite**
- https://vite.dev/guide/build#multi-page-app · https://github.com/alexlafroscia/vite-plugin-handlebars · https://github.com/vbenjs/vite-plugin-html

**Benchmarks**
- https://github.com/itsarnaud/template-engine-bench · https://github.com/lukeed/tempura#benchmarks · https://github.com/eknkc/ssr-benchmark · https://www.zachleat.com/web/build-benchmark/
