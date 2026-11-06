import type { CatalogQuery, CatalogSlug, PromotionTiming } from '../contracts/cvp'
import { isLocale } from './locales'

/**
 * The list screens' URL state: what each list may be searched, filtered and sorted by, read from
 * and written to search params. Pure, and free of server imports, so the server view and the
 * client component parse and write the same URL.
 */

/** The rows-per-page steps the pager offers (the design layer's `PAGE_SIZES`). */
export const PAGE_SIZES = [10, 20, 50] as const
export const DEFAULT_LIMIT = 20

/** Columns each list can be ordered by (Payload field names) and the order it opens in. */
export const SORTABLE: Record<CatalogSlug, readonly string[]> = {
  'cvp-pages': ['key', 'title', 'updatedAt'],
  'cvp-documents': ['key', 'title', 'layout', 'updatedAt'],
  promotions: ['promoId', 'name', 'startDate', 'endDate', 'sortOrder', 'updatedAt'],
  'card-intros': ['cardId', 'name', 'cardGroup', 'sortOrder', 'updatedAt'],
}

export const DEFAULT_SORT: Record<CatalogSlug, string> = {
  'cvp-pages': 'key',
  'cvp-documents': 'key',
  promotions: 'sortOrder',
  'card-intros': 'sortOrder',
}

/** The filters each list offers, beside its search. */
export const FILTERS: Record<CatalogSlug, readonly string[]> = {
  'cvp-pages': ['lang', 'layout'],
  'cvp-documents': ['lang', 'layout'],
  promotions: ['timing', 'hot'],
  'card-intros': [],
}

/** The timings a list can be filtered to; `undated` is shown on rows, not filtered on. */
export const TIMING_FILTERS: readonly PromotionTiming[] = ['running', 'upcoming', 'ended']

type Params = Record<string, string | string[] | undefined> | undefined

const one = (params: Params, name: string): string => {
  const value = params?.[name]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

const filterValue = (name: string, raw: string): string | null => {
  if (!raw) return null
  switch (name) {
    case 'lang':
      return isLocale(raw) ? raw : null
    case 'layout':
      return /^[a-z][a-z-]*$/.test(raw) ? raw : null
    case 'timing':
      return TIMING_FILTERS.includes(raw as PromotionTiming) ? raw : null
    case 'hot':
      return raw === '1' ? '1' : null
    default:
      return null
  }
}

/** The URL's list state, anything unknown or malformed replaced by the default. */
export function parseCatalogQuery(slug: CatalogSlug, params: Params): CatalogQuery {
  const page = Number.parseInt(one(params, 'page'), 10)
  const limit = Number.parseInt(one(params, 'limit'), 10)
  const sort = one(params, 'sort')
  const field = sort.replace(/^-/, '')

  const filters: Record<string, string> = {}
  for (const name of FILTERS[slug]) {
    const value = filterValue(name, one(params, name))
    if (value) filters[name] = value
  }

  return {
    q: one(params, 'q').slice(0, 100),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: (PAGE_SIZES as readonly number[]).includes(limit) ? limit : DEFAULT_LIMIT,
    sort: SORTABLE[slug].includes(field) ? sort : DEFAULT_SORT[slug],
    filters,
  }
}

/** The search params for a list state, leaving out whatever is the default. */
export function catalogSearch(slug: CatalogSlug, query: CatalogQuery): string {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  for (const name of FILTERS[slug]) {
    const value = query.filters[name]
    if (value) params.set(name, value)
  }
  if (query.sort !== DEFAULT_SORT[slug]) params.set('sort', query.sort)
  if (query.limit !== DEFAULT_LIMIT) params.set('limit', String(query.limit))
  if (query.page > 1) params.set('page', String(query.page))
  const search = params.toString()
  return search ? `?${search}` : ''
}

/** Is the list narrowed by a search or a filter (so "nothing here" means "nothing matches")? */
export const isFiltered = (query: CatalogQuery): boolean =>
  Boolean(query.q) || Object.keys(query.filters).length > 0

/** Where a promotion stands at `now`, from its start and end dates. */
export function promotionTiming(
  start: string | null | undefined,
  end: string | null | undefined,
  now: number,
): PromotionTiming {
  const from = start ? Date.parse(start) : Number.NaN
  const to = end ? Date.parse(end) : Number.NaN
  if (Number.isNaN(from) && Number.isNaN(to)) return 'undated'
  if (!Number.isNaN(from) && from > now) return 'upcoming'
  if (!Number.isNaN(to) && to < now) return 'ended'
  return 'running'
}
