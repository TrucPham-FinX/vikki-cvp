import { isCatalogSlug } from '@/contracts/cvp'
import { DEFAULT_LOCALE, isLocale } from '@/cvp/locales'
import { renderPreview } from '@/cvp/preview'
import { messagePage, signedIn, unauthorized } from '@/cvp/previewHttp'

/**
 * An item as saved, built and opened in its own tab: the edit form's "Xem trước" button
 * (`admin.preview`, previewConfig.ts). Redirects to the render, so the tab's address is the page's
 * own and its relative links work as on the CDN.
 */
export async function GET(request: Request) {
  const { payload, t, user } = await signedIn(request)
  if (!user) return unauthorized()

  const query = new URL(request.url).searchParams
  const collection = query.get('collection')
  const id = query.get('id')
  const locale = query.get('locale')
  if (!isCatalogSlug(collection) || !id) return messagePage(t('preview.notFound'), '', 404)

  const result = await renderPreview(payload, {
    collection,
    id,
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
  })
  if (result.ok) return Response.redirect(new URL(result.url, request.url), 303)
  if (result.reason === 'language') {
    return messagePage(t('preview.language', { lang: String(locale).toUpperCase() }), '', 404)
  }
  if (result.reason === 'only-default') return messagePage(t('preview.onlyDefault'), '', 404)
  if (result.reason === 'missing') return messagePage(t('preview.notFound'), '', 404)
  return messagePage(t('preview.failed'), result.error, 422)
}
