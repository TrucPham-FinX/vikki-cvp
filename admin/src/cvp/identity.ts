import type { CollectionBeforeValidateHook, Field } from 'payload'

import { cvpMapping } from './fields'
import { DEFAULT_LOCALE, LOCALE_LABELS, LOCALES } from './locales'
import { LOCALE_TOKEN } from './repo-data'

const PAGE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const FILE = /^(?:\{locale\}|[a-z0-9]+(?:-[a-z0-9]+)*(?:-\{locale\})?)\.json$/

const exclude = cvpMapping({ exclude: true })

/**
 * Where a page's or document's JSON lives: front-end/data/<page>/<file>, one file per language
 * when the name has {locale}. Not part of the JSON itself.
 *
 * Both are picked (PageField: the folders the admin knows; FileField: the names the CVP uses, by
 * `kind`), and either can still be typed; the checks below are the server's.
 */
export const identityFields = (kind: 'page' | 'document'): Field[] => [
  {
    type: 'row',
    fields: [
      {
        name: 'page',
        label: 'Trang (thư mục)',
        type: 'text',
        required: true,
        index: true,
        custom: exclude,
        admin: {
          width: '50%',
          description: 'Thư mục của trang trên CDN, VD vikki-go-plus-cvp.',
          components: { Field: '/admin/components/cvp/fields/PageField#PageField' },
        },
        validate: (value: unknown) =>
          typeof value === 'string' && PAGE.test(value)
            ? true
            : 'Chữ thường không dấu, số và dấu gạch ngang.',
      },
      {
        name: 'file',
        label: 'File dữ liệu',
        type: 'text',
        required: true,
        custom: exclude,
        admin: {
          width: '50%',
          description: `Có ${LOCALE_TOKEN} trong tên: mỗi ngôn ngữ một file.`,
          components: {
            Field: { path: '/admin/components/cvp/fields/FileField#FileField', clientProps: { kind } },
          },
        },
        validate: (value: unknown) =>
          typeof value === 'string' && FILE.test(value)
            ? true
            : `Dạng index.json, tc.json, ${LOCALE_TOKEN}.json hoặc tc-${LOCALE_TOKEN}.json.`,
      },
    ],
  },
  {
    type: 'row',
    fields: [
      {
        // Not `locales`: Payload names the table of a collection's localized fields <slug>_locales
        name: 'languages',
        label: 'Ngôn ngữ xuất bản',
        type: 'select',
        hasMany: true,
        required: true,
        defaultValue: [DEFAULT_LOCALE],
        options: LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code] })),
        custom: exclude,
        admin: {
          description: `Những bản được xuất bản. Chỉ file có ${LOCALE_TOKEN} mới có nhiều ngôn ngữ.`,
        },
        validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) => {
          const languages = Array.isArray(value) ? value : []
          if (!languages.length) return 'Chọn ít nhất một ngôn ngữ.'
          const file = typeof siblingData?.file === 'string' ? siblingData.file : ''
          if (!file.includes(LOCALE_TOKEN) && (languages.length > 1 || languages[0] !== DEFAULT_LOCALE)) {
            return `File không có ${LOCALE_TOKEN} chỉ có bản ${LOCALE_LABELS[DEFAULT_LOCALE]}.`
          }
          return true
        },
      },
    ],
  },
  {
    name: 'key',
    type: 'text',
    unique: true,
    index: true,
    custom: exclude,
    admin: { hidden: true },
  },
]

/** `key` = <page>/<file>: one document per data file */
export const setKey: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const page = data.page ?? originalDoc?.page
  const file = data.file ?? originalDoc?.file
  if (typeof page === 'string' && typeof file === 'string') data.key = `${page}/${file}`
  return data
}
