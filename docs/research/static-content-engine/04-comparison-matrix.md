# 04: Comparison Matrix

> **Rating scale:** Excellent / Good / Average / Limited / Not supported.
>
> **Basis for the ratings:**
> - For Handlebars, Nunjucks, Liquid, Eta, Preact and 11ty: the hands-on experiment ([05](05-practical-evaluation.md)) **plus** documentation.
> - For EJS, Pug and Astro: documentation and the registry only ([03](03-template-engine-research.md)).
> - Cells marked † are ratings **not tested hands-on**.
>
> A **Preact TSX** column (component renderer) is added because it is a serious candidate. The **Astro and 11ty** columns rate the *whole framework*, not just a template engine (see §2).

## 1. Technical comparison

| Criteria | Handlebars | Nunjucks | Liquid (LiquidJS) | EJS | Eta | Pug | Astro | 11ty | Preact TSX |
|---|---|---|---|---|---|---|---|---|---|
| Template syntax | Good | Good | Average | Average† | Average | Limited† | Excellent† | Good (pick an engine) | Good |
| Data binding | Good | Good | Good | Good† | Good | Good† | Excellent† | Good | Excellent |
| Conditional | Limited | Excellent | Good | Excellent† | Excellent | Excellent† | Excellent† | Excellent (Nunjucks) | Excellent |
| Loop | Good | Excellent | Good | Excellent† | Excellent | Excellent† | Excellent† | Excellent | Excellent |
| Partial reuse | Good | Excellent | Good | Average† | Good | Good† | Excellent† | Excellent | Excellent |
| Nested layout | Good | Excellent | Good | Not supported† | Average | Excellent† | Excellent† | Excellent | Good |
| Component support | Limited | Average | Limited | Limited† | Limited | Average† | Excellent† | Average (WebC: Good†) | Excellent |
| Custom helpers | Good | Excellent | Good | Excellent† | Excellent | Good† | Excellent† | Excellent | Excellent |
| TypeScript | Limited | Limited | Average | Limited† | Average | Limited† | Excellent† | Average | Excellent |
| HTML output | Excellent | Excellent | Excellent | Excellent† | Excellent | Good† | Good† | Excellent | Good |
| CSS/JS integration | Not supported | Not supported | Not supported | Not supported† | Not supported | Not supported† | Excellent† | Good | Not supported |
| Localization | Not supported | Not supported | Average | Not supported† | Not supported | Not supported† | Average† | Average | Not supported |
| Performance | Good | Good | Average | Good† | Excellent | Good† | Average† | Average | Good |
| Security | Average | Good | Average | Average† | Average | Good† | Good† | Good | Excellent |
| Learning curve (for this team) | Excellent | Good | Good | Good† | Good | Limited† | Average† | Average | Average |
| Maintenance (project health) | Average | Limited | Good | Average† | Average | Limited† | Excellent† | Good | Excellent |

### Notes on the ratings that drive the decision

- **Conditional: Handlebars is Limited.**
  - It has no comparison operators, so `eq` is needed.
  - [RUN] `(if x "y")` cannot be used as a subexpression, so a `when` helper is needed.
  - Nunjucks has `'is-hot' if p.isHotDeal` and `==` natively.
  - Liquid is Good, not Excellent, because it has no inline `if` expression; you have to `assign` first (see `engines/liquid/templates/blocks/productList.liquid`).
- **Nested layout.**
  - Nunjucks and Pug get Excellent for `extends` + multiple blocks + `super()`.
  - Handlebars gets Good: it **does** support multiple slots via inline partials ([RUN] `shell.hbs`), but there is no `super()` and the syntax is harder to read.
  - Eta gets Average because slots are passed as strings through `layout(..., {head: \`...\`})`.
  - EJS gets Not supported (no layouts without a third-party package).
  - Preact gets Good: slots are props/children; there is no "block override" mechanism, but composition is clearer.
- **Component support.** This is the ability to declare props, enforce a contract, and dispatch by type safely.
  - Only Preact and Astro have typed props. [RUN] With Preact, `tsc` catches a typo in `type` and a wrong prop type before the build runs.
  - Every string engine only has a "partial with context" and no contract.
- **TypeScript.**
  - Handlebars, Nunjucks and EJS have no types for templates at all.
  - LiquidJS and Eta are written in TS, but templates are still not type-checked.
- **CSS/JS integration.** String engines and Preact have no asset pipeline, so the repo's own assembler has to handle it. Astro has the best one (scoped CSS, `inlineStylesheets: 'always'`). 11ty has `addBundle` and WebC bundles.
- **Localization.**
  - Every option has to bring its own string dictionary.
  - Astro and 11ty only have i18n *routing*.
  - Liquid gets Average only because the Shopify convention `{{ 'key' | t }}` reads naturally in templates.
- **Performance.** Measured on the repo's own data [RUN]:
  - Eta: 12,046 pages/s. Preact: 5,451. Nunjucks: 4,388. Handlebars: 2,964. LiquidJS: 373.
  - Liquid gets Average because it is about 8× slower than Handlebars and uses the most RSS (210 MB), **but** 1,000 pages still take only ~2.7 s.
  - 11ty: ~560 ms of fixed overhead to build 4 pages.
  - Astro: not measured; the only external benchmark (2022) is out of date.
  - At about 110 pages, **performance does not distinguish the candidates**.
- **Security.**
  - Preact gets Excellent:
    - Raw output can only happen through `dangerouslySetInnerHTML`, which is easy to confine to a single component.
    - It escapes by default.
    - No templates contain executable code.
  - Nunjucks and Pug get Good for autoescape on by default.
  - Handlebars gets Average because of the many 2026 advisories (4.7.8 in production is affected) and because `{{{ }}}` is easy to misuse.
  - Liquid gets Average: it **does not escape by default**, has a large sandbox attack surface (about 18 advisories in 2026), and `""` is truthy.
  - Eta gets Average: `<%~ include %>` mixes ordinary includes in with raw output, and arbitrary JS is allowed in templates.
  - [RUN] No engine blocks `javascript:` in `src`/`href`. URLs have to be validated in the data layer.
- **Maintenance.**
  - Nunjucks gets Limited: no release in about 3.5 years.
  - Handlebars gets Average: two security releases in 2026 after a 3-year gap; v5 is unpublished.
  - Pug gets Limited: security fixes only.
  - EJS gets Average: four breaking majors in one year.
- **Learning curve.** The current team already writes Handlebars, and every `.hbs` file in the repo is evidence of that. Preact and Astro need JSX/TS (UNVERIFIED: whether the team already uses React/RN; doc 10 R10 assumes so).

## 2. Architecture comparison

| Approach | Representatives | Where the logic lives | Strengths | Weaknesses | Fit for this repo |
|---|---|---|---|---|---|
| **Logic-driven templating** (code in templates) | EJS, Eta, Pug, doT | In the template (JS) | Flexible; very fast (compiled straight to JS) | Business logic creeps back into templates; hard to review raw output; no contract | Low: the content is *data*, while marketing/legal rules belong in the view model |
| **Data-driven / logic-less templating** | Mustache, Handlebars, Liquid, (Nunjucks is in between) | In data + helpers + the build step | Templates are easy to read; controlled helpers; non-developers can read them | Needs a view-model layer; weak dispatch and contracts; errors surface late | **This is the current model.** It is a good fit if a view-model layer and fail-fast checks are added |
| **Component-driven rendering** | Preact/React/Vue/Svelte SSR, Lit, WebC | In typed components plus the view model | Props contracts; dispatch through a registry; type checking; a single raw-HTML point | Needs a compile step; longer templates; requires JSX/TS skills | High, if typed props and admin preview become goals (doc 10) |
| **Static site generation** | Eleventy, Astro, (current `core/*`) | In the framework (data cascade, collections, routing) | Pagination, routing, assets, incremental builds | Owns the pipeline: hard to keep byte parity and custom output paths; framework lock-in | Average. The repo already has its own small SSG; replacing it costs more than it gains at about 110 pages |
| **Hybrid rendering** | SSG + islands (Astro), own pipeline + several renderers (doc 10 §7.2) | Mixed | Migrate step by step | Two systems to maintain during the transition | High **if the scope is controlled** (see [07](07-architecture-proposals.md)) |

**The essential difference between an engine and an SSG.**
- An engine is a *function* `render(template, data) → string`.
- An SSG is a *program* that decides which files are inputs, which URLs are outputs, the order the data merges in, and how assets are processed.

For example:
- Eleventy can **run** Nunjucks and Liquid, but it is not "a better Nunjucks".
- Astro is not "a template engine"; it is a compiler plus build system.

So comparing "Handlebars vs Astro" really means comparing "Handlebars + `front-end/build.js`/`core/*` vs Astro". [RUN] The Eleventy experiment shows this. The Nunjucks templates were reused **without changing a single line**. All the integration cost went into data mapping (`eleventyComputed`) and filter seams (`SafeString` from Eleventy's own Nunjucks instance).

## 3. Performance comparison

### 3.1 Measured on this repo's data [RUN]

- **Environment:** Node v24.5.0, Apple M5 (10 cores), 16 GB RAM, macOS (Darwin 25.6.0). Each engine runs in its own process; the median of 5 runs is reported.
- **Workload:**
  - "4 pages" = landing + T&C × vi/en. Each T&C page is ~170 KB of HTML, nested up to 4 levels, with a fee table.
  - "1,000 pages" = 500 × (landing + T&C), 90 MB of HTML.

| Metric | Handlebars 4.7.10 | Nunjucks 3.2.4 | LiquidJS 10.30.1 | Eta 4.6.0 | Preact 11.1.1 + prts 6.8.2 |
|---|---|---|---|---|---|
| Cold: load + compile + first render (ms) | 21.8 | 13.4 | 32.9 | **4.0** | 43.9 (includes esbuild) |
| Warm, 4 pages (ms, median / p95) | 1.5 / 2.5 | 1.0 / 1.4 | 10.9 / 12.0 | **0.4 / 0.6** | 0.8 / 1.4 |
| 1,000 pages (ms) | 337 | 228 | 2,684 | **83** | 183 |
| Throughput (pages/s) | 2,964 | 4,388 | 373 | **12,046** | 5,451 |
| RSS after the 1,000-page run (MB) | 152 | 146 | 210 | **83** | 157 |

**Other figures:**
- Eleventy 3.1.7, full CLI build of the same 4 pages: **~560 ms** (bare process ~40 ms). Almost all of it is framework start-up.
- The current repo (legacy build, 107 pages, 5.4 MB): 160–230 ms in-process; 1.05 s wall time, cold.

Raw output: `research/static-content-engine/experiments/results/bench.txt`.

### 3.2 Interpretation by factor

| Factor | Observation |
|---|---|
| Template compilation | Every engine except Liquid compiles to JS. Handlebars compiles lazily (on first render). Cold times are all under 50 ms, so there is **no need to precompile** at this scale |
| Render time | Eta is fastest (a direct JS function). LiquidJS is slowest: AST interpretation plus `{% render %}` creating an isolated scope for every table cell [INFERENCE: the experiment's per-cell `render` design inflates the cost; using `include` would be faster] |
| Memory | Proportional to output size (90 MB retained per batch while the benchmark keeps the bytes). Eta is the lightest. No engine leaks memory within a run |
| Large datasets | The 282 KB JSON per locale is fast for every engine. The real bottleneck at scale would be filesystem I/O and inlined CSS (~21.5 KB/page), not rendering |
| Concurrent rendering | Every engine is synchronous and CPU-bound. You can parallelise with `worker_threads` per page batch [INFERENCE, not measured]. Not needed at about 110 pages |
| Build time for many pages | Fixed per-build overhead: own pipeline ~40 ms, 11ty ~560 ms. Astro not measured (Vite/Rolldown overhead; see [03 §5](03-template-engine-research.md)) |
| Incremental builds / cache | Engines: none (you need a dependency graph and hashing yourself). 11ty: `--incremental` in watch mode only. Astro 7.2+: experimental `incrementalBuild` with `cacheKey`. The repo already has sha256 in `.manifest.json`, which can be reused to skip unchanged pages |
| Client-side bundle | **0 bytes for every option** as used here: rendering is build-time only, and client JS stays as vanilla `scripts.hbs`. Astro is also 0 by default (except islands) |

**Conclusion on performance:** at about 110 pages, and even 10× that, the difference between engines is between 0.1 s and 3 s. **Performance is not a deciding factor.**
