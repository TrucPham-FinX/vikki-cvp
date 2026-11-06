import { mediaFileAt } from '@/cvp/media'
import { resolvePublishedFile } from '@/cvp/preview'
import { fileResponse, mediaRedirect, signedIn, unauthorized } from '@/cvp/previewHttp'

/**
 * The CDN's paths (`/vikki-cvp/<page>/tc.html`), which a page's popup links use, for a page
 * opened in the preview: the render it came from first, then the published file, then the media
 * library for an image uploaded since the last publish (also what the image picker shows).
 */
export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { payload, user } = await signedIn(request)
  if (!user) return unauthorized()
  const parts = (await ctx.params).path
  const found = resolvePublishedFile(parts, request.headers.get('referer'))
  if (found) return fileResponse(found.file, found.rendered)
  const media = parts.length ? await mediaFileAt(payload, parts.join('/')) : null
  return media ? mediaRedirect(media) : new Response('Not found', { status: 404 })
}
