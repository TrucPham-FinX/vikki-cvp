import type { Payload, TypedUser, Where } from 'payload'

import type {
  CatalogQuery,
  CatalogResult,
  CatalogRow,
  CatalogSlug,
  PromotionTiming,
} from '../contracts/cvp'
import { promotionTiming } from './catalogQuery'
import type { Locale } from './locales'

/**
 * The list screens' reads: a list state (`catalogQuery.ts`) turned into a Payload query, and the
 * documents turned into the plain rows the client draws. Server only.
 *
 * Through the Local API with `overrideAccess: false` and the signed-in user, so the collections'
 * own access is what decides, as it does for Payload's list view.
 */

/** The fields a list's search box looks in. */
const SEARCH_FIELDS: Record<CatalogSlug, string[]> = {
  'cvp-pages': ['key', 'title'],
  'cvp-documents': ['key', 'title'],
  promotions: ['promoId', 'name', 'promotionCode'],
  'card-intros': ['cardId', 'name', 'cardGroup'],
}

/** Promotions at a timing, as a query: the same rules as `promotionTiming`. */
export function timingWhere(timing: PromotionTiming, nowIso: string): Where {
  switch (timing) {
    case 'upcoming':
      return { startDate: { greater_than: nowIso } }
    case 'ended':
      return { endDate: { less_than: nowIso } }
    case 'undated':
      return { and: [{ startDate: { exists: false } }, { endDate: { exists: false } }] }
    case 'running':
      return {
        and: [
          { or: [{ startDate: { exists: true } }, { endDate: { exists: true } }] },
          { or: [{ startDate: { exists: false } }, { startDate: { less_than_equal: nowIso } }] },
          { or: [{ endDate: { exists: false } }, { endDate: { greater_than_equal: nowIso } }] },
        ],
      }
  }
}

/** The list state as a `where`: the search across the list's fields, AND each filter. */
export function catalogWhere(slug: CatalogSlug, query: CatalogQuery, nowIso: string): Where {
  const and: Where[] = []
  if (query.q) {
    and.push({ or: SEARCH_FIELDS[slug].map((field) => ({ [field]: { like: query.q } })) })
  }
  const { hot, lang, layout, timing } = query.filters
  if (lang) and.push({ languages: { in: [lang] } })
  if (layout) and.push({ layout: { equals: layout } })
  if (timing) and.push(timingWhere(timing as PromotionTiming, nowIso))
  if (hot) and.push({ isHotDeal: { equals: true } })
  return and.length ? { and } : {}
}

type Doc = Record<string, unknown>

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null
const num = (value: unknown): number | null => (typeof value === 'number' ? value : null)
const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

/** One document as the plain row its list draws: only what the columns show, all serializable. */
export function toRow(slug: CatalogSlug, doc: Doc, now: number): CatalogRow {
  const id = String(doc.id)
  const updatedAt = str(doc.updatedAt) ?? ''
  switch (slug) {
    case 'cvp-pages':
      return {
        kind: slug,
        id,
        key: str(doc.key) ?? '',
        page: str(doc.page) ?? '',
        file: str(doc.file) ?? '',
        title: str(doc.title),
        layout: str(doc.layout),
        languages: list(doc.languages),
        blocks: Array.isArray(doc.components) ? doc.components.length : 0,
        updatedAt,
      }
    case 'cvp-documents':
      return {
        kind: slug,
        id,
        key: str(doc.key) ?? '',
        page: str(doc.page) ?? '',
        file: str(doc.file) ?? '',
        title: str(doc.title),
        layout: str(doc.layout),
        languages: list(doc.languages),
        updatedAt,
      }
    case 'promotions':
      return {
        kind: slug,
        id,
        code: str(doc.promoId) ?? '',
        name: str(doc.name) ?? '',
        category: str(doc.promotionCate),
        hot: doc.isHotDeal === true,
        startDate: str(doc.startDate),
        endDate: str(doc.endDate),
        timing: promotionTiming(str(doc.startDate), str(doc.endDate), now),
        sortOrder: num(doc.sortOrder),
        updatedAt,
      }
    case 'card-intros':
      return {
        kind: slug,
        id,
        code: str(doc.cardId) ?? '',
        name: str(doc.name) ?? '',
        group: str(doc.cardGroup),
        sortOrder: num(doc.sortOrder),
        updatedAt,
      }
  }
}

/** One page of a list, in the admin's content language. */
export async function searchCatalog({
  locale,
  payload,
  query,
  slug,
  user,
}: {
  locale: Locale
  payload: Payload
  query: CatalogQuery
  slug: CatalogSlug
  user: TypedUser
}): Promise<CatalogResult> {
  const now = Date.now()
  const result = await payload.find({
    collection: slug,
    depth: 0,
    fallbackLocale: false,
    limit: query.limit,
    locale,
    overrideAccess: false,
    page: query.page,
    sort: query.sort,
    user,
    where: catalogWhere(slug, query, new Date(now).toISOString()),
  })
  return {
    rows: result.docs.map((doc) => toRow(slug, doc as unknown as Doc, now)),
    total: result.totalDocs,
    page: result.page ?? query.page,
    pages: Math.max(result.totalPages, 1),
    limit: query.limit,
  }
}
