# 06: Gap analysis

> This maps what the current repository can do ([01](01-current-architecture.md), [02](02-repository-inventory.md)) against the research ([03](03-template-engine-research.md), [04](04-comparison-matrix.md)) and the experiment ([05](05-practical-evaluation.md)).
>
> **Severity:**
> - **Critical:** must be fixed.
> - **High:** significant impact.
> - **Medium:** can be improved.
> - **Low:** not a priority yet.
>
> **Migration cost** is a rough estimate for one FE engineer who knows the repo. All costs are [INFERENCE], not measured.
>
> **The column "Engine or organisation?"** answers question 2 of the brief: is the cause the Handlebars engine itself, or the way the code is organised?

## 1. Gap table

| # | Current Capability | Current Implementation | Limitation | Alternative Solution | Expected Improvement | Migration Cost | Severity | Engine or organisation? |
|---|---|---|---|---|---|---|---|---|
| G1 | Build pipeline | Two pipelines (`front-end/build.js`, `core/build.js`) writing to the same `vikki-cvp/` | Core lacks locales, detail pages and FAQ numbering; it is missing 60 pages, and 18 pages differ. CI only guards legacy, while publish calls core | **One pipeline.** Port the 3 missing features into core (or retire core), and run the byte-parity gate on the pipeline that actually publishes | Removes a whole class of drift; publish = what CI checked | 2–4 days | **Critical** | Organisation |
| G2 | Content integrity (document blocks) | `if (eq type …)` chains in `static/*`/`legal/*`; the validator only warns | A block without `type` is **silently dropped**: the "Chấm dứt sử dụng Thẻ" clause is missing in production | (a) Closed schema: `type` in an `enum`, `additionalProperties: false` for document blocks, and errors instead of warnings. (b) Dispatch with `{{> (concat "doc/blocks/" type)}}`, which throws if the partial is missing. (c) A test: number of text nodes in data ≈ in HTML | Content errors fail CI instead of reaching production | 1–2 days + fixing data | **Critical** | Organisation (the engine supports dynamic partials) |
| G3 | XSS / rich text | `{{{…}}}` in 16 places; HTML from Excel with no escaping; `core/sanitize.js` is unused and bypassable | Raw HTML from people who are not developers; regex sanitiser | A proven sanitiser (`sanitize-html`, or DOMPurify + jsdom) **in the data layer** (import + build), with an allow-list built from the tags and attributes actually used in data (§2.3 of [01]). Remove `core/sanitize.js`. Escape text in `import-promotions.js` before building HTML | Blocks injection from content; keeps `class`/`type` that are in use | 1–2 days | **Critical** | Organisation (no engine fixes this, see [05 §3.4]) |
| G4 | URL safety | Not validated; `data-popup` → `iframe.src` | `javascript:`/`data:` in `src`/`href`/`data-popup` passes every engine | Validate URL fields in the view model: scheme allow-list + `security.allowedLinkHosts` (config already exists but is unused) | Closes the gap no engine covers | 0.5–1 day | High | Organisation |
| G5 | Dependency security | handlebars **4.7.8** (lockfile), xlsx 0.18.5 | 2026 advisories (critical) for <4.7.10; xlsx has no fix on npm | Bump `front-end` to handlebars ≥4.7.10 (byte parity must stay 107/107, to be checked). Replace `xlsx` with SheetJS from the official CDN or exceljs, or isolate the import to run offline | Closes known advisories | 0.5 day (+ import replacement) | High | Organisation |
| G6 | Template scalability: layouts | 8 layouts, one slot `{{{body}}}`; `legal-document` puts body inside `<head>`; large CSS duplicated per layout | Adding a page type means copying a layout | **One shell with named slots** (inline partials, as in the experiment's `shell.hbs`) + 3–4 templates (landing, document, collection list/detail), matching doc 04/ADR-005 | Fewer layouts; head/scripts slots; document layouts merged | 1–2 weeks (needs visual diff) | High | Organisation |
| G7 | Component reusability | Partials with no contract; `legal/*` duplicates `static/*`; page CSS copy-paste (0–35 differing lines out of ~220) | Changing shared UI means editing 8–10 files | Merge `legal/*` into `static/*`. Page skin = `className` + theme tokens (`themes/*.json` is already there but not applied) instead of copying CSS | Less duplication; changes in one place | 1–2 weeks | High | Organisation |
| G8 | Data schema validation | Ajv with permissive schemas; `*.block.json` is not tied to the code | Cannot detect a missing/extra prop or a wrong type; no TS types | Tighten the schemas (step 1). Then **one schema source** → JSON Schema (Ajv/admin form) + TS types: Zod 4 `z.toJSONSchema()` or `json-schema-to-typescript` from the existing `*.block.json` | Errors caught before render; contract shared between developers and the admin UI | Step 1: 2–3 days. Single source: 1–2 weeks | High | Mostly organisation; TS-typed templates need a component renderer (engine) |
| G9 | Separation of concerns | `prepareNumOrder` mutates data inside the build loop; UI strings in templates; logic split between the build script and helpers | Logic gets lost when porting (F3); hard to test | A **view-model step** (pure function `prepare(raw) → vm`, deep-freeze, unit tests), as in `lib/prepare.js` in the experiment | Templates only present; logic is testable | 2–3 days | High | Organisation |
| G10 | Localisation | Whole content duplicated per locale; UI strings hard-coded vi/en; `t` + dictionary unused | Adding a language = copying every file; English pages still show "Hỏi đáp" | A `ui.<locale>.json` dictionary + `t()` that **throws on a missing key**. Content stays per locale (legal text must be translated in full) | Consistent UI strings; missing translations caught | 2–3 days | Medium | Organisation |
| G11 | Component typing / dev-time errors | None | Errors appear at build/render time, or not at all | Component renderer (Preact TSX): `tsc` catches typos in `type`/props (shown in [05 §3.3]) | Errors caught in the IDE | High (rewrite + toolchain) | Medium | **Engine** (the one gap Handlebars cannot close) |
| G12 | CSS/JS assets | `styles.hbs`/`scripts.hbs` (21.5 KB) inlined into every page; per-page CSS | No browser/WebView caching; no minification | A shared external `cvp.css`/`cvp.js` via the existing assembler (hash in the filename, using the manifest), keeping inline as an option for iframes that must be self-contained | Smaller payload, cacheable | 3–5 days + WebView testing | Medium | Organisation |
| G13 | Rendering performance | ~0.2 s / 107 pages | None at the current scale | Not needed. If it grows to ≥10k pages: cache compiled templates, workers, skip pages whose input hash is unchanged (manifest) | n/a | n/a | Low | n/a |
| G14 | Developer experience: dev server | `--watch`, full rebuild; path traversal; binds `*:3000` | Security hole on a LAN | `path.resolve` + check the prefix stays inside HOST; listen on `127.0.0.1`. Or use `npx serve`/`vite preview` | Closes the security hole | 0.5 day | Medium | Organisation |
| G15 | Duplicated source of truth | `content/**` (80 files) is not read by any build | Drifts from `front-end/data` | Pick one source; delete or freeze the other | Less confusion | 0.5 day | Medium | Organisation |
| G16 | Extensibility: Excel import | One-way HTML conversion, no escaping | See G3 | Import produces **structured data** (paragraphs/list items as arrays), not an HTML string; the template renders it | Removes most raw HTML | 2–3 days | Medium | Organisation |
| G17 | Roadmap / measurement tools | `verify-roadmap.js` only checks files exist; the spike benchmark is invalid | False assurance ("Phase N done") | Behaviour checks: parity, page count, number of content nodes; replace the spike with `experiments/` | Accurate progress reporting | 1 day | Low | Organisation |
| G18 | Admin preview (future, doc 10 R6) | None | n/a | Handlebars runs in the browser; Preact also does (the same components) | Depends on the admin UI roadmap | n/a | Low (now) | Both can do it |

## 2. Grouped by focus area

| Area | Gaps | Main conclusion |
|---|---|---|
| Template scalability | G6, G7 | The problem is **8 one-slot layouts and copy-pasted CSS**, not the engine. Handlebars already supports multiple slots (shown in the experiment) |
| Component reusability | G7, G11 | Merging duplicate partials and introducing a registry dispatch gets ~80% of the benefit. Typed props need a component renderer |
| Data schema validation | G2, G8 | **The highest-value point in the whole report:** a closed schema would have prevented F2 |
| Separation of concerns | G9, G10, G16 | Needs a view-model layer. Every engine in the experiment relies on `prepare.js` |
| Rendering performance | G13 | Not an issue |
| Developer experience | G1, G11, G14, G17 | One pipeline + fail-fast + a safe dev server matter more than the template syntax |
| Maintainability | G1, G5, G15 | Two pipelines and two data sources are the biggest maintenance burden |
| Extensibility | G8, G12, G16 | A renderer interface (`render(blockType, props) → string`) leaves room to add a different renderer later |

## 3. Counts by severity and root cause

| Severity | Count | Engine | Organisation |
|---|---|---|---|
| Critical | 3 (G1, G2, G3) | 0 | 3 |
| High | 6 (G4–G9) | 0 (G8 partly) | 6 |
| Medium | 6 (G10–G12, G14–G16) | 1 (G11) | 5 |
| Low | 3 (G13, G17, G18 future) | n/a | 2 |

**Conclusion:** of the 9 Critical and High items, **none is caused by the Handlebars engine**. The only gap the engine itself creates is G11 (props typing / dev-time errors), and it is Medium.
