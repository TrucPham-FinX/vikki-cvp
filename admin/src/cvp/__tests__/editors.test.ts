import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import { CardIntros } from '../../collections/CardIntros'
import { CvpDocuments } from '../../collections/CvpDocuments'
import { CvpPages } from '../../collections/CvpPages'
import { Promotions } from '../../collections/Promotions'
import { LANDING_BLOCKS } from '../blocks'
import { joinCodes, linkedCategories, splitCodes, toCode } from '../codes'
import { dataFields } from '../fields'
import { isEditableHtml } from '../html'
import { choiceValues, linkGroups } from '../links'

describe('code fields (codes)', () => {
  it('reads a value as its codes, whatever the spacing', () => {
    expect(splitCodes('VIKKIGO_PLUS,VIKKI_ONE')).toEqual(['VIKKIGO_PLUS', 'VIKKI_ONE'])
    expect(splitCodes('VIKKI_ONE, VIKKIGO_PLUS, VIKKI_ONE')).toEqual(['VIKKI_ONE', 'VIKKIGO_PLUS'])
    expect(splitCodes(null)).toEqual([])
    expect(joinCodes(['A', 'B'])).toBe('A,B')
  })

  it('writes a typed code the way the others are written', () => {
    expect(toCode('vikki go plus')).toBe('VIKKI_GO_PLUS')
    expect(toCode(' Thẻ đồng thương hiệu ')).toBe('THE_DONG_THUONG_HIEU')
    expect(toCode('VIKKI_ONE')).toBe('VIKKI_ONE')
  })

  it('finds the categories the pages link the promotion list to', () => {
    const page = {
      components: [{ items: [{ popup: '/vikki-cvp/promotion/list.html?category=VIKKIGO_COBAGE' }] }],
    }
    expect(linkedCategories(page)).toEqual(['VIKKIGO_COBAGE'])
  })

  it('offers each category once, as the list filters it', () => {
    const promotions = [
      { promoId: 'promo-1', name: 'A', promotionCate: 'VIKKIGO_PLUS,VIKKI_ONE', promotionGroup: 'HDB' },
      { promoId: 'promo-2', name: 'B', promotionCate: 'VIKKI_ONE, VIKKI_PRO', promotionGroup: 'HDB' },
    ]
    const pages = [
      {
        page: 'card',
        file: 'index.json',
        byLocale: { vi: { link: '/vikki-cvp/promotion/list.html?category=VIKKIGO_COBAGE' } },
      },
    ]
    const choices = choiceValues({ pages, promotions, cardIntros: [{ cardId: 'go', cardGroup: 'DEBIT_CARD' }] })
    expect(choices).toEqual({
      promotionCate: ['VIKKIGO_COBAGE', 'VIKKIGO_PLUS', 'VIKKI_ONE', 'VIKKI_PRO'],
      promotionGroup: ['HDB'],
      cardGroup: ['DEBIT_CARD'],
    })
    const lists = linkGroups({ pages, documents: [], promotions, cardIntros: [], locale: 'vi' }).find(
      (group) => group.key === 'promotionLists',
    )
    expect(lists?.options.map((option) => option.value)).toEqual([
      '/vikki-cvp/promotion/list.html',
      '/vikki-cvp/promotion/list.html?category=VIKKIGO_COBAGE',
      '/vikki-cvp/promotion/list.html?category=VIKKIGO_PLUS',
      '/vikki-cvp/promotion/list.html?category=VIKKI_ONE',
      '/vikki-cvp/promotion/list.html?category=VIKKI_PRO',
    ])
  })
})

describe('the rich-text editor’s safety check (html)', () => {
  it('takes the pages’ content: paragraphs, bold, lists, links', () => {
    for (const html of [
      '',
      '<p>Chủ thẻ có thể <strong>dễ dàng</strong> quản lý:</p><ul class="list-disc list-inside"><li>Khóa thẻ</li></ul>',
      '<p><a href="https://vikkibank.vn/" target="_blank" rel="noopener">vikkibank.vn</a><br></p>',
      '<span><b>Lưu ý:</b> onboarding = mở tài khoản</span>',
      '<a href="#" data-popup="/vikki-cvp/x/tc.html">Điều khoản</a>',
    ]) {
      expect(isEditableHtml(html), html).toBe(true)
    }
  })

  it('refuses markup that could run in the admin', () => {
    for (const html of [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<img/src=x/onerror=alert(1)>',
      '<a href="javascript:alert(1)">x</a>',
      '<a href="jav&#x61;script:alert(1)">x</a>',
      '<svg onload=alert(1)>',
      '<iframe src="https://example.com"></iframe>',
      '<style>body{display:none}</style>',
      '<div ONCLICK="x()">a</div>',
      '<p>text <img src=x\nonerror=alert(1)',
    ]) {
      expect(isEditableHtml(html), html).toBe(false)
    }
  })
})

describe('the edit forms', () => {
  const names = (fields: Parameters<typeof dataFields>[0]) => dataFields(fields).map((field) => field.name)

  it('keep each item’s fields in the order of its JSON keys', () => {
    // Field order is key order in the data files written back (cvp/fields.ts)
    expect(names(Promotions.fields)).toEqual([
      'promoId', 'name', 'shortDesc', 'extraData', 'longDesc', 'thumbnail', 'mainImg',
      'promotionCate', 'promotionGroup', 'promotionCode', 'isHotDeal',
      'startDate', 'endDate', 'createdDate', 'updatedDate', 'sortOrder', 'extra',
    ])
    expect(names(CardIntros.fields)).toEqual(['cardId', 'name', 'cardGroup', 'thumbnail', 'longDesc', 'sortOrder', 'extra'])
  })

  it('pick the page, the file, links, images and codes instead of typing them', () => {
    const componentOf = (field: unknown) => {
      const admin = (field as { admin?: { components?: { Field?: unknown } } }).admin
      const drawn = admin?.components?.Field
      return typeof drawn === 'string' ? drawn : (drawn as { path?: string } | undefined)?.path
    }
    const byName = (fields: Parameters<typeof dataFields>[0]) =>
      Object.fromEntries(dataFields(fields).map((field) => [field.name, componentOf(field)?.split('#')[1]]))

    for (const collection of [CvpPages, CvpDocuments]) {
      expect(byName(collection.fields)).toMatchObject({ page: 'PageField', file: 'FileField' })
    }
    expect(byName(Promotions.fields)).toMatchObject({
      longDesc: 'HtmlField',
      thumbnail: 'ImageField',
      mainImg: 'ImageField',
      promotionCate: 'ChoiceField',
      promotionGroup: 'ChoiceField',
    })
    expect(byName(CardIntros.fields)).toMatchObject({
      cardGroup: 'ChoiceField',
      thumbnail: 'ImageField',
      longDesc: 'HtmlField',
    })
  })

  it('show every block with its sketch and names its rows', () => {
    for (const block of LANDING_BLOCKS) {
      expect(block.imageURL).toBe(`/blocks/${block.slug}.svg`)
      expect(fs.existsSync(path.join(__dirname, '../../../public', block.imageURL!)), block.slug).toBe(true)
      expect(block.imageAltText).toBeTruthy()
    }
    for (const block of LANDING_BLOCKS) {
      for (const field of dataFields(block.fields)) {
        if (field.type === 'array') expect(field.labels?.singular, `${block.slug}.${field.name}`).toBeTruthy()
      }
    }
  })
})
