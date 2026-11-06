import fs from 'fs'
import path from 'path'
import type { CollectionBeforeOperationHook, Payload } from 'payload'

import type { AssetItem, MediaImportReport } from '../contracts/cvp'
import { ASSET_FOLDER, isAssetFile, isVideoFile, PAGE_NAME, pathInPage } from './assetPaths'
import { repoPaths } from './paths'
import { MEDIA_SLUG, readStoredFile } from './storage'

export { MEDIA_DIR, MEDIA_SLUG } from './storage'

/**
 * The media library (collections/CvpMedia.ts): images and videos uploaded for a page, kept by
 * cvp/storage.ts (admin/media/ on disk, or S3) under `<page>/<folder>/`, until "Xuất & build" copies
 * each into vikki-cvp/<page>/<folder>/, beside the page's published assets. Like the data files,
 * nothing reaches the repo before a publish; the preview shows a file uploaded since from the
 * library itself.
 */

type MediaDoc = { page?: unknown; folder?: unknown; filename?: unknown; prefix?: unknown }

/** Where a page's file is stored: its place in the page's folder, `<page>/<folder>` */
export const mediaPrefix = (page: string, folder: string) => `${page}/${folder}`

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)

/** `child` resolved under `parent`, or null when it would leave it */
function within(parent: string, child: string): string | null {
  const resolved = path.resolve(parent, child)
  return resolved === parent || resolved.startsWith(`${parent}${path.sep}`) ? resolved : null
}

const isFile = (file: string | null): file is string => {
  if (!file) return false
  try {
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

const sameBytes = (a: string, b: Buffer) => fs.readFileSync(a).equals(b)

/** Where a library file goes in vikki-cvp/: `<page>/<folder>/<filename>`, or null when incomplete */
export function mediaTarget(doc: MediaDoc): string | null {
  const page = text(doc.page)
  const filename = text(doc.filename)
  const folder = text(doc.folder) ?? 'assets'
  if (!page || !filename || !PAGE_NAME.test(page) || !ASSET_FOLDER.test(folder)) return null
  return `${page}/${pathInPage(folder, filename)}`
}

/** The images and videos published in a page's assets/ (and below), relative to the page's folder */
export function publishedAssets(page: string, limit = 2000): string[] {
  if (!PAGE_NAME.test(page)) return []
  const pageDir = path.join(repoPaths().output, page)
  const found: string[] = []
  const walk = (dir: string, depth: number) => {
    if (depth > 4 || found.length >= limit) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full, depth + 1)
      else if (entry.isFile() && isAssetFile(entry.name)) {
        found.push(path.relative(pageDir, full).split(path.sep).join('/'))
      }
      if (found.length >= limit) return
    }
  }
  walk(path.join(pageDir, 'assets'), 0)
  return found
}

/** A page's images for the picker: the library's first (newest first), then the published ones */
export async function pageAssets(payload: Payload, page: string): Promise<AssetItem[]> {
  if (!PAGE_NAME.test(page)) return []
  const { docs } = await payload.find({
    collection: MEDIA_SLUG,
    where: { page: { equals: page } },
    sort: '-updatedAt',
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const items: AssetItem[] = []
  const seen = new Set<string>()
  const published = publishedAssets(page)
  const onCdn = new Set(published)
  for (const doc of docs as MediaDoc[]) {
    const target = mediaTarget(doc)
    if (!target) continue
    const inPage = target.slice(page.length + 1)
    seen.add(inPage)
    // A library file at a published file's place is that file (an upload never takes another's
    // place: freeAssetName), so it is not new
    items.push({ path: inPage, url: `/vikki-cvp/${target}`, source: onCdn.has(inPage) ? 'published' : 'media' })
  }
  for (const inPage of published) {
    if (!seen.has(inPage)) items.push({ path: inPage, url: `/vikki-cvp/${page}/${inPage}`, source: 'published' })
  }
  return items
}

/**
 * The library file published at `relative` (`<page>/<folder>/<filename>` in vikki-cvp/), for the
 * preview of a page using an image uploaded since the last publish: Payload's own address for it
 * (`/api/cvp-media/file/<name>?prefix=…`, which checks access and serves it from the disk or S3).
 * Null when there is none.
 */
export async function mediaFileAt(payload: Payload, relative: string): Promise<string | null> {
  const parts = relative.split('/').filter(Boolean)
  if (parts.length < 3) return null
  const [page, ...rest] = parts
  const filename = rest.pop()!
  const folder = rest.join('/')
  if (!PAGE_NAME.test(page!) || !ASSET_FOLDER.test(folder)) return null
  const { docs } = await payload.find({
    collection: MEDIA_SLUG,
    where: {
      and: [{ page: { equals: page } }, { folder: { equals: folder } }, { filename: { equals: filename } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = docs[0] as MediaDoc | undefined
  const name = text(doc?.filename)
  if (!name) return null
  const prefix = text(doc?.prefix)
  return `/api/${MEDIA_SLUG}/file/${encodeURIComponent(name)}${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''}`
}

export type MediaSyncReport = { written: string[]; unchanged: string[]; missing: string[] }

/**
 * Copies the library into vikki-cvp/: each file that is not there yet, or differs (its upload was
 * replaced). `dryRun` only says which. A library entry whose file is gone is reported, not fatal.
 */
export async function syncMedia(
  payload: Payload,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<MediaSyncReport> {
  const output = repoPaths().output
  const report: MediaSyncReport = { written: [], unchanged: [], missing: [] }
  const { docs } = await payload.find({
    collection: MEDIA_SLUG,
    sort: 'createdAt',
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of docs as MediaDoc[]) {
    const target = mediaTarget(doc)
    if (!target) continue
    const dest = within(output, target)
    if (!dest) continue
    const bytes = await readStoredFile(doc)
    if (!bytes) {
      report.missing.push(target)
      continue
    }
    if (isFile(dest) && sameBytes(dest, bytes)) {
      report.unchanged.push(target)
      continue
    }
    report.written.push(target)
    if (!dryRun) {
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, bytes)
    }
  }
  return report
}

/**
 * A name for an upload that takes no published file's place: an image of the same name in the
 * page's folder is kept, and the upload becomes `name-1.png` (`-2`, …) — unless it is that very
 * file, which publishing again changes nothing.
 */
export function freeAssetName(page: string, folder: string, name: string, data?: Buffer): string {
  const dir = path.join(repoPaths().output, page, folder)
  const extension = path.extname(name)
  const base = extension ? name.slice(0, -extension.length) : name
  for (let n = 0; n < 1000; n++) {
    const candidate = n ? `${base}-${n}${extension}` : name
    const existing = path.join(dir, candidate)
    if (!isFile(existing)) return candidate
    if (data && sameBytes(existing, data)) return candidate
  }
  return `${base}-${Date.now()}${extension}`
}

/**
 * Before an upload is named and stored (Payload names it after `req.file.name`, unique among the
 * files of the same `prefix`): it is stored under its page's folder (`prefix` = `<page>/<folder>`),
 * and steered clear of the published files there. A file replaced on an existing entry stays in
 * that entry's folder; the page and folder of an entry are not changed after its upload
 * (collections/CvpMedia.ts), since its file would stay where it was.
 */
export const placeUpload: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return args
  const file = req.file
  if (!file?.name) return args
  const input = args as { data?: MediaDoc & Record<string, unknown>; id?: string | number }
  const data = (input.data ?? (req.data as MediaDoc | undefined) ?? {}) as MediaDoc & Record<string, unknown>
  let page = text(data.page)
  let folder = text(data.folder)
  if (operation === 'update' && input.id !== undefined) {
    const existing = (await req.payload
      .findByID({ collection: MEDIA_SLUG, id: input.id, depth: 0, overrideAccess: true, req })
      .catch(() => null)) as MediaDoc | null
    page = text(existing?.page) ?? page
    folder = text(existing?.folder) ?? folder
  }
  folder ??= 'assets'
  if (!page || !PAGE_NAME.test(page) || !ASSET_FOLDER.test(folder)) return args
  file.name = freeAssetName(page, folder, file.name, Buffer.isBuffer(file.data) ? file.data : undefined)
  input.data = { ...data, prefix: mediaPrefix(page, folder) }
  return args
}

const MIME: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
}

/** The page folders of vikki-cvp/ (each a page's published files) */
export function publishedPages(): string[] {
  try {
    return fs
      .readdirSync(repoPaths().output, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && PAGE_NAME.test(entry.name))
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
}

// One import at a time: two would add the same files twice
let importing: Promise<MediaImportReport> | null = null

/**
 * The images already published in vikki-cvp/<page>/assets/ put into the library, each under its
 * own page and folder with its own name (so the pages' data, which names them, finds them there):
 * to try the library and the pickers on the real pictures, before uploads replace them. A file the
 * library already has (same page, folder and name) is left alone, so running it again only adds
 * what is new. Videos and PDFs only with `videos`: they are large, and the CDN already has them.
 * A file in a folder the library cannot name (`assets/Video`) is counted as skipped.
 */
export function importPublishedAssets(
  payload: Payload,
  options: { pages?: string[]; videos?: boolean; dryRun?: boolean } = {},
): Promise<MediaImportReport> {
  if (importing) return importing
  importing = (async () => {
    const { videos = false, dryRun = false } = options
    const pages = (options.pages ?? publishedPages()).filter((page) => PAGE_NAME.test(page))
    const report: MediaImportReport = { added: [], existing: 0, skipped: [], failed: [] }
    const { docs } = await payload.find({
      collection: MEDIA_SLUG,
      where: { page: { in: pages } },
      pagination: false,
      depth: 0,
      overrideAccess: true,
      select: { page: true, folder: true, filename: true },
    })
    const have = new Set((docs as MediaDoc[]).map((doc) => mediaTarget(doc)).filter(Boolean))
    for (const page of pages) {
      for (const inPage of publishedAssets(page)) {
        const target = `${page}/${inPage}`
        const name = path.posix.basename(inPage)
        const folder = path.posix.dirname(inPage)
        if (have.has(target)) {
          report.existing++
          continue
        }
        if (!ASSET_FOLDER.test(folder)) {
          report.skipped.push(target)
          continue
        }
        if (!videos && (isVideoFile(name) || /\.pdf$/i.test(name))) {
          report.skipped.push(target)
          continue
        }
        if (dryRun) {
          report.added.push(target)
          continue
        }
        try {
          const data = fs.readFileSync(path.join(repoPaths().output, page, inPage))
          await payload.create({
            collection: MEDIA_SLUG,
            data: { page, folder },
            file: {
              data,
              mimetype: MIME[path.extname(name).toLowerCase()] ?? 'application/octet-stream',
              name,
              size: data.length,
            },
            overrideAccess: true,
          })
          report.added.push(target)
        } catch (error) {
          report.failed.push(`${target}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
    return report
  })().finally(() => {
    importing = null
  })
  return importing
}
