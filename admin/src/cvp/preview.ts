import { randomBytes } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Payload } from 'payload'

import type { CatalogSlug } from '../contracts/cvp'
import { ensureTemplates, runNode } from './build'
import { isPlainObject, type DataObject } from './fields'
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales'
import {
  FILE_COLLECTIONS,
  fileDocToEntry,
  LIST_COLLECTIONS,
  listDocToEntry,
  type FileDoc,
  type FileKind,
  type ListKind,
} from './mapping'
import { repoPaths } from './paths'
import { isLocalizedFile, LOCALE_TOKEN, writeDataDir, type DataEntry } from './repo-data'
import { readFileDocsWhere, strip } from './store'

/**
 * Preview: one item rendered by the real build, from what the admin holds — or from the edit
 * form's values before they are saved — without touching front-end/data or vikki-cvp/.
 *
 * Each render is a throwaway copy of the item's page folder: its data files (the edited one from
 * the form, the rest as saved), its templates, and front-end/build.js run over just that folder
 * (CVP_ONLY_PAGE). So the HTML is what a publish would write, byte for byte; nothing is
 * re-implemented here. Images and CSS are not copied: the preview route serves anything a render
 * does not have from vikki-cvp/ (`resolvePreviewFile`).
 */

const PREVIEW_ROOT = path.join(os.tmpdir(), 'vikki-cvp-preview')

/** Renders kept per editor session: the one on screen and the one being swapped in. */
const KEEP_RENDERS = 2
/** A session's renders are swept this long after its last one. */
const SESSION_TTL_MS = 6 * 60 * 60 * 1000

export const isPreviewToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value)

export const isRenderId = (value: unknown): value is string =>
  typeof value === 'string' && /^r[a-z0-9]{6,24}$/.test(value)

export const newPreviewToken = () => randomBytes(16).toString('hex')

export type PreviewRequest = {
  collection: CatalogSlug
  id?: string | number | null
  locale: Locale
  /** The edit form's values in `locale` (Payload's live preview message). Left out: as saved. */
  data?: DataObject | null
  /** The editor session's previews; a new one when left out. */
  token?: string | null
}

export type PreviewResult =
  | { ok: true; token: string; url: string }
  | { ok: false; token: string; error: string; reason: PreviewRefusal }

/**
 * Why there is nothing to show: the build refused the data; the file is published per language
 * and not in this one; the file has one language (no {locale} in its name) and this is another;
 * or there is no page and file (or code) to build yet.
 */
export type PreviewRefusal = 'build' | 'language' | 'only-default' | 'missing'

const KIND_OF: Record<CatalogSlug, FileKind | ListKind> = {
  'cvp-pages': 'pages',
  'cvp-documents': 'documents',
  promotions: 'promotions',
  'card-intros': 'cardIntros',
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

/** What one render builds: the page folder's data files, and which built file is the item. */
type Plan = {
  page: string
  entries: DataEntry[]
  target: (outDir: string) => string | null
  /** Set when the item has no copy in the requested language: nothing is built. */
  refusal?: PreviewRefusal
}

/* ── pages and documents ────────────────────────────────────────────────── */

/**
 * Where a data file's HTML lands in `locale`, as front-end/build.js names it: a `{locale}` file in
 * `<page>/<locale>/`, named by its data's `filename` (else the page); `x-{locale}.json` as
 * `<page>/<locale>/x.html`; a single-language `x.json` as `<page>/x.html`.
 */
export function builtFileOf(entry: DataEntry, locale: Locale): string | null {
  if (isLocalizedFile(entry.file)) {
    const data = entry.byLocale[locale]
    if (!data) return null
    const name =
      entry.file === `${LOCALE_TOKEN}.json`
        ? text(data.filename) ?? entry.page
        : entry.file.replace(`-${LOCALE_TOKEN}.json`, '')
    return `${entry.page}/${locale}/${name}.html`
  }
  return `${entry.page}/${entry.file.replace(/\.json$/, '')}.html`
}

async function filePlan(
  payload: Payload,
  kind: FileKind,
  request: PreviewRequest,
): Promise<Plan | string> {
  const { fields, slug } = FILE_COLLECTIONS[kind]
  const id = request.id === undefined || request.id === null ? null : String(request.id)
  const saved = id
    ? (await readFileDocsWhere(payload, kind, { id: { equals: id } }))[0]?.doc ?? null
    : null
  const form = request.data ? strip(request.data) : null

  const page = text(form?.page) ?? saved?.page ?? null
  const file = text(form?.file) ?? saved?.file ?? null
  if (!page || !file) return 'missing'
  const languages = (
    Array.isArray(form?.languages) ? form.languages : (saved?.languages ?? [DEFAULT_LOCALE])
  ).filter(isLocale)

  const edited: FileDoc = {
    page,
    file,
    languages,
    byLocale: { ...saved?.byLocale, ...(form ? { [request.locale]: form } : {}) },
  }
  const entry = fileDocToEntry(edited, fields)
  // Editing a language that is not written would show another language's page and ignore the
  // typing — say so instead
  const refusal: PreviewRefusal | undefined = isLocalizedFile(file)
    ? languages.includes(request.locale)
      ? undefined
      : 'language'
    : request.locale === DEFAULT_LOCALE
      ? undefined
      : 'only-default'

  // The rest of the page folder, as saved: its other templates are built too, and a page without
  // a data file of its own falls back to the folder's index.json (front-end/build.js, loadData)
  const others: DataEntry[] = []
  for (const each of Object.keys(FILE_COLLECTIONS) as FileKind[]) {
    for (const row of await readFileDocsWhere(payload, each, { page: { equals: page } })) {
      if (FILE_COLLECTIONS[each].slug === slug && row.id === id) continue
      if (row.doc.file === file) continue
      others.push(fileDocToEntry(row.doc, FILE_COLLECTIONS[each].fields))
    }
  }

  return {
    page,
    refusal,
    entries: [entry, ...others],
    target: (outDir) => {
      const built = builtFileOf(entry, request.locale) ?? builtFileOf(entry, DEFAULT_LOCALE)
      if (built && fs.existsSync(path.join(outDir, built))) return built
      if (!entry.byLocale[request.locale] && isLocalizedFile(entry.file)) return null
      // A data file no template is named after is read by the folder's other templates: show
      // the first page the folder built
      const folder = path.join(outDir, page)
      const first = fs.existsSync(folder)
        ? fs.readdirSync(folder).filter((name) => name.endsWith('.html')).sort()[0]
        : undefined
      return first ? `${page}/${first}` : null
    },
  }
}

/* ── promotions and card intros ─────────────────────────────────────────── */

async function listPlan(
  payload: Payload,
  kind: ListKind,
  request: PreviewRequest,
): Promise<Plan | string> {
  const { fields, globalField, page, slug } = LIST_COLLECTIONS[kind]
  const id = request.id === undefined || request.id === null ? null : String(request.id)
  const { docs } = await payload.find({
    collection: slug,
    depth: 0,
    overrideAccess: true,
    pagination: false,
    sort: ['sortOrder', 'createdAt'],
  })
  const rows = (docs as unknown as DataObject[]).map((doc) => ({ id: String(doc.id), values: doc }))
  const form = request.data ?? null
  if (form) {
    const at = rows.findIndex((row) => row.id === id)
    if (at >= 0) rows[at] = { id: rows[at]!.id, values: form }
    else rows.push({ id: id ?? 'new', values: form })
    // The form may have moved it: same order as the publish (sortOrder, ties as they were)
    const order = (values: DataObject) =>
      typeof values.sortOrder === 'number' ? values.sortOrder : Number.POSITIVE_INFINITY
    rows.sort((a, b) => order(a.values) - order(b.values))
  }
  const item = rows.find((row) => row.id === (id ?? 'new'))
  const code = item ? text(kind === 'promotions' ? item.values.promoId : item.values.cardId) : null
  if (!code) return 'missing'

  const lists = (await payload.findGlobal({ slug: 'cvp-lists', overrideAccess: true })) as unknown as DataObject
  const list = isPlainObject(lists[globalField]) ? (lists[globalField] as DataObject) : {}
  const entry = listDocToEntry(page, { list, items: rows.map((row) => strip(row.values)) }, fields)

  return {
    page,
    entries: [entry],
    target: (outDir) => {
      const built = `${page}/${code}.html`
      return fs.existsSync(path.join(outDir, built)) ? built : null
    },
  }
}

/* ── rendering ──────────────────────────────────────────────────────────── */

/** The lines of a failed build worth showing: its errors, not its list of partials. */
export function buildError(output: string): string {
  const lines = output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith('✓') && !line.startsWith('⚙️'))
  const at = lines.findIndex((line) => /error/i.test(line))
  return (at >= 0 ? lines.slice(at, at + 6) : lines.slice(-6)).join('\n').slice(0, 1200)
}

function forget(dir: string) {
  fs.rmSync(dir, { force: true, recursive: true })
}

/** Old renders of this session beyond the last few, and whole sessions nobody used for hours. */
function tidy(token: string) {
  const session = path.join(PREVIEW_ROOT, token)
  const renders = fs.existsSync(session) ? fs.readdirSync(session).filter(isRenderId).sort() : []
  renders.slice(0, -KEEP_RENDERS).forEach((render) => forget(path.join(session, render)))

  const now = Date.now()
  for (const other of fs.existsSync(PREVIEW_ROOT) ? fs.readdirSync(PREVIEW_ROOT) : []) {
    const dir = path.join(PREVIEW_ROOT, other)
    try {
      if (now - fs.statSync(dir).mtimeMs > SESSION_TTL_MS) forget(dir)
    } catch {
      // Swept by a concurrent render
    }
  }
}

/** Builds one item into a fresh render folder and says where its page is. */
export async function renderPreview(payload: Payload, request: PreviewRequest): Promise<PreviewResult> {
  const token = isPreviewToken(request.token) ? request.token : newPreviewToken()
  const kind = KIND_OF[request.collection]
  const plan =
    kind === 'promotions' || kind === 'cardIntros'
      ? await listPlan(payload, kind, request)
      : await filePlan(payload, kind, request)
  if (typeof plan === 'string') return { ok: false, token, error: '', reason: 'missing' }
  if (plan.refusal) return { ok: false, token, error: '', reason: plan.refusal }

  const paths = repoPaths()
  // Time first, so a session's renders sort oldest to newest
  const render = `r${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
  const base = path.join(PREVIEW_ROOT, token, render)
  const dataDir = path.join(base, 'data')
  const pagesDir = path.join(base, 'pages')
  const outDir = path.join(base, 'out')

  writeDataDir(dataDir, plan.entries)
  const templates = path.join(paths.pages, plan.page)
  if (fs.existsSync(templates)) fs.cpSync(templates, path.join(pagesDir, plan.page), { recursive: true })
  else fs.mkdirSync(path.join(pagesDir, plan.page), { recursive: true })
  // A page made in the admin has no template yet; publishing writes an empty one, so does this
  ensureTemplates({ ...paths, pages: pagesDir }, plan.entries)

  const run = await runNode(paths.build, [], {
    cwd: paths.root,
    env: {
      CVP_DATA_DIR: dataDir,
      CVP_ONLY_PAGE: plan.page,
      CVP_OUT_DIR: outDir,
      CVP_PAGES_DIR: pagesDir,
    },
  })
  if (!run.ok) {
    forget(base)
    return { ok: false, token, error: buildError(run.output), reason: 'build' }
  }

  const target = plan.target(outDir)
  if (!target) {
    forget(base)
    return { ok: false, token, error: '', reason: 'language' }
  }

  tidy(token)
  // ?lang as the app opens the page: a language copy stays put, the rest pass it to their links
  return { ok: true, token, url: `/cvp-preview/${token}/${render}/${target}?lang=${request.locale}` }
}

/* ── serving ────────────────────────────────────────────────────────────── */

/** `child` resolved under `parent`, or null when it would leave it. */
function within(parent: string, child: string): string | null {
  const resolved = path.resolve(parent, child)
  return resolved === parent || resolved.startsWith(`${parent}${path.sep}`) ? resolved : null
}

const existingFile = (file: string | null) => {
  if (!file) return null
  try {
    return fs.statSync(file).isFile() ? file : null
  } catch {
    return null
  }
}

/**
 * The file behind a preview URL, `/cvp-preview/<token>/<render>/<path>`: the render's own output,
 * else the published file at `vikki-cvp/<path>` (images, CSS, the pages a link opens). Null for
 * anything outside those two folders.
 */
export function resolvePreviewFile(parts: string[]): { file: string; rendered: boolean } | null {
  const [token, render, ...rest] = parts
  if (!isPreviewToken(token) || !isRenderId(render) || rest.length === 0) return null
  const relative = rest.join('/')
  const out = path.join(PREVIEW_ROOT, token, render, 'out')
  const rendered = existingFile(within(out, relative))
  if (rendered) return { file: rendered, rendered: true }
  const published = existingFile(within(repoPaths().output, relative))
  return published ? { file: published, rendered: false } : null
}

/**
 * The file behind `/vikki-cvp/<path>` — the CDN's own paths, which popup links use — seen from a
 * preview: the render the request came from first (its page folder was built whole, so a popup
 * of the same page shows the admin's content), then the published file.
 */
export function resolvePublishedFile(
  parts: string[],
  referer: string | null,
): { file: string; rendered: boolean } | null {
  if (parts.length === 0) return null
  const from = referer ? /\/cvp-preview\/([a-f0-9]{32})\/(r[a-z0-9]{6,24})\//.exec(referer) : null
  if (from) {
    const found = resolvePreviewFile([from[1]!, from[2]!, ...parts])
    if (found) return found
  }
  const published = existingFile(within(repoPaths().output, parts.join('/')))
  return published ? { file: published, rendered: false } : null
}
