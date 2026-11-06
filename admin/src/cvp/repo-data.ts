import fs from 'fs'
import path from 'path'
import { isDeepStrictEqual } from 'util'

import { isPlainObject, type DataObject } from './fields'
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from './locales'

/** Where the language goes in the name of a data file of a page built per language */
export const LOCALE_TOKEN = '{locale}'

/**
 * One data file of front-end/data, in every language it is written in. A page built per language
 * (front-end/build.js, buildLocalePage) has `<lang>.json` and `<template>-<lang>.json`, kept here as
 * `{locale}.json` and `<template>-{locale}.json`; any other file is in DEFAULT_LOCALE only.
 */
export type DataEntry = {
  /** The page's folder, in front-end/data, front-end/pages and vikki-cvp */
  page: string
  /** The file's name, with {locale} where the language goes: 'tc-{locale}.json', 'index.json' */
  file: string
  byLocale: Partial<Record<Locale, DataObject>>
}

export type DataKind = 'pages' | 'documents' | 'promotions' | 'cardIntros'

/** The layouts of the CVP's documents (T&C, fees, rules): the popups' pages */
export const DOCUMENT_LAYOUTS = ['static', 'fee', 'legal-document']

export const isLocalizedFile = (file: string) => file.includes(LOCALE_TOKEN)

/** The file's name in one language */
export const fileIn = (file: string, locale: Locale) => file.replace(LOCALE_TOKEN, locale)

export const entryKey = (entry: Pick<DataEntry, 'page' | 'file'>) => `${entry.page}/${entry.file}`

/** Which collection holds a data file */
export function kindOf(entry: Pick<DataEntry, 'page' | 'file' | 'byLocale'>): DataKind {
  if (entry.file === 'list.json' && entry.page === 'promotion') return 'promotions'
  if (entry.file === 'list.json' && entry.page === 'card-intro') return 'cardIntros'
  const layouts = Object.values(entry.byLocale).map((data) => data?.layout)
  return layouts.some((layout) => DOCUMENT_LAYOUTS.includes(layout as string)) ? 'documents' : 'pages'
}

/** Every JSON data file under `dataDir`, grouped across languages */
export function readDataDir(dataDir: string): DataEntry[] {
  const entries = new Map<string, DataEntry>()
  const pages = fs
    .readdirSync(dataDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  for (const page of pages) {
    const dir = path.join(dataDir, page)
    const names = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .sort()
    // As the build decides: a page with a data file named after a language is built per language
    const perLanguage = names.some((name) => isLocale(name.slice(0, -'.json'.length)))

    for (const name of names) {
      const base = name.slice(0, -'.json'.length)
      let file = name
      let locale: Locale = DEFAULT_LOCALE
      if (isLocale(base)) {
        file = `${LOCALE_TOKEN}.json`
        locale = base
      } else if (perLanguage) {
        const match = /^(.+)-([a-z]{2})$/.exec(base)
        if (match && isLocale(match[2])) {
          file = `${match[1]}-${LOCALE_TOKEN}.json`
          locale = match[2]
        }
      }

      const data: unknown = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))
      if (!isPlainObject(data)) throw new Error(`${page}/${name}: not a JSON object`)

      const key = entryKey({ page, file })
      const entry = entries.get(key) ?? { page, file, byLocale: {} }
      entry.byLocale[locale] = data
      entries.set(key, entry)
    }
  }
  return [...entries.values()]
}

/** The files an entry writes: path under the data folder → JSON */
export function entryFiles(entry: DataEntry): [string, DataObject][] {
  return LOCALES.filter((locale) => entry.byLocale[locale])
    .filter((locale) => isLocalizedFile(entry.file) || locale === DEFAULT_LOCALE)
    .map((locale) => [path.join(entry.page, fileIn(entry.file, locale)), entry.byLocale[locale]!])
}

export type WriteReport = {
  /** Written because its JSON changed, or new */
  written: string[]
  unchanged: string[]
  /** JSON files in the data folder no entry writes (removed when `prune`) */
  stale: string[]
  removed: string[]
}

/**
 * Writes the entries into `dataDir`. A file whose JSON is the same (whatever the key order or
 * formatting) is left as it is, so the repo only changes where the content did.
 */
export function writeDataDir(
  dataDir: string,
  entries: DataEntry[],
  { prune = false, dryRun = false }: { prune?: boolean; dryRun?: boolean } = {},
): WriteReport {
  const report: WriteReport = { written: [], unchanged: [], stale: [], removed: [] }
  const wanted = new Map(entries.flatMap(entryFiles))

  for (const [rel, data] of wanted) {
    const full = path.join(dataDir, rel)
    if (fs.existsSync(full)) {
      let current: unknown
      try {
        current = JSON.parse(fs.readFileSync(full, 'utf8'))
      } catch {
        current = undefined
      }
      if (isDeepStrictEqual(current, data)) {
        report.unchanged.push(rel)
        continue
      }
    }
    if (!dryRun) {
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`)
    }
    report.written.push(rel)
  }

  if (fs.existsSync(dataDir)) {
    for (const page of fs.readdirSync(dataDir, { withFileTypes: true })) {
      if (!page.isDirectory()) continue
      for (const name of fs.readdirSync(path.join(dataDir, page.name))) {
        const rel = path.join(page.name, name)
        if (!name.endsWith('.json') || wanted.has(rel)) continue
        report.stale.push(rel)
        if (prune && !dryRun) {
          fs.unlinkSync(path.join(dataDir, rel))
          report.removed.push(rel)
        }
      }
    }
  }
  return report
}
