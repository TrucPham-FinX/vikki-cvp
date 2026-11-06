import type { Field } from 'payload'

import { CardIntros } from '../collections/CardIntros'
import { CvpDocuments } from '../collections/CvpDocuments'
import { CvpPages } from '../collections/CvpPages'
import { Promotions } from '../collections/Promotions'
import { fromFieldValues, isPlainObject, toFieldValues, type DataObject } from './fields'
import { DEFAULT_LOCALE, LOCALES, type Locale } from './locales'
import { fileIn, kindOf, type DataEntry } from './repo-data'

/** A page or document as Payload stores it: where its file is, and its fields in each language */
export type FileDoc = {
  page: string
  file: string
  languages: Locale[]
  byLocale: Partial<Record<Locale, DataObject>>
}

/** A list file (promotion/list.json, card-intro/list.json): its items in order, and the rest */
export type ListDoc = {
  list: DataObject
  items: DataObject[]
}

export const FILE_COLLECTIONS = {
  pages: { slug: 'cvp-pages', fields: CvpPages.fields },
  documents: { slug: 'cvp-documents', fields: CvpDocuments.fields },
} as const

export const LIST_COLLECTIONS = {
  promotions: { slug: 'promotions', fields: Promotions.fields, page: 'promotion', globalField: 'promotionList' },
  cardIntros: { slug: 'card-intros', fields: CardIntros.fields, page: 'card-intro', globalField: 'cardIntroList' },
} as const

export type FileKind = keyof typeof FILE_COLLECTIONS
export type ListKind = keyof typeof LIST_COLLECTIONS

const languagesOf = (entry: DataEntry) => LOCALES.filter((locale) => entry.byLocale[locale])

/** A data file as a page or document */
export function entryToFileDoc(entry: DataEntry, fields: Field[]): FileDoc {
  const languages = languagesOf(entry)
  return {
    page: entry.page,
    file: entry.file,
    languages,
    byLocale: Object.fromEntries(
      languages.map((locale) => [
        locale,
        toFieldValues(entry.byLocale[locale]!, fields, `${entry.page}/${fileIn(entry.file, locale)}`),
      ]),
    ),
  }
}

/** A page or document back as its data file, in the languages it is published in */
export function fileDocToEntry(doc: FileDoc, fields: Field[]): DataEntry {
  return {
    page: doc.page,
    file: doc.file,
    byLocale: Object.fromEntries(
      doc.languages
        .filter((locale) => doc.byLocale[locale])
        .map((locale) => [locale, fromFieldValues(doc.byLocale[locale], fields)]),
    ),
  }
}

/** A list file as its items' field values (in order) and the rest */
export function entryToListDoc(entry: DataEntry, fields: Field[]): ListDoc {
  const data = entry.byLocale[DEFAULT_LOCALE]
  if (!data) throw new Error(`${entry.page}/${entry.file}: no ${DEFAULT_LOCALE} file`)
  const { items, ...list } = data
  if (!Array.isArray(items) || !items.every(isPlainObject)) {
    throw new Error(`${entry.page}/${entry.file}: "items" is not a list of objects`)
  }
  return {
    list,
    items: items.map((item, index) =>
      toFieldValues(item, fields, `${entry.page}/${entry.file}.items[${index}]`),
    ),
  }
}

/** A list file back from its items (already in order) and the rest */
export function listDocToEntry(page: string, doc: ListDoc, fields: Field[]): DataEntry {
  return {
    page,
    file: 'list.json',
    byLocale: {
      [DEFAULT_LOCALE]: { ...doc.list, items: doc.items.map((item) => fromFieldValues(item, fields)) },
    },
  }
}

/** Every data file split by the collection that holds it */
export function splitEntries(entries: DataEntry[]) {
  const split = {
    pages: [] as DataEntry[],
    documents: [] as DataEntry[],
    promotions: undefined as DataEntry | undefined,
    cardIntros: undefined as DataEntry | undefined,
  }
  for (const entry of entries) {
    const kind = kindOf(entry)
    if (kind === 'promotions' || kind === 'cardIntros') split[kind] = entry
    else split[kind].push(entry)
  }
  return split
}

/**
 * The whole data folder through the field mappings and back, without a database: what an
 * import followed by an export gives when Payload keeps every value it is given.
 */
export function roundTripEntries(entries: DataEntry[]): DataEntry[] {
  const split = splitEntries(entries)
  const out: DataEntry[] = []
  for (const kind of ['pages', 'documents'] as const) {
    const { fields } = FILE_COLLECTIONS[kind]
    for (const entry of split[kind]) out.push(fileDocToEntry(entryToFileDoc(entry, fields), fields))
  }
  for (const kind of ['promotions', 'cardIntros'] as const) {
    const entry = split[kind]
    if (!entry) continue
    const { fields, page } = LIST_COLLECTIONS[kind]
    out.push(listDocToEntry(page, entryToListDoc(entry, fields), fields))
  }
  return out
}
