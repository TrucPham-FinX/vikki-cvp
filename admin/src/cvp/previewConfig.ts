import type { CollectionAdminOptions, PayloadRequest } from 'payload'

import type { CatalogSlug } from '../contracts/cvp'

/**
 * The preview an edit form of the CVP collections gets (cvp/preview.ts does the building):
 *
 * - `livePreview`: Payload's panel beside the form, open from the start, framing
 *   /cvp-preview/live. The page follows the form as it is typed in, saved or not, in the content
 *   language picked in the header; the panel's toolbar can pop it out into its own window, which
 *   keeps following.
 * - `preview`: the "Xem trước" button, which opens the item as saved in a new tab.
 *
 * The CVP pages are the app's webviews, so the sizes offered are phones.
 */

const PHONES = [
  { label: 'iPhone 14 · 390×844', name: 'iphone', width: 390, height: 844 },
  { label: 'iPhone SE · 375×667', name: 'iphone-se', width: 375, height: 667 },
  { label: 'Android · 360×800', name: 'android', width: 360, height: 800 },
]

/**
 * This admin's own origin. Payload only accepts the frame's "ready" message from an origin its
 * URL starts with, so the URL must be absolute; behind a proxy, the forwarded host is the one the
 * browser sees.
 */
function originOf(req: PayloadRequest): string | null {
  const configured = (process.env.PAYLOAD_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '')
  if (configured) return configured
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (!host) return null
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http'
  return `${proto}://${host}`
}

export function cvpPreview(slug: CatalogSlug): Pick<CollectionAdminOptions, 'livePreview' | 'preview'> {
  return {
    livePreview: {
      breakpoints: PHONES,
      openByDefault: true,
      url: ({ req }) => {
        const origin = originOf(req)
        return origin ? `${origin}/cvp-preview/live?collection=${slug}` : null
      },
    },
    preview: (doc, { locale }) =>
      doc.id === undefined || doc.id === null
        ? null
        : `/cvp-preview/open?collection=${slug}&id=${encodeURIComponent(String(doc.id))}&locale=${locale}`,
  }
}
