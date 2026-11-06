import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LIMIT,
  DEFAULT_SORT,
  catalogSearch,
  isFiltered,
  parseCatalogQuery,
  promotionTiming,
} from '../catalogQuery'

describe('parseCatalogQuery', () => {
  it('opens every list on its first page, default size and default order', () => {
    expect(parseCatalogQuery('cvp-pages', {})).toEqual({
      q: '',
      page: 1,
      limit: DEFAULT_LIMIT,
      sort: 'key',
      filters: {},
    })
    expect(parseCatalogQuery('promotions', undefined).sort).toBe('sortOrder')
  })

  it('keeps what the URL says when it is valid', () => {
    expect(
      parseCatalogQuery('cvp-documents', {
        q: '  phí ',
        page: '3',
        limit: '50',
        sort: '-updatedAt',
        lang: 'en',
        layout: 'fee',
      }),
    ).toEqual({ q: 'phí', page: 3, limit: 50, sort: '-updatedAt', filters: { lang: 'en', layout: 'fee' } })
  })

  it('replaces what is malformed or not offered by the default', () => {
    const query = parseCatalogQuery('cvp-pages', {
      page: '-2',
      limit: '1000',
      sort: 'password',
      lang: 'fr',
      layout: 'X; drop',
      timing: 'running',
    })
    expect(query.page).toBe(1)
    expect(query.limit).toBe(DEFAULT_LIMIT)
    expect(query.sort).toBe(DEFAULT_SORT['cvp-pages'])
    // `timing` is a promotions filter, `fr` is not a CVP language
    expect(query.filters).toEqual({})
  })

  it('reads the first value of a repeated param', () => {
    expect(parseCatalogQuery('promotions', { timing: ['ended', 'running'], hot: ['1'] }).filters).toEqual({
      timing: 'ended',
      hot: '1',
    })
  })
})

describe('catalogSearch', () => {
  it('writes nothing for the default state', () => {
    expect(catalogSearch('card-intros', parseCatalogQuery('card-intros', {}))).toBe('')
  })

  it('round-trips through parseCatalogQuery', () => {
    const query = parseCatalogQuery('promotions', {
      q: 'vikki go',
      page: '2',
      limit: '10',
      sort: '-startDate',
      timing: 'upcoming',
      hot: '1',
    })
    const search = catalogSearch('promotions', query)
    const params = Object.fromEntries(new URLSearchParams(search))
    expect(parseCatalogQuery('promotions', params)).toEqual(query)
  })
})

describe('isFiltered', () => {
  it('is a search or any filter, not a sort or a page', () => {
    expect(isFiltered(parseCatalogQuery('cvp-pages', { sort: '-key', page: '2' }))).toBe(false)
    expect(isFiltered(parseCatalogQuery('cvp-pages', { q: 'go' }))).toBe(true)
    expect(isFiltered(parseCatalogQuery('cvp-pages', { lang: 'ko' }))).toBe(true)
  })
})

describe('promotionTiming', () => {
  const now = Date.parse('2026-11-05T05:00:00.000Z')

  it.each([
    ['2026-11-01T00:00:00.000Z', '2026-11-30T00:00:00.000Z', 'running'],
    ['2026-11-01T00:00:00.000Z', null, 'running'],
    [null, '2026-12-01T00:00:00.000Z', 'running'],
    ['2026-12-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 'upcoming'],
    ['2026-10-01T00:00:00.000Z', '2026-10-31T00:00:00.000Z', 'ended'],
    [null, null, 'undated'],
    ['not a date', undefined, 'undated'],
  ] as const)('%s → %s is %s', (start, end, timing) => {
    expect(promotionTiming(start, end, now)).toBe(timing)
  })
})
