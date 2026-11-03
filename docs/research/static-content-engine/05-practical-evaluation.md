# 05: Results of the practical evaluation

> **Code:** `research/static-content-engine/experiments/` (its own `package.json`, isolated from production).
> **Raw results:** `experiments/results/*.txt`.
> **Run date:** 2026-11-02 · Node v24.5.0 · Apple M5 · macOS (Darwin 25.6.0).
> **Rerun:** `cd research/static-content-engine/experiments && npm install && npm run all`

## 1. Why the existing spike was not reused

`tools/spike-template-engine.js` reports Handlebars as "N× slower" than "component rendering". That result **is not valid as evidence**:

1. The "component" functions (l.16-70) output **different HTML** from the Handlebars partials: different classes, a different structure, and `faq-item` instead of `accordion-item`.
2. The "component" side has **no escaping** at all (`${item.question}` is interpolated directly), so it is not comparable to an escaping engine.
3. The line `Deterministic: 100% byte-repeatable` (l.137) is a **hard-coded string**. Nothing is actually checked.
4. It measures 3 tiny blocks with 3 items each, not a real page.

The experiment below was designed to remove all four of these flaws.

## 2. Design

### 2.1 Representative use case, built from real data

`fixtures/build-fixtures.js` reads (read-only):

| Source | Used for |
|---|---|
| `front-end/data/home-loan-cvp/index.json` | Top menu, 3 image sections, FAQ teaser, activation CTA, FAQ groups (`qaGroup`) |
| `front-end/data/promotion/list.json` | 6 offers (product list), one marked hot deal |
| `front-end/data/vikki-go-plus-cvp/tc.json` | 2 T&C sections: `sections → articles → blocks`, recursive lists (`children`), list items that contain tables |
| `front-end/data/vikki-one-connect/fee.json` | 1 fee table with `rowspan`/`colspan`/`className` |

**Two pages × two locales:**
- `index.html` (landing).
- `tc.html` (document, ~170 KB of HTML).

The fixture covers every requirement:

| Requirement | How the fixture covers it |
|---|---|
| Header/Footer | A shared shell for both pages, with 3 slots: `head`, `main`, `scripts` |
| Hero | Video banner and heading |
| Product list | `productList` with category tags |
| Conditional rendering | Hot badge, optional `id`, buttons that may be present or not |
| Nested data | A 4-level document tree and recursive lists |
| Reusable components | Dispatch by `type` string |
| Localization | `page.{vi,en}.json` plus a `ui.json` dictionary; `t(key)` **throws on a missing key** |
| Dynamic CSS class | `cx(...)`, `is-hot`, `is-open`, `bg-*` fallback, `tag-<lower(category)>` |
| Asset references | `asset()` from `assetBase` |
| JSON in `<script>` | Escaped safely |

**Data repair:** the fixture repairs the untyped block from [F2](01-current-architecture.md) and logs the repair (`results/fixtures.txt`). Without that, the repaired clause is the one that **production is missing today**.

### 2.2 Fairness controls

- **One input:** every engine consumes the same `prepare(page, ui)` output. `lib/prepare.js` numbers the FAQ, sanitises rich-text fields with `sanitize-html`, and deep-freezes the data, so any template that tries to mutate data throws.
- **Shared helpers:** `cx`, `asset`, `t`, `scriptJson` and `lower` come from `lib/helpers.js`. Each engine only registers them through its own mechanism (helper, filter, global or import).
- **Proof of equal output:** `verify.js` compares every page from every engine against the Handlebars reference, using **parse5-canonical HTML**:
  - What is normalised: quote style, `<img/>` vs `<img>`, boolean attributes, whitespace between tags, the order of class tokens, attribute order.
  - **Nothing else is normalised.**
- **Fair benchmark:** every engine runs in a separate process, 5 runs per engine, and the median is reported.

### 2.3 Implementations

| Engine | Version | Layout technique | Dispatch | Raw HTML |
|---|---|---|---|---|
| Handlebars | 4.7.10 | `{{#> layouts/shell}}` + `{{#*inline "main"}}` (multiple slots) | `{{> (concat "blocks/" type)}}` (dynamic partial) | `{{{ }}}` |
| Nunjucks | 3.2.4 | `{% extends %}` + `{% block %}` | `{% include "blocks/" + b.type + ".njk" %}`; document via recursive macro + `fail()` | `\| safe` |
| LiquidJS | 10.30.1 | `{% layout %}` + `{% block %}` | `{% render tpl %}` (dynamic, isolated scope) | `\| raw` with `outputEscape: escape` |
| Eta | 4.6.0 | `layout('/layouts/shell', {...})` | `include('/blocks/' + c.type)` | `<%~ %>` |
| Preact TSX | 11.1.1 / prts 6.8.2 / esbuild 0.28.2 | `<Shell head scripts>{children}</Shell>` | `REGISTRY[c.type]` (mapped type) | Only through `<Rich html>` |
| Eleventy | 3.1.7 | Reuses the Nunjucks templates **unchanged** | Pagination over locales | n/a |

## 3. Results

### 3.1 Equivalence [RUN] (`results/verify.txt`)

```
✓ eleventy   4/4 pages equivalent
✓ eta        4/4 pages equivalent
✓ liquid     4/4 pages equivalent
✓ nunjucks   4/4 pages equivalent
✓ preact     4/4 pages equivalent
```

All 6 implementations produce **the same page**. That makes the code-size and performance figures below directly comparable.

### 3.2 Code size (`results/metrics.txt`)

| Engine | Template files | Non-blank lines | Non-whitespace chars | Glue lines (`render.js`/config) | Raw-HTML sites |
|---|---|---|---|---|---|
| Handlebars | 15 | 87 | 5,552 | 38 | 9 |
| Nunjucks | 11 | 92 | 6,008 | 19 | 8 |
| LiquidJS | 17 | 89 | 6,019 | 25 | 9 |
| Eta | 15 | 94 | 6,128 | 18 | **24** |
| Preact TSX | 6 | 215* | 9,994* | 18 | 10 |
| Eleventy (on top of Nunjucks) | 4 | 23 | 924 | 15 | 0 |

\* Includes `types.ts` (~35 lines of props type definitions). That is a **contract** the string engines do not have. Excluding it, the TSX templates are ~180 lines, about 2× the string templates, mostly because of `.map(...)` and explicit props.

Shared code that is not counted above: `lib/prepare.js` (~95 lines) and `lib/helpers.js` (~25 lines).

**Reading the numbers:**
- The string engines are **about the same size** (5.5–6.1k characters). Handlebars is the smallest.
- Eta's "raw sites" count is inflated because `include()` has to go through `<%~ %>`. When auditing XSS, you cannot grep for "raw HTML" and get only the dangerous spots.

### 3.3 Complexity and DX: what came up during implementation [RUN]

| Engine | Problems found | Effect |
|---|---|---|
| Handlebars | (1) `(if cond "x")` → *"#if requires exactly one argument"*, so a `when` helper is needed. (2) No comparison operators, so `eq` is needed. (3) Inline partial syntax is hard to read for newcomers | Small, but adds 6 helpers (`eq`, `or`, `when`, `concat`, `cx`, `lower`) |
| Nunjucks | (1) **Dynamic `include` resolves through the filesystem: on case-insensitive macOS, `imagesection` loads `imageSection.njk` with no error.** (2) Imported macros do not see the outer context. (3) An unknown block inside a macro needs a self-written `fail()` global | (1) is a dev/CI divergence bug |
| LiquidJS | (1) **Does not escape by default.** (2) **`""` is truthy**, so the first render produced `class=""` and 2/4 pages differed until `jsTruthy: true` was set. (3) `render` isolates scope, so `assetBase`/`ui` have to go through `globals`. (4) No inline string concatenation (`assign` + `append`). (5) `default` cannot follow `cx` | Most friction of all the engines. Migrating from Handlebars would **change output silently** if the options are not configured exactly |
| Eta | (1) **Prints the literal string `undefined`** for optional fields: 0/4 pages matched until `autoFilter` + `filterFunction` were set. (2) Slots are passed as JS strings, so you have to call `esc()` yourself inside template literals | Easy to introduce XSS when building HTML strings inside JS |
| Preact TSX | (1) Needs esbuild plus a TS config. (2) `require` needs typing. (3) Longer code | **The only engine where errors are caught before the build:** `tsc` reports `'"imagesection"' … Did you mean '"imageSection"'?` and `Type 'string' is not assignable to type 'boolean'` |
| Eleventy | (1) The paginated data sits under `vm.*`, so `eleventyComputed` is needed to lift the keys. (2) `addFilter()` output is autoescaped; a `SafeString` from **Eleventy's own Nunjucks instance** is needed | Integration cost sits in the seams, not in the templates |

### 3.4 Security: same payloads, default behaviour [RUN] (`results/security.txt`)

| Case | Handlebars | Nunjucks | Liquid* | Eta | Preact |
|---|---|---|---|---|---|
| `<script>` in text | safe | safe | safe | safe | safe |
| `x" onmouseover=…` in a class | safe | safe | safe | safe | safe |
| `javascript:` in `src` | **vulnerable** | **vulnerable** | **vulnerable** | **vulnerable** | **vulnerable** |
| `</script>` in embedded JSON | safe** | safe** | safe** | safe** | safe** |
| Rich text `<img onerror>` / `&#106;avascript:` | safe*** | safe*** | safe*** | safe*** | safe*** |
| Spelling typo in a block type (`imageSectoin`) | throws | throws | throws | throws | throws (+ tsc) |
| **Case-only typo (`imagesection`) on macOS** | throws | **silent** | **silent** | **silent** | throws (+ tsc) |
| Unknown document block | throws | throws (via `fail()`) | throws | throws | throws |

\* With `outputEscape: 'escape'`. The default would be "vulnerable" in rows 1–2.
\*\* Thanks to the shared `scriptJson` helper, not the engine.
\*\*\* Thanks to `sanitize-html` in `prepare.js`, not the engine.

**Sanitiser comparison on the payloads that bypass the repo:**

| Input | `core/sanitize.js` (repo) | `sanitize-html` (experiment config) |
|---|---|---|
| `<a href="&#106;avascript:alert(1)">` | **unchanged (bypass)** | `<a>x</a>` |
| `<a href="java&#x09;script:…">` | **unchanged (bypass)** | `<a>x</a>` |
| `<a title='"onmouseover=alert(1) x="'>` | **`<a title=""onmouseover=alert(1) x="">` (creates an event handler)** | `<a>x</a>` |
| `<ul class="note-plus-list">` (real content) | **drops `class`** | keeps `class` |

**Conclusion:** XSS safety comes from (1) the **data layer**: a real sanitiser plus URL validation, and (2) **conventions that limit raw output** to a single place. It does not come from the choice of engine. All five engines need a URL policy in the data layer.

### 3.5 Performance (`results/bench.txt`)

See [04 §3.1](04-comparison-matrix.md) for the full table. Summary:

- **1,000 large pages (90 MB):**

  | Engine | Time |
  |---|---|
  | Eta | 83 ms |
  | Preact | 183 ms |
  | Nunjucks | 228 ms |
  | Handlebars | 337 ms |
  | LiquidJS | 2,684 ms |

- **Eleventy:** ~560 ms fixed for 4 pages.
- **At the current scale** (107 pages) the difference between the fastest and slowest engine is **< 0.3 s**. It plays no role in the decision.

## 4. Evaluation

| Criterion | Handlebars (restructured) | Nunjucks | LiquidJS | Eta | Preact TSX | Eleventy + Nunjucks |
|---|---|---|---|---|---|---|
| Amount of code | **Least** | Least | Least | Least | ~2× (includes types) | Least (reuses templates) |
| Template complexity | Average (helpers make up for missing syntax) | **Low** (native syntax) | High (assign/append, options) | Average (JS mixed in) | Average (JSX) | As Nunjucks + data mapping |
| Reusability | Good | Good | Good | Good | **Excellent** (typed props) | Good |
| Maintainability | Good *if a view model exists* | Good, but the engine is stagnant | Average (semantics differ from JS) | Average (logic creeps back) | **Excellent** (tsc, a single raw point) | Average (one more framework layer) |
| Extensibility | Good | Good | Good | Good | **Excellent** (registry + types → JSON Schema) | Good (plugins) |
| Render time (1,000 pages) | 337 ms | 228 ms | 2,684 ms | **83 ms** | 183 ms | +~0.5 s overhead |
| Cost to migrate from the current state | **Lowest** (same engine, same syntax) | Low–average (syntax close to Handlebars) | Average (different semantics) | Average | High (rewrite + toolchain) | Average–high (pipeline) |

**The most important observation:** the restructured Handlebars implementation (one shell with 3 slots, dynamic dispatch that throws, all logic moved into `prepare.js`) **fixes most of the issues in [01](01-current-architecture.md)** without changing engines:

| Issue | How the restructured Handlebars fixes it |
|---|---|
| F2 (lost content) | Dispatch throws on unknown types |
| F3 (lost numbering) | Numbering lives in the view model |
| `{{{body}}}` inside `<head>` | Named slots |
| Hard-coded UI strings | `t()` with a dictionary |
| Raw output of untrusted HTML | Sanitising in the data layer |

What Handlebars **cannot** provide is a props contract checked before the build. For that you need a schema layer (Ajv/Zod) or a typed component renderer.

## 5. Limitations of the experiment

- One use case (a landing page + a document page). The experiment does not cover: the promotion list/detail pages, the hand-written pages, or client-side JS (`scripts.hbs`), which stays the same for every option.
- Astro, EJS, Pug, Vue and Svelte were **not implemented**. Their ratings come from documentation.
- The LiquidJS benchmark depends on the per-cell `render` design (isolated scope). An `include` version may be faster (not measured).
- Measured on one machine (Apple M5). CI on Linux/x86 will give different absolute numbers; relative rankings may also differ.
- parse5 normalisation does not catch differences in CSS or JS semantics, but those parts are identical across every engine in the experiment.
