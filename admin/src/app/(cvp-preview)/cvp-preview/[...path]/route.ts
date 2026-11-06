import { mediaFileAt } from '@/cvp/media'
import { isPreviewToken, isRenderId, resolvePreviewFile } from '@/cvp/preview'
import { fileResponse, mediaRedirect, signedIn, unauthorized } from '@/cvp/previewHttp'

/**
 * A rendered preview's files, the published vikki-cvp/ behind them (cvp/preview.ts), then the media
 * library for an image uploaded since the last publish (cvp/media.ts)
 */
export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { payload, user } = await signedIn(request)
  if (!user) return unauthorized()
  const parts = (await ctx.params).path
  const found = resolvePreviewFile(parts)
  if (found) return fileResponse(found.file, found.rendered)
  const [token, render, ...rest] = parts
  const media =
    isPreviewToken(token) && isRenderId(render) && rest.length
      ? await mediaFileAt(payload, rest.join('/'))
      : null
  return media ? mediaRedirect(media) : new Response('Not found', { status: 404 })
}
