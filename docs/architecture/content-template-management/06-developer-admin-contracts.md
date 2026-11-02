# 06 — Developer vs Administrator: Registry & Contracts

> **[REC]** unless marked **[FACT]**.

## 1. Responsibility split

| Concern | Developer (code in `cvp/`) | Administrator (data in `content/`) |
|---|---|---|
| Blocks | Implement markup/CSS/JS, define `block.json` (props schema, variants, defaults), write examples, keep backward compatibility | Pick blocks allowed by the template, order them, fill props, choose variants |
| Templates | Implement `landing`, `document`, `collection-*`; declare `allowedBlocks` and variants | Choose content type (and therefore template) and variant |
| Themes | Define tokens and named themes | Pick a theme per page |
| Runtime actions | Implement `popup`, `scroll`, `navigate`, `openCard`, `link`; agree contract with app team | Fill action params (target, screen, campaignCode) from enumerated options |
| Data sources | Define collections and their schemas, query options | Create and edit items (promotions, card intros, FAQ) |
| Validation | Schemas + lint rules | Fix reported errors (shown with JSON path and message) |
| Assets | HLS tooling (`generate-hls.sh`), size limits in lint | Upload images, videos and PDFs; follow the naming convention |
| Localization | i18n UI strings (`t('faq.title')`), locale rules per content type | Translate content, mark entries ready per locale |
| Publishing | CI pipeline, env config | Promote an entry to `uat`/`stg` via `publish.json` (approved by an owner) |

**Hard rule:** administrators never author `<script>`, `<style>`, inline `style=`, event handlers or arbitrary URLs schemes. This is enforced in the validator, not by convention (see §5).

## 2. Block contract: `block.json`

Example: today's `components/activation.hbs`, re-expressed as `cvp/blocks/cta-links/block.json`.

```json
{
  "type": "cta-links",
  "version": "1.0.0",
  "title": "Legal & fee buttons",
  "description": "Row of buttons that open T&C / fee documents in the popup.",
  "category": "cta",
  "templates": ["landing"],
  "variants": {
    "full": "One full-width button",
    "pair": "Two buttons side by side (fee + terms)"
  },
  "defaultVariant": "pair",
  "props": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "background": { "enum": ["green", "white", "none"], "default": "green" },
      "titleImage": { "$ref": "cvp:asset-image" },
      "image": { "$ref": "cvp:asset-image" },
      "links": {
        "type": "array", "minItems": 1, "maxItems": 2,
        "items": {
          "type": "object", "required": ["label", "action"],
          "properties": {
            "label": { "$ref": "cvp:plain-text", "maxLength": 40 },
            "popupTitle": { "$ref": "cvp:plain-text" },
            "action": { "$ref": "cvp:action" }
          }
        }
      }
    }
  },
  "runtime": ["core/popup"],
  "assets": { "css": "block.css" },
  "examples": ["examples/pair.json", "examples/full.json"],
  "deprecated": false,
  "replaces": { "activation": "migrate/from-activation.js" }
}
```

Shared schema fragments (`cvp:*`) live in `cvp/content-types/_defs.json`:

| Fragment | Purpose |
|---|---|
| `cvp:asset-image` | Path must exist and match `\.(png\|jpe?g\|webp\|svg)$` |
| `cvp:asset-video` | HLS playlist or mp4 |
| `cvp:plain-text` | No HTML |
| `cvp:rich-text` | Sanitised HTML, allow-list (§5) |
| `cvp:action` | One of the registered runtime actions (§6) |
| `cvp:ref` | `document:`, `page:` or `collection:` reference |

## 3. Registration and discovery
1. A developer adds `cvp/blocks/<type>/` containing `block.json`, `block.hbs`, and optionally `block.css`, `block.js` and `migrate/`.
2. `core/registry.js` discovers it at build time. There is **no central list to edit**, which removes the `template.hbs` if-chain.
3. The registry validates the manifest itself (meta-schema) and registers the partial as `block/<type>`.
4. The registry emits `registry.json`, which the admin UI reads to build forms. A new block therefore appears in the admin UI with **no CMS core change**.
5. A PR adding a block must include `examples/*.json`. CI renders every example (golden-output test plus an optional screenshot), which gives a living component catalogue.

## 4. Lifecycle: versions, deprecation and missing blocks

| Situation | Behaviour |
|---|---|
| Compatible change (new optional prop) | Minor bump. Nothing else changes |
| Breaking change | Major bump. Keep `blocks/<type>/v1/` while content still uses it. The registry prints a usage report (`cvp registry usage cta-links@1`) |
| Deprecation | `"deprecated": "Use cta-links"`. The build warns, the admin UI hides the block from the picker, and existing content keeps rendering |
| Automated upgrade | `migrate.js` exports `(props) => newProps`; `cvp migrate --block activation` rewrites the content files and opens a PR |
| Unknown / removed block | **Build error** naming the file and JSON path. Today it is silently dropped (`template.hbs`) |
| Block JS dependency | `runtime: ["core/popup", "vendor/swiper@11.1.14"]`. Vendors are **pinned**; today `hls.js@1` and `swiper@11` float |
| Template compatibility | `templates: [...]` in `block.json` plus `allowedBlocks` in `template.json`. Both must agree |

## 5. Safety rules (admin content cannot execute code)

**[FACT]** Today:
- **Rich text is rendered raw**: `{{{content}}}` in `qa.hbs:15`, `{{{text}}}` in the document blocks, `{{{title}}}` in `title.hbs`.
- **The promotion `longDesc` is HTML generated from Excel.** An admin-UI author could inject `<script>`.

**Rules:**
- **Rich-text fields are sanitised at build** with an allow-list:
  - Allowed tags: `p, strong, em, u, br, ul, ol, li, a[href], span[class∈allowlist], table` (documents only).
  - No `on*` attributes, no `style`, no `<script>`/`<iframe>`.
  - **[REC]** Use `sanitize-html` (a single small dependency, justified by an admin UI writing HTML).
- **URLs are restricted** to `https:` on allow-listed hosts (`vikkibank.vn`, `vikki-cdn.*.galaxyfinx.cloud`), relative paths, or `$ref`.
  - `javascript:` and `data:` are rejected.
  - Env hosts are rejected in content (use `$ref` / `{{env.cdnHost}}`).
- **Interactions come only from registered actions.** No inline JS in content.
- **`className`/`imgClassName` free-text props are removed.** Today they inject arbitrary classes, e.g. `!w-[70%]` in `template.hbs:39`. Use enumerated `variant`/`size` props instead.

## 6. Runtime contract (`cvp/runtime/bridge.js`, `env.js`)

This writes down what exists today. **[FACT]** sources are cited per item.

| Action type | Params | Implementation | Today |
|---|---|---|---|
| `popup` | `target`: `faq` \| doc ref \| URL, `title` | `core/popup` (iframe or FAQ template) | `scripts.hbs:92-128` |
| `scroll` | `target` (#id) | `core/scroll` | `scripts.hbs:229-264` |
| `link` | `href` (allow-listed) | `<a>` | various |
| `openPromo` | `id` | `postMessage({type:'OPEN_PROMO_DETAIL', id})` to parent | `pages/promotion/list.hbs:49-64` |
| `openCard` | – | `ReactNativeWebView.postMessage({action:'OPEN_CARD'})` | `pages/vikki-one-connect/index.hbs:279` |
| `navigate` | `screen`, `campaignCode`, `actionType?` | `ReactNativeWebView.postMessage({redirectTo, additionalData:{campaignCode}, actionType})` | `td-cvp-mua-2.html:313` (dev), `:371-392` (uat) |
| `iframeResize` (auto) | – | `parent.postMessage({type:'setHeight', height})` | booking-vja, golden-saving, td-interest |

| Query param | Meaning | Today |
|---|---|---|
| `hasTopSpace=false` | Remove top padding (app header overlap) | `scripts.hbs:147-153` |
| `hasCard` | User already holds the card; hide "open card" CTA | `vikki-one-connect/index.hbs:233-237` |
| `productScheme` | Highlight partner (HDBANK, VIKKI_BANK, SOVICO, DAMTC) | `vikki-one-connect/index.hbs:241-262` |
| `category` | Filter promotion list | `promotion/list.hbs:29-46` |

**[UNKNOWN]** The full set of `redirectTo` screens and `campaignCode`s the app accepts must come from the mobile team. The `navigate` action should take an **enum** of screens maintained jointly.

## 7. Admin experience (Phase 4)

**[FACT]** Today the only admin path is Excel → `convertExcelToJson.html` → developer.

**[REC]** Build the admin layer as **schema-driven forms over git**. Two candidate implementations (decision in 08 ADR-007):

1. **Decap CMS** (git-based, open source, static admin app):
   - Its collection config can be **generated from `registry.json`**, and its "list widget with types" maps directly to block lists.
   - Saves become PRs (editorial workflow), giving review, audit and rollback for free.
   - Needs a GitHub OAuth proxy, plus an [UNKNOWN] org policy on third-party OAuth apps.
2. **Thin in-house editor**:
   - A static page with a JSON-Schema form library, preview through the existing renderer compiled for the browser, and save through the GitHub API (PR).
   - More work, full control.

Either way, the admin can:
- Create a page from a content type.
- Add, reorder or remove blocks from the template's allowed list.
- Fill forms generated from block props schemas.
- Upload assets.
- **Preview** the page by rendering the same Handlebars bundle client-side, with a WebView-size frame and query-param toggles.
- Open a PR. Merging publishes to dev; editing `publish.json` promotes it to uat/stg.
