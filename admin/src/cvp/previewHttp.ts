import config from '@payload-config'
import fs from 'fs'
import path from 'path'
import { getPayload, type Payload, type TypedUser } from 'payload'

import { translator, type Translator } from '../admin/i18n/dictionary'

/**
 * What the preview's Next route handlers (src/app/(cvp-preview)) share: who is asking, in which
 * admin language, and how a file goes back. Outside Payload's /api, so each route checks the
 * session itself — nothing under /cvp-preview or /vikki-cvp is served to a visitor without one.
 */

export async function signedIn(
  request: Request,
): Promise<{ payload: Payload; t: Translator; user: TypedUser | null }> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  // Payload's language cookie, as its own screens read it
  const language = /(?:^|;\s*)payload-lng=([a-z]{2})/.exec(request.headers.get('cookie') ?? '')?.[1]
  return { payload, t: translator(language), user: user ?? null }
}

export const unauthorized = () =>
  new Response('Unauthorized', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

const TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

/**
 * A file as the response. A render is never cached (the next keystroke replaces it); a published
 * file is cached briefly, so a page's images are not fetched again on every render.
 */
export function fileResponse(file: string, rendered: boolean): Response {
  const body = fs.readFileSync(file)
  return new Response(new Uint8Array(body), {
    headers: {
      'Cache-Control': rendered ? 'no-store' : 'private, max-age=300',
      'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/**
 * A media library file, at the address Payload serves it from (cvp/media.ts mediaFileAt): its
 * route checks the session and reads the disk or S3 (a presigned redirect there).
 */
export const mediaRedirect = (url: string) =>
  new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, max-age=60' } })

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** A plain page saying why there is nothing to show — for a preview opened in its own tab. */
export function messagePage(title: string, detail: string, status: number): Response {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>body{font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;margin:0;padding:32px 20px;color:#222}
h1{font-size:16px;margin:0 0 8px}pre{white-space:pre-wrap;background:#fafafa;border:1px solid #e3e3e3;border-radius:6px;padding:12px;font-size:12px}</style>
</head><body><h1>${escapeHtml(title)}</h1>${detail ? `<pre>${escapeHtml(detail)}</pre>` : ''}</body></html>`
  return new Response(html, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8' },
  })
}
