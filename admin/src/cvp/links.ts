import fs from 'fs'
import type { Payload } from 'payload'

import type { ChoiceKey, LinkGroup, LinkOption, LinkTargets } from '../contracts/cvp'
import { PAGE_NAME } from './assetPaths'
import { linkedCategories, splitCodes } from './codes'
import { isPlainObject, type DataObject } from './fields'
import { DEFAULT_LOCALE, LOCALES, type Locale } from './locales'
import { repoPaths } from './paths'
import { builtFileOf } from './preview'
import { isLocalizedFile, type DataEntry } from './repo-data'
import { readFileDocs } from './store'

/**
 * What a link field of the edit forms can point at (admin/components/cvp/fields/LinkField.tsx):
 * every popup document and page, promotion and card intro, by the address its HTML gets on the
 * CDN (`/vikki-cvp/<page>/tc.html`) — the very string the data files keep today, so picking one
 * writes the same JSON as typing it did.
 */

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)

/** An entry's name in `locale`: its title there, else in Vietnamese, else in any language */
function titleOf(entry: DataEntry, locale: Locale): string | null {
  const title = (data: DataObject | undefined) => text(data?.title) ?? text(data?.pageTitle)
  return (
    title(entry.byLocale[locale]) ??
    title(entry.byLocale[DEFAULT_LOCALE]) ??
    LOCALES.map((code) => title(entry.byLocale[code])).find(Boolean) ??
    null
  )
}

/**
 * An entry's addresses: one for a single-language file; for a file built per language, the
 * address that follows `?lang` (`<page>/tc.html`, the `auto` option) and each language's copy.
 * An entry without a title is named by that address.
 */
export function entryOptions(entry: DataEntry, locale: Locale): LinkOption[] {
  const title = titleOf(entry, locale)
  if (!isLocalizedFile(entry.file)) {
    const built = builtFileOf(entry, DEFAULT_LOCALE)
    return built ? [{ value: `/vikki-cvp/${built}`, label: title ?? built }] : []
  }
  const copies = LOCALES.flatMap((code) => {
    const built = builtFileOf(entry, code)
    return built ? [{ code, built }] : []
  })
  if (!copies.length) return []
  const { code, built } = copies[0]!
  const auto = built.replace(`/${code}/`, '/')
  const label = title ?? auto
  return [
    { value: `/vikki-cvp/${auto}`, label, lang: 'auto' },
    ...copies.map(({ code: lang, built: file }) => ({ value: `/vikki-cvp/${file}`, label, lang })),
  ]
}

/** Options sharing a name (two pages titled alike) get their address after it, to tell them apart */
export function disambiguate(options: LinkOption[]): LinkOption[] {
  const key = (option: LinkOption) => `${option.label}\u0000${option.lang ?? ''}`
  const count = new Map<string, number>()
  for (const option of options) count.set(key(option), (count.get(key(option)) ?? 0) + 1)
  return options.map((option) =>
    (count.get(key(option)) ?? 0) > 1
      ? { ...option, label: `${option.label} (${option.value.replace(/^\/vikki-cvp\//, '')})` }
      : option,
  )
}

type ListItem = DataObject

/** The groups of places, in the order the pickers list them; empty groups left out */
export function linkGroups(input: {
  pages: DataEntry[]
  documents: DataEntry[]
  promotions: ListItem[]
  cardIntros: ListItem[]
  locale: Locale
}): LinkGroup[] {
  const { pages, documents, promotions, cardIntros, locale } = input
  const byName = (a: LinkOption, b: LinkOption) => a.label.localeCompare(b.label, 'vi')
  // The list filters by one code (`?category=VIKKI_ONE`), and an item has several
  const categories = promotionCategories(promotions, pages)
  const groups: LinkGroup[] = [
    { key: 'documents', options: documents.flatMap((entry) => entryOptions(entry, locale)) },
    { key: 'pages', options: pages.flatMap((entry) => entryOptions(entry, locale)) },
    {
      key: 'promotions',
      options: promotions.flatMap((item) => {
        const id = text(item.promoId)
        return id ? [{ value: `/vikki-cvp/promotion/${id}.html`, label: text(item.name) ?? id }] : []
      }),
    },
    {
      key: 'promotionLists',
      // The list page, whole or filtered to one category (label: the category, '' for all)
      options: promotions.length
        ? [
            { value: '/vikki-cvp/promotion/list.html', label: '' },
            ...categories.map((category) => ({
              value: `/vikki-cvp/promotion/list.html?category=${category}`,
              label: category,
            })),
          ]
        : [],
    },
    {
      key: 'cardIntros',
      options: cardIntros
        .flatMap((item) => {
          const id = text(item.cardId)
          return id ? [{ value: `/vikki-cvp/card-intro/${id}.html`, label: text(item.name) ?? id }] : []
        })
        .sort(byName),
    },
  ]
  for (const group of groups) {
    if (group.key === 'documents' || group.key === 'pages') group.options.sort(byName)
    if (group.key !== 'promotionLists') group.options = disambiguate(group.options)
  }
  return groups.filter((group) => group.options.length)
}

/** Every promotion category: those the items have, and those the pages' links filter by */
function promotionCategories(promotions: ListItem[], pages: DataEntry[]): string[] {
  return [
    ...new Set([
      ...promotions.flatMap((item) => splitCodes(item.promotionCate)),
      ...pages.flatMap((entry) => linkedCategories(entry.byLocale)),
    ]),
  ].sort()
}

/** The codes each choice field of the promotion and card intro forms offers */
export function choiceValues(input: {
  pages: DataEntry[]
  promotions: ListItem[]
  cardIntros: ListItem[]
}): Record<ChoiceKey, string[]> {
  const codes = (items: ListItem[], key: string) =>
    [...new Set(items.flatMap((item) => splitCodes(item[key])))].sort()
  return {
    promotionCate: promotionCategories(input.promotions, input.pages),
    promotionGroup: codes(input.promotions, 'promotionGroup'),
    cardGroup: codes(input.cardIntros, 'cardGroup'),
  }
}

/** The page folders the admin knows: its pages' and documents', and every folder of vikki-cvp/ */
function pageFolders(entries: DataEntry[]): string[] {
  const names = new Set(entries.map((entry) => entry.page))
  try {
    for (const entry of fs.readdirSync(repoPaths().output, { withFileTypes: true })) {
      if (entry.isDirectory() && PAGE_NAME.test(entry.name)) names.add(entry.name)
    }
  } catch {
    // No vikki-cvp/ checked out: the admin's own pages are enough
  }
  return [...names].sort()
}

/** Everything a link field offers, titles in the content language `locale` */
export async function readLinkTargets(payload: Payload, locale: Locale): Promise<LinkTargets> {
  const list = async (collection: 'promotions' | 'card-intros') =>
    (
      await payload.find({
        collection,
        sort: ['sortOrder', 'createdAt'],
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
    ).docs.filter(isPlainObject) as unknown as ListItem[]
  const [pages, documents, promotions, cardIntros] = await Promise.all([
    readFileDocs(payload, 'pages'),
    readFileDocs(payload, 'documents'),
    list('promotions'),
    list('card-intros'),
  ])
  return {
    pages: pageFolders([...pages, ...documents]),
    groups: linkGroups({ pages, documents, promotions, cardIntros, locale }),
    choices: choiceValues({ pages, promotions, cardIntros }),
  }
}
