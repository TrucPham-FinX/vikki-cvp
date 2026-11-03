# 08: Final recommendation

> This recommendation was written after the audit ([01](01-current-architecture.md), [02](02-repository-inventory.md)), the research ([03](03-template-engine-research.md)), the comparison ([04](04-comparison-matrix.md)), the experiment ([05](05-practical-evaluation.md)), the gap analysis ([06](06-gap-analysis.md)) and the options ([07](07-architecture-proposals.md)). Date: 2026-11-02.

## 1. Recommendation

> **Keep Handlebars (Option A), but restructure around a view model + closed schemas + fail-fast dispatch. Leave one block-level renderer seam (`renderBlock`), so that Option C1 (Preact TSX for individual blocks) can be added later, only when a specific trigger occurs.**
>
> **Do Phase 0 immediately (1.5–2.5 weeks). It does not depend on the engine choice.**
>
> **Do not** replace the engine wholesale (B), and **do not** adopt Astro/Eleventy (C2) at this point.

### 1.1 Why

1. **The real problems are not in the engine.** Of 9 Critical/High gaps, 0 are caused by Handlebars ([06 §3](06-gap-analysis.md)). The two most serious:
   - A T&C clause is lost in production. Cause: the `if-eq` chain + a permissive schema.
   - Two pipelines diverge. Cause: code organisation.

   Any engine, organised the same way, produces the same failures. [RUN] In the experiment, every engine relied on `prepare.js` for sanitising and numbering, and none blocked a `javascript:` URL.
2. **Restructured Handlebars has already been shown to fix the main problems.**
   - `experiments/engines/handlebars/` has a shell with 3 slots, dispatch that throws (case-sensitive), and no logic in templates.
   - It produces HTML equivalent to the other 5 implementations, with the **least code** (87 lines / 5.5k characters).
3. **The alternatives are not clearly better as string engines:**
   - **Nunjucks:** cleaner syntax, but stagnant (no release in ~3.5 years).
   - **LiquidJS:** no escaping by default, `""` truthy, ~18 advisories in 2026.
   - **Eta:** JS in templates and raw output on every include.

   Swapping engines would cost a rewrite plus risk to legal content, in exchange for a little syntactic convenience.
4. **The one real advantage of the component renderer (Preact TSX) is typed props (G11), which is Medium severity.**
   - It is valuable for an admin UI with live preview, and for blocks that change often.
   - It does not justify rewriting ~80 templates now.
   - The seam in point 1 leaves the door open at a cost of about 1 function.
5. **Performance does not decide anything.** All engines render 1,000 large pages in 0.08–2.7 s. The current build takes ~0.2 s.

### 1.2 How this differs from `docs/architecture/content-template-management/10-template-engine-evaluation.md`

Doc 10 recommends Preact TSX as the block renderer. This report **revises the order and the conditions**, but does not reject that direction:

| Point | Doc 10 | This report |
|---|---|---|
| Evidence for "component rendering is N× faster" | The spike in `tools/spike-template-engine.js` | **Invalid** ([05 §1](05-practical-evaluation.md)). Under fair measurement, Preact is ~1.8× faster than Handlebars, which is meaningless at this scale |
| What blocks quality | No component model | **Pipeline drift, the data contract and the sanitiser** (F1–F6); these were not yet known when doc 10 was written |
| Preact | Recommended right away | **Conditional** on the triggers in §3. The block-level seam keeps the doc 10 path open |
| Facts in doc 10 that need correcting | "No release after 4.7.8"; Nunjucks 3.2.4 | Handlebars 4.7.9 and 4.7.10 were released in 2026, and production is still on 4.7.8. Nunjucks 3.2.4 is correct. CVE-2026-106120 is confirmed to exist |

## 2. Roadmap

| Phase | Content | Exit criteria (measurable) | Estimate [INFERENCE] |
|---|---|---|---|
| **0: Correctness & safety** | (0.1) Pick one pipeline. Recommended: bring locale, detail pages and `prepareNumOrder` into core, then point both CI and publish at it; or retire core if the team is not ready. (0.2) Closed schemas for document blocks, unknown type = **error**, fail-fast dispatch; fix the data in `vikki-go-plus-cvp/tc.json` (with Legal confirming the restored clause). (0.3) `sanitize-html` in the data layer + URL policy using `allowedLinkHosts`; escape text in `import-promotions.js`; delete `core/sanitize.js`. (0.4) handlebars ≥ 4.7.10 in `front-end`; deal with `xlsx`. (0.5) Dev server: prefix check + `127.0.0.1` | The publish pipeline produces 107/107 pages (plus the restored clause, the only intended diff) and CI checks the same pipeline. A test fails when a block has no type. `npm audit --omit=dev` shows no high/critical. Payloads from `experiments/security.js` are blocked | 1.5–2.5 weeks |
| **1: View model & contract** | `prepare(raw) → vm` (pure, deep-freeze, unit tests); `t()` + `ui.<locale>.json`; tighten `*.block.json` (`additionalProperties: false`); a check that the number of text nodes in data equals the number in HTML | 0 hard-coded UI strings in templates (grep). Validator: 0 warnings, 0 errors | 1–1.5 weeks |
| **2: Templates** | One `shell.hbs` (slots) + 4 templates (landing, document, collection-list, collection-detail); merge `legal/*` into `static/*`; skins via `className` + `themes/*.json` instead of copied CSS | Number of layouts 8 → ≤5. 0 page `.hbs` files containing only `<style>`. Visual diff at 375×812 and 414×896 approved (Legal approves documents) | 2–4 weeks |
| **3: Seam (optional, cheap)** | `renderBlock(type, props, ctx)` in the registry, with `renderer: 'hbs'` by default; `lib/helpers` shared | One interface, covered by a test. No TSX in production yet | 2–3 days |
| **4: Triggered** | Add TSX for a specific block **only when** a trigger in §3 occurs | See §3 | Per block |

## 3. Triggers for moving further (Option C1, then possibly B)

Move individual blocks to Preact TSX **only when at least one of these holds**:
1. An admin UI with live preview is approved (doc 10 R6). Then rendering the same components in the browser is a real benefit.
2. Props errors keep slipping into production after Phase 1 has tightened the schemas. For example, more than 2 incidents per quarter caused by wrong types or missing props.
3. Planned new blocks are complex: interactive widgets or variants with many props.
4. The FE team confirms it is fluent in JSX/TS (doc 10 R10, currently **UNVERIFIED**).

**Signals to consider a full replacement (B):**
- More than 50% of blocks are already TSX.
- The Handlebars shell has become the bottleneck for changes.

**Signals to consider Astro (C2):**
- The team decides it does not want to own the pipeline.
- Requirements arise for routing or i18n routing, or for thousands of pages that need incremental builds.

## 4. Answers to the seven questions in the brief

1. **Is Handlebars still a good fit?**
   - **Yes, for the current needs:** static HTML from JSON, about 110 pages, developer-written templates, no typed props required.
   - **Conditions:** upgrade to ≥ 4.7.10 (production is on 4.7.8, which has open critical advisories) and restructure as in Phase 0–2.
   - It is less suitable if the goal becomes a typed component system with an admin preview. That is what the seam in Phase 3 is for.
2. **Are the real limitations in the engine or in how the code is organised?**
   - **Overwhelmingly in the organisation:** 9/9 Critical/High gaps.
   - The genuine engine limitations:
     - No props/type contract (G11).
     - No comparison operators or inline `if` (fixed with a few helpers).
     - HTML-only escaping (shared by every engine).
3. **Is there a better solution than Handlebars for static HTML from JSON?**
   - **Among string engines: no clear winner.**
     - Nunjucks has a nicer syntax but is less healthy.
     - Eta is faster but brings logic back into templates.
     - LiquidJS has risky semantics and defaults.
   - **More capable:** Preact TSX, because it is a component renderer with types, which is a different category.
4. **What is the best fit for a system of reusable components?**
   - **Preact TSX** (or React, if the team prefers it) **inside the repo's own pipeline**, with:
     - a registry dispatching by `type` (mapped types force completeness);
     - one schema source (Zod 4 → `z.toJSONSchema()` for Ajv/admin);
     - one raw-HTML point (`<Rich>`).
   - Astro is the option with the best DX if you accept that it owns the pipeline.
5. **Should we build an abstraction layer to avoid depending on one engine?**
   - **Yes, but thin and at block level:** `renderBlock(type, props, ctx) → string`, plus shared helpers.
   - **No** generic "engine adapter" covering layouts/partials/filters. That would end up as a lowest common denominator of every engine, adding complexity without real portability.
   - What makes the system portable is a **clean view model** and **logic-free templates**. [RUN] In the experiment, porting one page between engines took ~90 lines because all the logic lived in `prepare.js`.
6. **If we migrate, all at once or in parts?**
   - **In parts.**
     - Phase 0–2 stays on Handlebars.
     - After that, **one block at a time**, reversibly, only for new or redesigned blocks.
     - Accept each step with normalised parity (parse5, as in `experiments/verify.js`) or visual diff + sign-off.
     - Legal/fee documents (about 84% of data lines, according to doc 10 §7.3) come last.
   - **Never** swap the renderer and the data shape for the same block at the same time.
7. **Which architecture lasts and is easy to maintain and extend?**
   - The architecture to keep is **validate (closed schemas) → prepare (pure view model) → render (logic-free templates/components via a registry) → assemble → manifest**, with **one** pipeline used by both CI and publish.
   - The renderer is a replaceable detail behind `renderBlock`.
   - This is the target architecture the repo already outlines (doc 04/09), but with the missing pieces actually wired in:
     - sanitiser;
     - themes;
     - shell;
     - a single data source.

## 5. Decision risks and how to mitigate them

| Risk | Mitigation |
|---|---|
| Staying on Handlebars → the "technical debt" is never paid | Phase 0–2 exit criteria are measurable. The seam in Phase 3 keeps the option open. Review the triggers in §3 every quarter |
| Restoring the lost clause = a change to published legal content | Treat it as a content release: Legal/Product confirms before deploying. Record it in the changelog |
| Restructuring templates changes the markup of legal documents | Visual diff + normalised parity on 100% of document pages; Legal approves |
| Handlebars stays slow to evolve (v5 unpublished) | Templates use a small, portable subset (5 experiment ports in ~90 lines each). Track the GHSA feed for handlebars in CI (`npm audit`) |
| Two renderers live side by side indefinitely (if C1 starts) | Exit criterion: delete the seam if nothing moves to TSX within 2 quarters; or move to B once over 50% of blocks are TSX |
