# CVP admin

Payload CMS 3 (Next.js 16, PostgreSQL) for editing the CVP pages without a code change: landing-page blocks, popup documents (T&C, fees, rules), promotions and card intros. It does not render pages. **Xuất & build** on the dashboard writes what the admin holds back to `front-end/data` and runs the existing Handlebars build, so the CDN still serves static HTML and the app, hello-vietnam and `?lang` work as before.

```
Admin (Payload, Postgres) ──Xuất & build──▶ front-end/data/**.json ──front-end/build.js──▶ vikki-cvp/**.html ──commit / publish──▶ CDN
         ▲                                          │
         └──────────── npm run cvp:import ──────────┘   (first load, or start over from the repo)
```

## Local setup

```bash
cd admin
cp .env.example .env          # replace every change-me (openssl rand -hex 32)
docker compose up -d          # Postgres on 127.0.0.1:54391
npm install
npm run cvp:import            # load front-end/data into the database (replaces what is there)
npm run dev                   # http://localhost:3200/admin, the first visit creates the first user
```

The schema is pushed to the database automatically in development. Before a deployment, create migrations (`npm run payload migrate:create`) and run with `push: false`.

## What is where

| Admin | Data file | Rendered by |
|---|---|---|
| **CVP › Trang CVP** (`cvp-pages`) | `front-end/data/<page>/index.json`, `<page>.json`, `{locale}.json` | `layouts/template.hbs`, one partial per block |
| **CVP › Nội dung popup** (`cvp-documents`) | `tc.json`, `fee.json`, `tc-{locale}.json`… (layouts `static`, `fee`, `legal-document`) | `layouts/static.hbs`, `fee.hbs`, `legal-document.hbs` |
| **Ưu đãi & thẻ › Ưu đãi** (`promotions`) | the items of `promotion/list.json` | `promotion/list.html`, `promotion/<id>.html` |
| **Ưu đãi & thẻ › Giới thiệu thẻ** (`card-intros`) | the items of `card-intro/list.json` | `card-intro/<id>.html` |
| **CVP › Thư viện media** (`cvp-media`) | none: files, copied to `vikki-cvp/<page>/<folder>/` on publish | the pages that name them (`./assets/<file>`) |
| **Ưu đãi & thẻ › Cài đặt danh sách** (`cvp-lists`) | the rest of both list files | |

- Each page or document is **one data file**: `page` + `file` say where it goes, `{locale}` in the name makes one file per language (`vi`, `en`, `ko`; see `runtime/README.md` › `lang`). **Ngôn ngữ xuất bản** says which languages are written; the admin's language switch edits each one, with no fallback between them.
- Landing-page blocks (`src/cvp/blocks.ts`) have a form field for every key the pages use. A page's own data that no block covers (the old pages' `qa` and `slider`, Vikki Safe+'s `plans`, `steps`, `details`, the banner's `bannerVideoHlsSrc`) is in the **Nội dung riêng** tab.
- A document's sections, articles, lists and tables nest without a fixed depth, so its body is kept as JSON text, edited as a form (**Nội dung**; see *Structured editor* below).
- A new page (a `page` folder that does not exist yet) gets an empty template in `front-end/pages/<page>/` on publish; its layout renders the blocks. Its images can be uploaded from its image fields or the media library.

## Editing a page's blocks

The fields an editor would otherwise type a path, a file name or a code into are pickers. Each still stores the string the data file has always had, so the JSON, the build and both round trips are unchanged (`npm run cvp:roundtrip` reports every file the same).

| Field | Picker | Stores | Files |
|---|---|---|---|
| Images (`src`, `iconSrc`, `logo`, `srcTitle`…) | the page's images: published in `vikki-cvp/<page>/assets/` and in the media library; **Tải ảnh mới lên** uploads one for this page | `./assets/a.png`, or `../assets/a.png` from a `{locale}` file's language copy | `admin/components/cvp/fields/ImageField.tsx`, `cvp/assetPaths.ts` |
| **Mở popup** (`popup`) | this page's Q&A (`qa`), popup documents, pages, promotion lists, promotions, card intros | `/vikki-cvp/<page>/tc.html` (a `{locale}` file: the `?lang` address or one language's copy) | `fields/LinkField.tsx`, `cvp/links.ts` |
| **Mở khi bấm** of a slide (`popupLink`) | promotions first, then the same places; a web address can be typed | the same, or `https://…` | |
| **Cuộn tới** (`scroll`) | the blocks of this form that have a **Mã phần tử** | `#intro` | |
| **Trang (thư mục)**, **File dữ liệu** at the top of a page or popup | the page folders the admin knows; the CVP's file names (`index.json`, `{locale}.json`, `tc.json`…) | `vikki-go-plus-cvp`, `index.json` | `fields/PageField.tsx`, `fields/FileField.tsx` |
| Images of a promotion or card intro (`thumbnail`, `mainImg`) | the images of `vikki-cvp/promotion/` or `card-intro/`, and uploads for it | `./assets/promo-114.png` | `ImageField` given a fixed folder |
| **Danh mục**, **Nhóm** of a promotion, **Nhóm thẻ** | the codes in use; a category also from the pages' `list.html?category=` links; a new one can be typed (written `UPPER_CASE`) | `VIKKIGO_PLUS,VIKKI_ONE`, `HDB` | `fields/ChoiceField.tsx`, `cvp/codes.ts` |

- Anything not offered can still be typed (a web address, a page the admin does not hold); an image's path stays editable under **Đường dẫn trong file dữ liệu**.
- The places come from `GET /api/cvp/link-targets` (titles in the content language, two places titled alike told apart by their address), a page's images from `GET /api/cvp/assets?page=`.
- Text the pages print as HTML (Q&A answers, a promotion's or card intro's **Nội dung**) has a toolbar editor: bold, italic, underline, lists, links (`fields/HtmlField.tsx`). It stores the same HTML, and only rewrites it when someone types; **HTML** shows the markup. A value with markup that could run in the admin (a script, an `on…` attribute: `cvp/html.ts`) opens as HTML only. Pasting keeps the text, not the formatting.
- **Thêm khối** shows a sketch of each block (`public/blocks/<slug>.svg`), and the add buttons of a block's rows are named (**Thêm Mục menu**, **Thêm Slide**…).
- Presentation fields (CSS classes, a slider's raw JSON) are in a collapsed **Nâng cao** section of each block. A field's place in its block is its key's place in the JSON written back (`cvp/fields.ts`), so the sections wrap fields where they were and never move one.

## Structured editor

A popup's **Nội dung** and a page's **Nội dung riêng** (every `extraJsonField` of `cvp/fields.ts`) are JSON objects kept as text, edited as a form (`admin/components/cvp/structured/JsonFormField.tsx`, rules in `cvp/structured.ts`); **JSON** shows the text itself.

- Sections and articles fold to one line (their title); a row moves up or down, is duplicated or removed (asking first when it has content).
- A document's content blocks are added by kind (**Đoạn văn**, **Tiêu đề phụ**, **Danh sách**, **Bảng**). Text the pages print as HTML has the rich-text toolbar (shown while the text has focus), a list its numbering (`1.`, `a.`, `i.`, `•`, none, or the page's own class) and nested lists, a table is a grid: click a cell to merge it (**Gộp cột**, **Gộp hàng**), add or remove rows and cells; Enter in a cell is a `<br>`.
- A value's editor comes from its key and what it holds (`textKind`): an image key (`src`, `img`, `posterSrc`…) gets the image picker, `popup` / `popupLink` the link picker (the popups, pages, promotions the admin knows), HTML gets the toolbar.
- **Thêm …** adds what a document's layout reads and the object lacks yet (a note, a footer, an article's blocks, a row's nested list); a new popup starts from its layout's template (**Bắt đầu từ mẫu**). New sections and articles get ids no other part has (`phan-2`, `dieu-8`): the layouts open and close parts by id.
- Values change where they are, so every key keeps its place and keys the form has no editor for are kept: the JSON written back differs only by what was typed.

## Media library

**CVP › Thư viện media** (`cvp-media`, `collections/CvpMedia.ts`, `cvp/media.ts`) keeps images and videos for the pages: each belongs to a page folder and a folder in it (`assets`, `assets/vi`…).

- **Where files are**: stored under their page folder, `<page>/<folder>/<file>` (Payload's upload `prefix`; a name is unique within its folder, so `qa.svg` of two pages are two files), in `admin/media/` (gitignored) or in S3 (below), until **Xuất & build** copies each into `vikki-cvp/<page>/<folder>/`, only when it is not there yet or differs. Like the data files, nothing reaches the repo before a publish. A file's page and folder are set when it is uploaded.
- **Loading the published images** (to try the library on real pictures): **Nạp ảnh từ assets** above the library's list, or `npm run cvp:media:import` (`-- dry-run`, `-- videos`, `-- <page>`), puts every image of `vikki-cvp/<page>/assets/` into the library with its page, folder and name; what the library already has is left alone, so it can run again. Videos and PDFs only when asked. The copies are byte-identical, so a publish copies nothing back.
- **No overwrites**: an upload named like an image the page has published (with other content) is renamed (`title-1.png`) before it is stored, so a publish never replaces a published file by accident.
- **Preview**: the preview and the image pickers serve a file not published yet from the library (`/vikki-cvp/…` and `/cvp-preview/…` fall back to it).
- **Dashboard**: the files a publish would copy are listed under **Media chờ chép vào vikki-cvp/**; a run reports how many it copied.

### S3

`cvp/storage.ts` stores the library as galaxy-g-digital-center stores its media (`src/services/storage.ts` there): `@payloadcms/storage-s3`, the same variables (`AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_S3_ENDPOINT_URL`, `AWS_S3_FORCE_PATH_STYLE`, `AWS_S3_ACL`, `AWS_S3_MEDIA_OWNER`, `AWS_S3_SIGNED_URL_TTL`, `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`; see `.env.example`), the same credential order (the pod's IAM role, IRSA or Pod Identity, with the key pair only as a fallback when STS rejects the role; then a key pair; then the SDK's chain) and the same key layout: `media/<owner>/cvp/<page>/<folder>/<file>`, `cvp` being this admin's feature segment beside Digital Center's `library`, `page`…

- `AWS_S3_BUCKET` empty: the disk. Set (with a region): S3; a half-made configuration stops the admin at start. The start-up log says which (`[cvp-media] …`), and so does the bar above the library's list.
- Downloads are presigned redirects, except SVG, which is streamed with its headers (as in Digital Center).
- The stored `prefix` is the same in both modes, so moving a deployment from the disk to S3 changes no row; copy `admin/media/` to `s3://<bucket>/media/<owner>/cvp/` with it.
- Digital Center's `.env.example` asks for its media bucket not to be shared with other portals; whether the CVP admin uses that bucket under `cvp/` or a bucket of its own is a deployment decision.

## Admin UI

The shell and the CVP screens follow galaxy-g-admin's frontend standards (its `docs/frontend-development-standards.md` and the `admin-ui-implement` skill), so the two admins look and are built the same way.

| Screen | Archetype | Files |
|---|---|---|
| **Xuất bản** (`/admin`, the dashboard) | detail | `src/admin/views/Dashboard.tsx` → `src/admin/components/cvp/DashboardClient.tsx` |
| **Trang CVP**, **Nội dung popup**, **Ưu đãi**, **Giới thiệu thẻ** (each collection's list) | list | `src/admin/views/CatalogList.tsx` → `src/admin/components/cvp/CatalogListClient.tsx`, columns in `catalogColumns.tsx` |
| Editing a page, document, promotion or card intro; **Cài đặt danh sách**; **Người dùng** | Payload's own form and list, restyled | `src/app/(payload)/payload-collections.scss` |

- **Sidebar**: `src/access/menuCatalog.ts` is the only place a menu and its path live; `NavSections` draws one section per group. A new menu is a catalog row plus its `nav.*` keys. The collections set `admin.group: false`, so Payload's own nav links stay out.
- **Design layer**: `src/admin/design/design.tsx` and `design.module.css` are galaxy-g-admin's, copied unchanged except for one import. galaxy-g-admin takes `FormField` and `Checkbox` from `@galaxyfinx/galaxy-g-core-ui-web`, a private GitHub Packages package. This repo draws them in `design/controls.tsx` with the same props, along with `Spinner` and `Toast`. Colours are `--d-<role>-<slot>` tokens, and a button's variant is the action's risk: "Xuất & build" is `primary`, "Kiểm tra lại" `neutral`.
- **Also copied from galaxy-g-admin**: `ListDataTable`, `DataState`, `Toasts`, `filters.tsx`, the nav, the header toggles and `shell.scss`, all trimmed of tenants, permissions, Keycloak and core-ui.
  - `ListDataTable` has one fix: its `<col>` widths ignored the columns' declared widths. galaxy-g-admin has the same bug.
  - `shell.scss` has one addition: it places Payload's content-language picker, which galaxy-g-admin (no localization) never had to.
- **Copy**: every string on these screens is in `src/admin/i18n/dictionary.ts`, in `vi` and `en`. A key missing from either language is a type error. The header globe switches the admin's language, and "Ngôn ngữ" beside it switches the content language (vi / en / ko).
- **Font**: Be Vietnam Pro, loaded from Google Fonts by the `<link>` in `src/app/(payload)/layout.tsx`. No font files are in the repo, so the admin needs to reach fonts.googleapis.com, otherwise it falls back to the system font.
- **Endpoints from the browser**: always through `api.cvp.*` (`src/contracts/api.ts`). Paths and methods live once in `src/contracts/cvp.ts`, and `src/endpoints/cvp.ts` registers them from there.
- **List state**: the URL holds it (`?q=`, `lang`, `layout`, `timing`, `hot`, `sort`, `page`, `limit`), parsed in `src/cvp/catalogQuery.ts` and queried in `src/cvp/catalog.ts` through the Local API as the signed-in user. A row opens Payload's edit form, keeping `?locale=`.

```bash
npm run verify   # typecheck + vitest: list queries, menu catalog, dictionary, and source guards
                 # (no core-ui import, no "use client" in views, no fetch() in components,
                 #  no hex or core-ui colour in the CVP's own stylesheets)
```

To take a newer galaxy-g-admin design layer:
1. Copy `design.tsx` and `design.module.css` again.
2. Point the core-ui import at `./controls`.
3. Run `npm run verify`.

## Preview

Every edit form of the four CVP collections shows the item's page in a panel beside the form. It uses Payload's Live Preview, which opens by default on phone sizes. The **Xem trước** button opens the item as saved in a new tab.

- **What the panel shows**: the page as the form stands, saved or not, in the content language picked in the header. After a pause in typing, the form's values go to `POST /api/cvp/preview`, are turned into the data file as a publish would write it, and are built by the real `front-end/build.js`. The panel shows exactly the HTML that would reach the CDN.
- **Its own window**: the panel's toolbar can pop it out into a separate window, which keeps following the form.
- **What a build covers**: only the item's page folder (`CVP_ONLY_PAGE`), built from a throwaway copy (`CVP_DATA_DIR`, `CVP_PAGES_DIR`, `CVP_OUT_DIR`) under the system temp folder. The edited file comes from the form, the rest of the folder as saved. front-end/data and vikki-cvp/ are never written.
- **Serving**: renders are served at `/cvp-preview/<session>/<render>/…`. Anything a render lacks, such as images or video, comes from the published `vikki-cvp/`. `/vikki-cvp/…` links (popups) look in the render they were opened from first. Every preview route needs a signed-in session.
- **Language**: a file published per language (`{locale}`) previews only in the languages ticked in **Ngôn ngữ xuất bản**. A single-language file previews only in Tiếng Việt. Otherwise the panel says why instead of showing another language's page.
- **Limits**: actions sent to the app (`OPEN_PROMO_DETAIL`) do nothing outside the app. A popup of another page shows that page as published.

| Piece | File |
|---|---|
| Building one item | `src/cvp/preview.ts` |
| The page in the panel (receives the form, swaps renders without flashing) | `src/cvp/previewShell.ts` |
| Per-collection config (panel, phone sizes, "Xem trước") | `src/cvp/previewConfig.ts` |
| Routes | `src/app/(cvp-preview)/` |

## How the mapping stays lossless

`src/cvp/fields.ts` converts a data file to field values and back, driven by the field configs: `custom.cvp.dataKey` names the JSON key when it differs (`htmlId` ↔ `id`, which Payload keeps for its rows), `extra` collects the keys no field takes (stored as JSON text, because Postgres jsonb would reorder keys and `{{json}}` prints them), and a key with nowhere to go is an import error, never silently dropped.

Two checks prove it on the whole of `front-end/data`:

```bash
npm run cvp:roundtrip      # no database: data → fields → data, then build both
npm run cvp:roundtrip:db   # REPLACES the CVP collections: import → Postgres → export, then build both
```

Both must report every JSON file the same and every built HTML file byte-identical (53 files, 116 pages today). Run them after changing a block, a collection or the data shapes.

## Publishing

**Xuất & build** (`POST /api/cvp/publish`, signed-in users only):

1. writes the data files whose JSON changed (whatever the key order), nothing else;
2. copies the media library's new or changed files into `vikki-cvp/<page>/<folder>/` (before the checks, which may look for them);
3. adds empty templates for new pages;
4. runs `core/validate.js`, then `front-end/build.js` into `vikki-cvp/`, then `core/manifest.js`.

The result is in the repo's working tree: commit it, and the existing workflow takes it to the CDN. `GET /api/cvp/status` lists the files a publish would write and the media it would copy. Data files no entry writes are reported as stale, never deleted.

## Not done yet

- Field labels in Payload's edit forms (blocks, identity fields) are Vietnamese only; the screens above, the sidebar and the collection names follow the language switch.
- A list of the pages using a media file before it is deleted; a picker for a media file's folder (typed today: `assets`, `assets/vi`).
- Pushing to the CDN from the admin (a commit or PR from a bot, or S3), instead of a commit by hand.
- The HTML and CSS of a page's own template (`front-end/pages/<page>/<template>.hbs`) are not in the admin: a page made in the admin gets an empty one (the shared layout and CSS only), and five older pages (`vikki-go-cvp`, `vikki-pro-cvp`, `vikki-go-plus-cvp`, `card-co-badged-cvp`, `vikki-foreign-exchange-cvp`) lay out part of their content in it rather than in blocks.
- Production hardening as in vikkibank-hello-vietnam: SSO or seeded accounts, sign-in rate limits, security headers, migrations, Docker image.
