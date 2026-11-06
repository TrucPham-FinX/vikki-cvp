import type { Endpoint, PayloadHandler } from 'payload'

import {
  CVP_OPERATIONS,
  isCatalogSlug,
  type PageAssets,
  type PreviewResponse,
  type PublishStatus,
} from '../contracts/cvp'
import { PAGE_NAME } from '../cvp/assetPaths'
import { isPlainObject } from '../cvp/fields'
import { readLinkTargets } from '../cvp/links'
import { DEFAULT_LOCALE, isLocale } from '../cvp/locales'
import { importPublishedAssets, pageAssets } from '../cvp/media'
import { renderPreview } from '../cvp/preview'
import { pendingAssets, pendingChanges, publish } from '../cvp/publish'

const unauthorized = () => Response.json({ error: 'Unauthorized' }, { status: 401 })

/** A query parameter of the request */
const param = (req: Parameters<PayloadHandler>[0], name: string) => {
  const value = (req.query as Record<string, unknown> | undefined)?.[name]
  return typeof value === 'string' ? value : null
}

/** The data files a publish would change, and the media it would copy (cvp/publish.ts, dry run) */
const status: PayloadHandler = async (req) => {
  if (!req.user) return unauthorized()
  const [report, assets] = await Promise.all([pendingChanges(req.payload), pendingAssets(req.payload)])
  return Response.json({ written: report.written, stale: report.stale, assets } satisfies PublishStatus)
}

/** What a link field can point at, titles in the content language (cvp/links.ts) */
const linkTargets: PayloadHandler = async (req) => {
  if (!req.user) return unauthorized()
  const locale = param(req, 'locale')
  return Response.json(await readLinkTargets(req.payload, isLocale(locale) ? locale : DEFAULT_LOCALE))
}

/** A page's images, for the image picker (cvp/media.ts) */
const assets: PayloadHandler = async (req) => {
  if (!req.user) return unauthorized()
  const page = param(req, 'page')
  if (!page || !PAGE_NAME.test(page)) {
    return Response.json({ error: 'page is required' }, { status: 400 })
  }
  return Response.json({ page, items: await pageAssets(req.payload, page) } satisfies PageAssets)
}

/** The published images put into the media library, to try it on the real pictures (cvp/media.ts) */
const mediaImport: PayloadHandler = async (req) => {
  if (!req.user) return unauthorized()
  const report = await importPublishedAssets(req.payload, { videos: param(req, 'videos') === '1' })
  req.payload.logger.info(
    `[cvp] media import by ${req.user.email ?? req.user.id}: ${report.added.length} added, ${report.existing} already there, ${report.failed.length} failed`,
  )
  return Response.json(report)
}

/** Export, validate, build (cvp/publish.ts) */
const publishHandler: PayloadHandler = async (req) => {
  if (!req.user) return unauthorized()
  try {
    const report = await publish(req.payload)
    req.payload.logger.info(
      `[cvp] publish by ${req.user.email ?? req.user.id}: ${report.data.written.length} data file(s) written, ok=${report.ok}`,
    )
    return Response.json(report, { status: report.ok ? 200 : 422 })
  } catch (error) {
    req.payload.logger.error({ err: error }, '[cvp] publish failed')
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

/** One item built from the edit form's values, for the live preview (cvp/preview.ts) */
const previewHandler: PayloadHandler = async (req) => {
  if (!req.user) return unauthorized()
  const body = (await req.json?.().catch(() => null)) as Record<string, unknown> | null
  const { collection, data, id, locale, token } = body ?? {}
  if (!isCatalogSlug(collection) || !isLocale(locale)) {
    return Response.json({ error: 'collection and locale are required' }, { status: 400 })
  }
  try {
    const result: PreviewResponse = await renderPreview(req.payload, {
      collection,
      data: isPlainObject(data) ? data : null,
      id: typeof id === 'string' || typeof id === 'number' ? id : null,
      locale,
      token: typeof token === 'string' ? token : null,
    })
    return Response.json(result, { status: result.ok ? 200 : 422 })
  } catch (error) {
    req.payload.logger.error({ err: error }, '[cvp] preview failed')
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// Paths and methods from the shared contract, so the browser client (contracts/api.ts) and these
// handlers cannot disagree
export const cvpEndpoints: Endpoint[] = [
  { ...CVP_OPERATIONS.status, handler: status },
  { ...CVP_OPERATIONS.publish, handler: publishHandler },
  { ...CVP_OPERATIONS.preview, handler: previewHandler },
  { ...CVP_OPERATIONS.linkTargets, handler: linkTargets },
  { ...CVP_OPERATIONS.assets, handler: assets },
  { ...CVP_OPERATIONS.mediaImport, handler: mediaImport },
]
