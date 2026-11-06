import { describe, expect, it } from 'vitest'

import { catalogWhere, timingWhere, toRow } from '../catalog'
import { parseCatalogQuery } from '../catalogQuery'

const NOW = '2026-11-05T05:00:00.000Z'

describe('catalogWhere', () => {
  it('is empty for an unfiltered list', () => {
    expect(catalogWhere('cvp-pages', parseCatalogQuery('cvp-pages', {}), NOW)).toEqual({})
  })

  it('searches the list’s own fields and ANDs each filter', () => {
    const query = parseCatalogQuery('cvp-pages', { q: 'go', lang: 'en', layout: 'template' })
    expect(catalogWhere('cvp-pages', query, NOW)).toEqual({
      and: [
        { or: [{ key: { like: 'go' } }, { title: { like: 'go' } }] },
        { languages: { in: ['en'] } },
        { layout: { equals: 'template' } },
      ],
    })
  })

  it('narrows promotions by timing and hot deal', () => {
    const query = parseCatalogQuery('promotions', { timing: 'ended', hot: '1' })
    expect(catalogWhere('promotions', query, NOW)).toEqual({
      and: [{ endDate: { less_than: NOW } }, { isHotDeal: { equals: true } }],
    })
  })

  it('counts a promotion with neither date as undated, never as running', () => {
    const running = JSON.stringify(timingWhere('running', NOW))
    expect(running).toContain('"exists":true')
    expect(timingWhere('undated', NOW)).toEqual({
      and: [{ startDate: { exists: false } }, { endDate: { exists: false } }],
    })
  })
})

describe('toRow', () => {
  const now = Date.parse(NOW)

  it('keeps only what a page row shows, with its block count', () => {
    const row = toRow(
      'cvp-pages',
      {
        id: 7,
        key: 'vikki-go-cvp/index.json',
        page: 'vikki-go-cvp',
        file: 'index.json',
        title: 'Vikki GO',
        layout: 'template',
        languages: ['vi'],
        components: [{ blockType: 'video' }, { blockType: 'qa' }],
        extra: '{"secret": 1}',
        updatedAt: '2026-11-04T08:00:00.000Z',
      },
      now,
    )
    expect(row).toEqual({
      kind: 'cvp-pages',
      id: '7',
      key: 'vikki-go-cvp/index.json',
      page: 'vikki-go-cvp',
      file: 'index.json',
      title: 'Vikki GO',
      layout: 'template',
      languages: ['vi'],
      blocks: 2,
      updatedAt: '2026-11-04T08:00:00.000Z',
    })
  })

  it('names a promotion by its code and works out its timing', () => {
    const row = toRow(
      'promotions',
      {
        id: 'a1',
        promoId: 'promo-114',
        name: 'Hoàn tiền',
        promotionCate: 'VIKKIGO_PLUS',
        isHotDeal: true,
        startDate: '2026-12-01T00:00:00.000Z',
        endDate: null,
        sortOrder: 20,
        updatedAt: '2026-11-04T08:00:00.000Z',
      },
      now,
    )
    expect(row).toMatchObject({ kind: 'promotions', code: 'promo-114', hot: true, timing: 'upcoming', sortOrder: 20 })
  })

  it('turns empty strings into nothing rather than blank cells', () => {
    const row = toRow('card-intros', { id: 1, cardId: 'vikki-pro', name: 'Pro', cardGroup: '  ' }, now)
    expect(row).toMatchObject({ code: 'vikki-pro', group: null, sortOrder: null, updatedAt: '' })
  })
})
