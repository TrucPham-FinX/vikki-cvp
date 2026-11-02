# Content & Template Management: Architecture Review (Vikki CVP)

This review covers the CVP pages in `dev/s3-bucket-apse5-dev-vikki/vikki-cvp/` and the Handlebars generator in `dev/s3-bucket-apse5-dev-vikki/front-end/`. It proposes how to turn them into a block-based, git-backed content system that an admin UI can sit on top of. It does not propose a rewrite.

| # | Document | What it answers |
|---|---|---|
| 01 | [Current state audit](01-current-state-audit.md) | How pages are built and deployed today, traced through the code |
| 02 | [Content & template inventory](02-content-template-inventory.md) | What content, templates and blocks exist, and which concepts are actually needed |
| 03 | [Problem analysis](03-problem-analysis.md) | Problems found, with the evidence for each, and recommendations R1–R20 classified KEEP / REFACTOR / MERGE / SPLIT / EXTEND / REPLACE / NEW |
| 04 | [Target architecture](04-target-architecture.md) | Modules, folder layout and rendering flow |
| 05 | [Data model](05-data-model-and-relationships.md) | Entity-relationship diagram, entities and the shape of each entry |
| 06 | [Developer/admin contracts](06-developer-admin-contracts.md) | `block.json`, safety rules, the runtime (app bridge) contract and the admin experience |
| 07 | [Migration roadmap](07-migration-roadmap.md) | Phases 0–6 with acceptance criteria |
| 08 | [Architecture decisions](08-architecture-decisions.md) | ADRs, plus answers to the 10 brainstorming questions |
| 09 | [Standalone repo design](09-standalone-repo-design.md) | **Decided 2026-10-31:** CVP moves to its own repo. Covers the repo structure, the generic engine vs. Vikki blocks vs. content split, how a new page is built, publishing to the static repo, and the cut-over plan |
| 10 | [Template engine evaluation](10-template-engine-evaluation.md) | Whether something fits better than Handlebars: compares Nunjucks, LiquidJS, Preact JSX, Svelte, Astro and Eleventy against the architecture's requirements |

## Key facts (verified 2026-10-31 at commit `07f4ab8`)

**The build**
- Rebuilding `front-end/` gives 107 HTML files, all byte-identical to what is committed.
- 85 other committed HTML files are not produced by the build. 72 of them are leftover output from items or pages that were removed, and the rest are hand-written.
- 8 of the 18 page templates contain only CSS. Several are identical apart from the CSS class prefix.

**Environments**
- STG and UAT pages are hand-copied from dev, and they have drifted in both directions.

## Open items needing decisions

These need decisions from outside the front-end team:
- **Publishing (ADR-008, decided: separate repo):** HRE needs to agree on the publish bot (GitHub App) and CODEOWNERS for `*/vikki-cvp/**`. Later, Stage B (direct deploy via OIDC) also needs their agreement. See 09 §4 and §7.
- **Admin access (ADR-007):** whether a GitHub OAuth app is allowed for the admin UI.
- **App contract:** the list of app screens and campaign codes the app accepts, from the mobile team.
- **CDN exposure:** whether `/front-end/*` in the dev bucket can be reached publicly through CloudFront.
- **Orphan links:** whether anything outside this repo still links to the orphaned `promo-0XX.html` pages.
