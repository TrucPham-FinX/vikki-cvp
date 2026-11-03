# Static Content Engine: Practical Experiments

These experiments are isolated research and are not part of the production build. They have their own `package.json` and `node_modules`, and they read repo data **read-only**: `front-end/data/*` and `core/sanitize.js`, which is used only for the comparison in `security.js`.

The analysis is in [`docs/research/static-content-engine/05-practical-evaluation.md`](../../../docs/research/static-content-engine/05-practical-evaluation.md).

## Running

```bash
cd research/static-content-engine/experiments
npm install
npm run all        # fixtures -> build -> verify -> security -> metrics -> bench
```

## Layout

| Path | Contents |
|---|---|
| `fixtures/build-fixtures.js` | Builds the shared input from real data: `home-loan-cvp` (landing + FAQ), `promotion/list.json` (6 offers), `vikki-go-plus-cvp/tc.json` (nested T&C), `vikki-one-connect/fee.json` (fee table) |
| `fixtures/page.{vi,en}.json`, `ui.json` | **The single JSON input shared by every engine** (same shape for both locales) |
| `lib/prepare.js` | Engine-independent view model: FAQ numbering, `sanitize-html` for rich-text fields, picks the locale dictionary, deep-freeze |
| `lib/helpers.js` | `cx`, `asset`, `t` (throws on a missing key), `scriptJson`, `lower`. These are shared so the comparison measures the engine, not the helpers |
| `lib/normalize.js` | Canonical form via parse5, used to compare output across engines |
| `engines/handlebars` | Handlebars 4.7.10, restructured: shell with inline-partial slots, dynamic partial dispatch |
| `engines/nunjucks` | Nunjucks 3.2.4: `extends`/`block`, dynamic `include`, recursive macros |
| `engines/liquid` | LiquidJS 10.30.1: `layout`/`block`, `render` (isolated scope), `outputEscape: escape`, `jsTruthy` |
| `engines/eta` | Eta 4.6.0: `layout()`, `include()`, `autoFilter` for nullish values |
| `engines/preact` | Preact 11.1.1 + preact-render-to-string 6.8.2, TSX compiled by esbuild 0.28.2, `tsc --noEmit` type check |
| `engines/eleventy` | Eleventy 3.1.7 reusing the Nunjucks templates **unchanged** (pagination over locales) |
| `run-all.js` / `verify.js` / `security.js` / `metrics.js` / `bench.js` | Render / compare / security probe / code metrics / benchmark |
| `results/*.txt` | Raw output of the latest run (2026-11-02, Node 24.5.0, Apple M5, macOS 26 / Darwin 25.6.0) |

Each engine outputs `dist/<engine>/{vi,en}/{index,tc}.html`. `verify.js` checks that all 4 pages from every engine are **equivalent** to the Handlebars reference after parse5 normalisation.
