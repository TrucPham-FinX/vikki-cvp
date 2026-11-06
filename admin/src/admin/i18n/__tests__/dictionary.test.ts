import { describe, expect, it } from 'vitest'

import { DICTIONARIES, translate, type TranslationKey } from '../dictionary'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

describe('the dictionary', () => {
  const vi = DICTIONARIES.vi!
  const en = DICTIONARIES.en!

  it('gives every key the same placeholders in both languages', () => {
    const drift = (Object.keys(vi) as TranslationKey[]).filter(
      (key) => placeholders(vi[key]).join() !== placeholders(en[key]).join(),
    )
    expect(drift).toEqual([])
  })

  it('leaves no key empty', () => {
    for (const dict of [vi, en]) {
      expect(Object.entries(dict).filter(([, text]) => !text.trim())).toEqual([])
    }
  })

  it('fills placeholders and falls back to Vietnamese for an unknown language', () => {
    expect(translate('en', 'catalog.range', { from: 1, to: 20, total: 53 })).toBe('1–20 of 53')
    expect(translate('fr', 'nav.pages')).toBe(vi['nav.pages'])
    expect(translate(undefined, 'catalog.count', { n: 3 })).toBe('3 mục')
  })
})
