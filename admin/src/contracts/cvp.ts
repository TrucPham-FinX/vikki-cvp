/**
 * The CVP admin's own endpoints and the shapes they and the list screens exchange.
 *
 * One contract per endpoint, as in galaxy-g-admin: the path and method live here, and both the
 * Payload endpoint (`endpoints/cvp.ts`) and the browser client (`contracts/api.ts`) read them, so
 * neither restates a path. Types only — nothing here imports Payload or Node.
 */

export type HttpMethod = "get" | "post";

export type Operation = { method: HttpMethod; path: string };

/** Paths are Payload endpoint paths: the browser adds Payload's `/api` prefix. */
export const CVP_OPERATIONS = {
  /** The data files a publish would write; nothing is written. */
  status: { method: "get", path: "/cvp/status" },
  /** Export, validate, build, manifest. 200 when it all passed, 422 with the report when not. */
  publish: { method: "post", path: "/cvp/publish" },
  /** One item built from the edit form's values, into a throwaway folder (cvp/preview.ts). */
  preview: { method: "post", path: "/cvp/preview" },
  /** What a link field can point at: popups, pages, promotions, card intros (cvp/links.ts). */
  linkTargets: { method: "get", path: "/cvp/link-targets" },
  /** A page's images: published in vikki-cvp/<page>/ and in the media library (cvp/media.ts). */
  assets: { method: "get", path: "/cvp/assets" },
  /** The images published in vikki-cvp/<page>/assets/ put into the media library (cvp/media.ts). */
  mediaImport: { method: "post", path: "/cvp/media/import" },
} as const satisfies Record<string, Operation>;

/* ── publishing ─────────────────────────────────────────────────────────── */

export type PublishStatus = {
  /** Data files whose JSON a publish would change (or create), `<page>/<file>`. */
  written: string[];
  /** Data files no item writes any more; reported, never deleted. */
  stale: string[];
  /** Media library files a publish would copy into vikki-cvp/, `<page>/<folder>/<file>`. */
  assets: string[];
};

export type RunResult = { ok: boolean; code: number | null; output: string };

export type PublishReport = {
  data: { written: string[]; unchanged: string[]; stale: string[]; removed: string[] };
  /** Media library files copied into vikki-cvp/ (`missing`: in the library, its file gone). */
  assets: { written: string[]; unchanged: string[]; missing: string[] };
  templatesCreated: string[];
  validate: RunResult;
  build: RunResult | null;
  manifest: RunResult | null;
  ok: boolean;
};

/* ── list screens ───────────────────────────────────────────────────────── */

/** The collections the CVP list screens draw (`views.list` of each). */
export const CATALOG_SLUGS = ["cvp-pages", "cvp-documents", "promotions", "card-intros"] as const;
export type CatalogSlug = (typeof CATALOG_SLUGS)[number];

export const isCatalogSlug = (value: unknown): value is CatalogSlug =>
  CATALOG_SLUGS.includes(value as CatalogSlug);

export type PromotionTiming = "running" | "upcoming" | "ended" | "undated";

export type PageRow = {
  kind: "cvp-pages";
  id: string;
  key: string;
  page: string;
  file: string;
  title: string | null;
  layout: string | null;
  languages: string[];
  blocks: number;
  updatedAt: string;
};

export type DocumentRow = {
  kind: "cvp-documents";
  id: string;
  key: string;
  page: string;
  file: string;
  title: string | null;
  layout: string | null;
  languages: string[];
  updatedAt: string;
};

export type PromotionRow = {
  kind: "promotions";
  id: string;
  code: string;
  name: string;
  category: string | null;
  hot: boolean;
  startDate: string | null;
  endDate: string | null;
  timing: PromotionTiming;
  sortOrder: number | null;
  updatedAt: string;
};

export type CardIntroRow = {
  kind: "card-intros";
  id: string;
  code: string;
  name: string;
  group: string | null;
  sortOrder: number | null;
  updatedAt: string;
};

export type CatalogRow = PageRow | DocumentRow | PromotionRow | CardIntroRow;

/** What the URL says a list shows. Every list screen reads and writes these params. */
export type CatalogQuery = {
  q: string;
  page: number;
  limit: number;
  /** A sortable column's field, `-` in front for descending. */
  sort: string;
  /** `lang` (pages, documents), `layout` (pages, documents), `timing` and `hot` (promotions). */
  filters: Record<string, string>;
};

export type CatalogResult = {
  rows: CatalogRow[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

/* ── pickers in the edit forms ──────────────────────────────────────────── */

/**
 * One place a link can lead: `value` is what the data file keeps, as it keeps it today. `lang`:
 * a copy of a page built per language (`vi`, `en`, `ko`), or `auto` for the one following `?lang`.
 */
export type LinkOption = { value: string; label: string; lang?: string };

/** The kinds of place, in the order the pickers list them. */
export type LinkGroupKey = "documents" | "pages" | "promotions" | "promotionLists" | "cardIntros";

export type LinkGroup = { key: LinkGroupKey; options: LinkOption[] };

/** The code fields of promotions and card intros, picked from the codes already in use. */
export const CHOICE_KEYS = ["promotionCate", "promotionGroup", "cardGroup"] as const;
export type ChoiceKey = (typeof CHOICE_KEYS)[number];

export type LinkTargets = {
  /** Every page folder the admin knows (its pages, documents, vikki-cvp/), for the media library. */
  pages: string[];
  groups: LinkGroup[];
  /** The codes each choice field offers, sorted: those the items use and the links name. */
  choices: Record<ChoiceKey, string[]>;
};

/** An image or video a page can use, relative to the page's folder (`assets/title.png`). */
export type AssetItem = {
  path: string;
  /** Where the browser can show it: the published file, or the library's own copy. */
  url: string;
  /** published: in vikki-cvp/ already · media: uploaded, copied there on the next publish. */
  source: "published" | "media";
};

export type PageAssets = { page: string; items: AssetItem[] };

/** What the media library's upload sends besides the file (collections/CvpMedia.ts). */
export type MediaUpload = { page: string; folder: string };

/** The published images put into the library, `<page>/<folder>/<file>` (cvp/media.ts). */
export type MediaImportReport = {
  added: string[];
  /** Already in the library: left alone. */
  existing: number;
  /** Not taken: a video or PDF (unless asked), or a folder the library cannot name. */
  skipped: string[];
  /** `<file>: <reason>` */
  failed: string[];
};

/** Where the library keeps its files (cvp/storage.ts): the disk, or S3. */
export type MediaStore = { mode: "disk" | "s3"; where: string };

/* ── preview ────────────────────────────────────────────────────────────── */

export type PreviewBody = {
  collection: CatalogSlug;
  id?: string | number | null;
  /** The content language the form is in (Payload's `locale`). */
  locale: string;
  /** The form's values in that language; left out, the item as saved. */
  data?: Record<string, unknown> | null;
  /** The editor session's previews, from the previous response. */
  token?: string | null;
};

export type PreviewResponse =
  | { ok: true; token: string; url: string }
  | {
      ok: false;
      token: string;
      /** The build's own error lines when `reason` is `build`. */
      error: string;
      /** build: the templates refused the data · language: not published in this language ·
       *  only-default: a single-language file, previewed in another language ·
       *  missing: no page/file (or code) to build yet */
      reason: "build" | "language" | "only-default" | "missing";
    };
