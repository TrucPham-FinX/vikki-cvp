import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import { CvpDocuments } from '../../collections/CvpDocuments'
import { CvpPages } from '../../collections/CvpPages'
import { dataFields } from '../fields'
import {
  blankLike,
  documentTemplate,
  freshId,
  getAt,
  insertAt,
  moveAt,
  optionalKeys,
  parseObject,
  removeAt,
  rowLabelOf,
  setAt,
  summaryOf,
  textKind,
  toText,
  type Json,
} from '../structured'

const DATA = path.join(__dirname, '../../../../front-end/data')
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')) as Json

describe('the structured editor’s changes (structured)', () => {
  const doc = { header: { img: 'a.png', h1: 'T' }, sections: [{ id: 's1', title: 'A' }, { id: 's2', title: 'B' }], note: { text: 'n' } }

  it('changes one value where it is: every key keeps its place, other branches are shared', () => {
    const next = setAt(doc, ['header', 'img'], 'b.png') as typeof doc
    expect(Object.keys(next)).toEqual(['header', 'sections', 'note'])
    expect(Object.keys(next.header)).toEqual(['img', 'h1'])
    expect(next.header.img).toBe('b.png')
    expect(next.sections).toBe(doc.sections)
    expect(doc.header.img).toBe('a.png')
  })

  it('adds, moves and removes rows', () => {
    const added = insertAt(doc, ['sections'], 1, { id: 'new', title: '' })
    expect((getAt(added, ['sections']) as Json[]).map((s) => getAt(s, ['id']))).toEqual(['s1', 'new', 's2'])
    const moved = moveAt(doc, ['sections'], 0, 1)
    expect((getAt(moved, ['sections']) as Json[]).map((s) => getAt(s, ['id']))).toEqual(['s2', 's1'])
    expect(moveAt(doc, ['sections'], 0, 5)).toBe(doc)
    const removed = removeAt(doc, ['sections', 0])
    expect(getAt(removed, ['sections', 0, 'id'])).toBe('s2')
    expect(Object.keys(removeAt(doc, ['note']) as object)).toEqual(['header', 'sections'])
  })

  it('writes back a real document unchanged when nothing was edited, and only the edit when one was', () => {
    for (const file of ['vikki-loan-cvp/tc.json', 'vikki-go-plus-cvp/fee.json', 'home-loan-cvp/tc.json']) {
      const { layout: _layout, ...content } = read(file) as { [key: string]: Json }
      const parsed = parseObject(toText(content))
      expect(parsed.ok && toText(parsed.value)).toBe(toText(content))
    }
    const fee = read('vikki-go-plus-cvp/fee.json')
    const edited = setAt(fee, ['blocks', 3, 'rows', 0, 'cells', 1, 'value'], 'Phí mới')
    const changed: string[] = []
    const diff = (a: Json | undefined, b: Json | undefined, at: string) => {
      if (a === b) return
      if (typeof a === 'object' && a && typeof b === 'object' && b) {
        for (const key of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) {
          diff((a as Record<string, Json>)[key], (b as Record<string, Json>)[key], `${at}.${key}`)
        }
      } else changed.push(at)
    }
    diff(fee, edited, '$')
    expect(changed).toEqual(['$.blocks.3.rows.0.cells.1.value'])
  })
})

describe('which editor a value gets (structured)', () => {
  it('picks images, links and rich text by key and value', () => {
    expect(textKind('img', 'assets/vikki-logo.png')).toBe('image')
    expect(textKind('src', '')).toBe('image')
    expect(textKind('posterSrc', '../assets/vi/poster.png')).toBe('image')
    expect(textKind('src', 'a caption, not a file')).not.toBe('image')
    expect(textKind('bannerVideoHlsSrc', './assets/video/playlist.m3u8')).toBe('line')
    expect(textKind('videoHlsSrc', '')).toBe('line')
    expect(textKind('popup', '/vikki-cvp/x/tc.html')).toBe('link')
    expect(textKind('popupLink', '')).toBe('link')
    expect(textKind('text', '<strong>1.</strong> Đối tượng')).toBe('html')
    expect(textKind('value', 'Tính năng<br>Thẻ tín dụng')).toBe('html')
    expect(textKind('h1', 'ĐIỀU KHOẢN')).toBe('line')
    expect(textKind('alt', 'x'.repeat(120))).toBe('multiline')
  })

  it('summarises a row by its title, else its text, without tags', () => {
    expect(summaryOf({ id: 'dieu-1', title: 'ĐIỀU 1' })).toBe('ĐIỀU 1')
    expect(summaryOf({ text: '<strong>1.</strong>&nbsp;Đối tượng' })).toBe('1. Đối tượng')
    expect(summaryOf({ type: 'list', items: [{ text: 'Dòng đầu' }] })).toBe('Dòng đầu')
    expect(summaryOf({ cells: [{ value: 'Stt' }, { value: 'Tên phí' }] })).toBe('Stt | Tên phí')
  })

  it('names a list’s new row', () => {
    expect(rowLabelOf('sections')).toBe('phần')
    expect(rowLabelOf('plans')).toBe('gói')
    expect(rowLabelOf('somethingElse')).toBe('something else')
  })
})

describe('what a new part starts as (structured)', () => {
  it('makes a row like the last one: same keys, empty texts, kinds kept, no merges or classes', () => {
    expect(
      blankLike({ type: 'list', style: 'alpha', className: 'x', items: [{ text: 'a' }] }),
    ).toEqual({ type: 'list', style: 'alpha', items: [] })
    expect(blankLike({ cells: [{ value: 'a', colspan: 3, className: 'bold' }] })).toEqual({ cells: [] })
    expect(blankLike({ number: 2, title: 'x', done: true })).toEqual({ number: 0, title: '', done: false })
  })

  it('gives a new section or article an id no other part has', () => {
    const root = { sections: [{ id: 'phan-a', articles: [{ id: 'dieu-1' }, { id: 'dieu-7' }] }] }
    expect(freshId(root, 'articles')).toBe('dieu-8')
    expect(freshId(root, 'sections')).toBe('phan-1')
    expect(freshId({ sections: [{ id: 'phan-1' }] }, 'sections')).toBe('phan-2')
  })

  it('starts each document layout with the keys it reads', () => {
    expect(Object.keys(documentTemplate('static'))).toEqual(['header', 'sections'])
    expect(Object.keys(documentTemplate('fee'))).toEqual(['blocks'])
    expect(Object.keys(documentTemplate('legal-document'))).toEqual(['header', 'sections', 'note'])
  })

  it('offers the parts a document’s layout reads that it has not got yet', () => {
    const keys = (found: { key: string }[]) => found.map((option) => option.key)
    expect(keys(optionalKeys([], { header: {}, sections: [] }, 'static'))).toEqual(['note', 'footer'])
    expect(keys(optionalKeys(['header'], { img: '', h1: '' }, 'static'))).toEqual(['intro'])
    expect(keys(optionalKeys(['sections', 0], { id: 'a', title: 'A', articles: [] }, 'static'))).toEqual(['blocks'])
    expect(keys(optionalKeys(['sections', 0, 'articles', 1, 'blocks', 0, 'items', 2], { text: 'x' }, 'static'))).toEqual([
      'children',
    ])
    expect(keys(optionalKeys([], {}, 'template', 'data'))).toEqual(['bannerVideoHlsSrc'])
  })

  it('reads the text, or says why it cannot', () => {
    expect(parseObject('')).toEqual({ ok: true, value: {} })
    expect(parseObject('[1]')).toEqual({ ok: false, error: 'not-object' })
    expect(parseObject('{').ok).toBe(false)
  })
})

describe('the forms (structured)', () => {
  const editorOf = (fields: Parameters<typeof dataFields>[0], name: string) => {
    const field = dataFields(fields).find((candidate) => candidate.name === name) as {
      admin?: { components?: { Field?: { path?: string; clientProps?: { shape?: string } } } }
    }
    return field?.admin?.components?.Field
  }

  it('edit a popup’s content and a page’s own data as forms', () => {
    expect(editorOf(CvpDocuments.fields, 'content')).toMatchObject({
      path: '/admin/components/cvp/structured/JsonFormField#JsonFormField',
      clientProps: { shape: 'document' },
    })
    expect(editorOf(CvpPages.fields, 'extra')).toMatchObject({ clientProps: { shape: 'data' } })
  })
})
