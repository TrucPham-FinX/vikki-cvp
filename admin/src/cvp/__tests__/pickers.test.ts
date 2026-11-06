import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { assetValue, htmlFolder, pathInPage, resolveAsset } from '../assetPaths'
import { entryOptions, linkGroups } from '../links'
import { freeAssetName, mediaTarget, publishedAssets } from '../media'

describe('image paths (assetPaths)', () => {
  it('starts a {locale} file from its language folder, the rest from the page', () => {
    expect(htmlFolder('vikki-go-cvp', 'index.json', 'en')).toBe('vikki-go-cvp')
    expect(htmlFolder('fx', '{locale}.json', 'en')).toBe('fx/en')
    expect(htmlFolder('fx', 'tc-{locale}.json', 'vi')).toBe('fx/vi')
  })

  it('resolves the ways the pages write a path, into vikki-cvp/', () => {
    expect(resolveAsset('p', './assets/a.png')).toBe('p/assets/a.png')
    expect(resolveAsset('p', 'assets/a.png')).toBe('p/assets/a.png')
    expect(resolveAsset('p/vi', '../assets/vi/a.png')).toBe('p/assets/vi/a.png')
    expect(resolveAsset('p', '/vikki-cvp/q/assets/a.png?v=2')).toBe('q/assets/a.png')
  })

  it('has no file for a web address, another site path, or a climb out of vikki-cvp/', () => {
    expect(resolveAsset('p', 'https://cdn.example.com/a.png')).toBeNull()
    expect(resolveAsset('p', '//cdn.example.com/a.png')).toBeNull()
    expect(resolveAsset('p', '/static/a.png')).toBeNull()
    expect(resolveAsset('p', '../../a.png')).toBeNull()
    expect(resolveAsset('p', '')).toBeNull()
  })

  it('writes a picked image the way the pages already do', () => {
    expect(assetValue('index.json', 'assets/a.png')).toBe('./assets/a.png')
    expect(assetValue('{locale}.json', 'assets/vi/a.png')).toBe('../assets/vi/a.png')
    expect(pathInPage(null, 'a.png')).toBe('assets/a.png')
    expect(pathInPage('assets/en', 'a.png')).toBe('assets/en/a.png')
  })

  it('round-trips: what the picker writes resolves to the file picked', () => {
    for (const [file, locale] of [
      ['index.json', 'vi'],
      ['{locale}.json', 'en'],
    ] as const) {
      const value = assetValue(file, 'assets/a.png')
      expect(resolveAsset(htmlFolder('p', file, locale), value)).toBe('p/assets/a.png')
    }
  })
})

describe('link targets (links)', () => {
  it('gives a single-language file its one address, titled in the content language', () => {
    const entry = { page: 'vikki-go-cvp', file: 'tc.json', byLocale: { vi: { title: 'Điều khoản' } } }
    expect(entryOptions(entry, 'en')).toEqual([{ value: '/vikki-cvp/vikki-go-cvp/tc.html', label: 'Điều khoản' }])
  })

  it('gives a file built per language the ?lang address and each copy', () => {
    const entry = {
      page: 'fx',
      file: 'tc-{locale}.json',
      byLocale: { vi: { title: 'Điều khoản' }, en: { title: 'Terms' } },
    }
    expect(entryOptions(entry, 'en')).toEqual([
      { value: '/vikki-cvp/fx/tc.html', label: 'Terms', lang: 'auto' },
      { value: '/vikki-cvp/fx/vi/tc.html', label: 'Terms', lang: 'vi' },
      { value: '/vikki-cvp/fx/en/tc.html', label: 'Terms', lang: 'en' },
    ])
  })

  it('offers the addresses the data files already use', () => {
    const groups = linkGroups({
      pages: [],
      documents: [{ page: 'vikki-one-connect', file: 'fee.json', byLocale: { vi: { title: 'Biểu phí' } } }],
      promotions: [
        { promoId: 'promo-075', name: 'Hoàn tiền', promotionCate: 'VIKKI_ONE' },
        { promoId: 'promo-076', name: 'Trả góp', promotionCate: 'VIKKI_ONE' },
      ],
      cardIntros: [{ cardId: 'vikki-go', name: 'Vikki GO' }],
      locale: 'vi',
    })
    const values = groups.flatMap((group) => group.options.map((option) => option.value))
    expect(values).toEqual(
      expect.arrayContaining([
        '/vikki-cvp/vikki-one-connect/fee.html',
        '/vikki-cvp/promotion/promo-075.html',
        '/vikki-cvp/promotion/list.html?category=VIKKI_ONE',
        '/vikki-cvp/card-intro/vikki-go.html',
      ]),
    )
    expect(groups.map((group) => group.key)).toEqual(['documents', 'promotions', 'promotionLists', 'cardIntros'])
    // One list per category, plus the whole list
    expect(groups.find((group) => group.key === 'promotionLists')?.options).toHaveLength(2)
  })

  it('names an untitled file by its address, and tells apart two pages titled alike', () => {
    const groups = linkGroups({
      pages: [
        { page: 'one', file: 'index.json', byLocale: { vi: { title: 'Vikki One' } } },
        { page: 'one', file: 'intro.json', byLocale: { vi: { title: 'Vikki One' } } },
      ],
      documents: [{ page: 'go', file: 'fee.json', byLocale: { vi: {} } }],
      promotions: [],
      cardIntros: [],
      locale: 'vi',
    })
    expect(groups.find((group) => group.key === 'documents')?.options[0]?.label).toBe('go/fee.html')
    expect(groups.find((group) => group.key === 'pages')?.options.map((option) => option.label)).toEqual([
      'Vikki One (one/index.html)',
      'Vikki One (one/intro.html)',
    ])
  })
})

describe('the media library (media)', () => {
  let root: string
  const before = process.env.CVP_REPO_ROOT

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cvp-media-'))
    process.env.CVP_REPO_ROOT = root
    fs.mkdirSync(path.join(root, 'vikki-cvp', 'p', 'assets', 'vi'), { recursive: true })
    fs.writeFileSync(path.join(root, 'vikki-cvp', 'p', 'assets', 'title.png'), 'published')
    fs.writeFileSync(path.join(root, 'vikki-cvp', 'p', 'assets', 'vi', 'banner.jpg'), 'vi')
    fs.writeFileSync(path.join(root, 'vikki-cvp', 'p', 'assets', 'notes.txt'), 'not an image')
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
    if (before === undefined) delete process.env.CVP_REPO_ROOT
    else process.env.CVP_REPO_ROOT = before
  })

  it('places a library file in its page folder, and nowhere outside one', () => {
    expect(mediaTarget({ page: 'p', folder: 'assets/vi', filename: 'a.png' })).toBe('p/assets/vi/a.png')
    expect(mediaTarget({ page: 'p', filename: 'a.png' })).toBe('p/assets/a.png')
    expect(mediaTarget({ page: '../p', filename: 'a.png' })).toBeNull()
    expect(mediaTarget({ page: 'p', folder: '../..', filename: 'a.png' })).toBeNull()
  })

  it('lists the images a page has published, relative to its folder', () => {
    expect(publishedAssets('p')).toEqual(['assets/title.png', 'assets/vi/banner.jpg'])
    expect(publishedAssets('../etc')).toEqual([])
  })

  it('never lets an upload take a published image’s place, unless it is that image', () => {
    expect(freeAssetName('p', 'assets', 'new.png')).toBe('new.png')
    expect(freeAssetName('p', 'assets', 'title.png', Buffer.from('another'))).toBe('title-1.png')
    expect(freeAssetName('p', 'assets', 'title.png', Buffer.from('published'))).toBe('title.png')
  })
})
