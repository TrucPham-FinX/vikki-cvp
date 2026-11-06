import type { Payload, Where } from 'payload'

import { isPlainObject, type DataObject } from './fields'
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from './locales'
import {
  entryToFileDoc,
  entryToListDoc,
  FILE_COLLECTIONS,
  fileDocToEntry,
  LIST_COLLECTIONS,
  listDocToEntry,
  splitEntries,
  type FileDoc,
  type FileKind,
  type ListKind,
} from './mapping'
import type { DataEntry } from './repo-data'

/**
 * The CVP data in Payload: written from front-end/data (import) and read back as its files
 * (export). Through the Local API, so access control does not apply: callers check the user.
 */

// Not given to Payload: it fills them itself
const STORED_ONLY = ['id', 'createdAt', 'updatedAt', '_status', 'key']

export const strip = (doc: DataObject) =>
  Object.fromEntries(Object.entries(doc).filter(([key]) => !STORED_ONLY.includes(key)))

export type ImportReport = Record<FileKind | ListKind, number>

/** Runs one write, naming the data file and Payload's field errors when it fails */
async function writing<T>(what: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (error) {
    const details = (error as { data?: { errors?: unknown } }).data?.errors
    throw new Error(
      `${what}: ${error instanceof Error ? error.message : String(error)}${details ? ` ${JSON.stringify(details)}` : ''}`,
      { cause: error },
    )
  }
}

/** Replaces everything in the CVP collections with the data files */
export async function importEntries(payload: Payload, entries: DataEntry[]): Promise<ImportReport> {
  const split = splitEntries(entries)
  const report: ImportReport = { pages: 0, documents: 0, promotions: 0, cardIntros: 0 }

  for (const { slug } of [...Object.values(FILE_COLLECTIONS), ...Object.values(LIST_COLLECTIONS)]) {
    await payload.delete({ collection: slug, where: { id: { exists: true } }, overrideAccess: true })
  }

  for (const kind of ['pages', 'documents'] as const) {
    const { slug, fields } = FILE_COLLECTIONS[kind]
    for (const entry of split[kind]) {
      const doc = entryToFileDoc(entry, fields)
      const [first, ...others] = doc.languages
      const name = `${doc.page}/${doc.file}`
      const created = await writing(`${name} (${first})`, () =>
        payload.create({
          collection: slug,
          locale: first,
          overrideAccess: true,
          data: { page: doc.page, file: doc.file, languages: doc.languages, ...doc.byLocale[first] },
        }),
      )
      for (const locale of others) {
        await writing(`${name} (${locale})`, () =>
          payload.update({
            collection: slug,
            id: created.id,
            locale,
            overrideAccess: true,
            data: doc.byLocale[locale]!,
          }),
        )
      }
      report[kind]++
    }
  }

  const lists: DataObject = {}
  for (const kind of ['promotions', 'cardIntros'] as const) {
    const entry = split[kind]
    if (!entry) continue
    const { slug, fields, globalField } = LIST_COLLECTIONS[kind]
    const { list, items } = entryToListDoc(entry, fields)
    lists[globalField] = list
    for (const [index, item] of items.entries()) {
      // One collection at a time: the cast keeps TypeScript off the union of both
      await payload.create({
        collection: slug as 'promotions',
        overrideAccess: true,
        data: { ...item, sortOrder: (index + 1) * 10 } as never,
      })
      report[kind]++
    }
  }
  await payload.updateGlobal({ slug: 'cvp-lists', data: lists, overrideAccess: true })
  return report
}

/**
 * Pages or documents as Payload keeps them — where each file goes and its fields in every
 * language, without falling back — keyed by id. `where` narrows them (the preview reads one page
 * folder).
 */
export async function readFileDocsWhere(
  payload: Payload,
  kind: FileKind,
  where?: Where,
): Promise<{ id: string; doc: FileDoc }[]> {
  const { slug } = FILE_COLLECTIONS[kind]
  const byLocale = new Map<string, Partial<Record<Locale, DataObject>>>()
  let meta: DataObject[] = []

  for (const locale of LOCALES) {
    const { docs } = await payload.find({
      collection: slug,
      locale,
      fallbackLocale: false,
      depth: 0,
      pagination: false,
      overrideAccess: true,
      where,
    })
    const rows = docs as unknown as DataObject[]
    if (locale === DEFAULT_LOCALE) meta = rows
    for (const doc of rows) {
      const id = String(doc.id)
      byLocale.set(id, { ...byLocale.get(id), [locale]: strip(doc) })
    }
  }

  return meta.map((doc) => ({
    id: String(doc.id),
    doc: {
      page: String(doc.page),
      file: String(doc.file),
      languages: (Array.isArray(doc.languages) ? doc.languages : [DEFAULT_LOCALE]).filter(isLocale),
      byLocale: byLocale.get(String(doc.id)) ?? {},
    },
  }))
}

/** Every page and document, in each language it is published in, without falling back */
export async function readFileDocs(payload: Payload, kind: FileKind): Promise<DataEntry[]> {
  const { fields } = FILE_COLLECTIONS[kind]
  return (await readFileDocsWhere(payload, kind)).map(({ doc }) => fileDocToEntry(doc, fields))
}

/** A list collection's items in order, with the rest of its file from the global */
async function readListDoc(payload: Payload, kind: ListKind, lists: DataObject): Promise<DataEntry> {
  const { slug, fields, page, globalField } = LIST_COLLECTIONS[kind]
  const { docs } = await payload.find({
    collection: slug,
    sort: ['sortOrder', 'createdAt'],
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const list = isPlainObject(lists[globalField]) ? (lists[globalField] as DataObject) : {}
  return listDocToEntry(page, { list, items: (docs as unknown as DataObject[]).map(strip) }, fields)
}

/** The CVP data in Payload as the files of front-end/data */
export async function exportEntries(payload: Payload): Promise<DataEntry[]> {
  const lists = (await payload.findGlobal({ slug: 'cvp-lists', overrideAccess: true })) as unknown as DataObject
  return [
    ...(await readFileDocs(payload, 'pages')),
    ...(await readFileDocs(payload, 'documents')),
    await readListDoc(payload, 'promotions', lists),
    await readListDoc(payload, 'cardIntros', lists),
  ]
}
