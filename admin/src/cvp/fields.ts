import type { Block, Field } from 'payload'

export type DataObject = Record<string, unknown>

/**
 * How a field maps to the CVP's JSON (front-end/data), in `custom.cvp`:
 * - dataKey: the JSON key when it is not the field's name (`id` belongs to Payload's rows)
 * - extra:   a json field that keeps every key no other field takes, so an import loses nothing
 * - exclude: not in the JSON (where the file is, sort order)
 */
export type CvpFieldMapping = { dataKey?: string; extra?: boolean; exclude?: boolean }

export const cvpMapping = (mapping: CvpFieldMapping) => ({ cvp: mapping })

/**
 * The extra field: the keys no other field takes, kept as JSON text. Not a json field, because
 * Postgres stores those as jsonb, which sorts an object's keys; a page printing one with {{json}}
 * would change, and every rewritten data file would have its keys shuffled.
 */
export function extraJsonField(options: {
  name: string
  label: string
  localized?: boolean
  required?: boolean
  description?: string
  position?: 'sidebar'
  /** `document`: a popup's content, which can start from its layout's template */
  shape?: 'document' | 'data'
}): Field {
  const { name, label, localized, required, description, position, shape = 'data' } = options
  return {
    name,
    label,
    type: 'code',
    localized,
    required,
    custom: cvpMapping({ extra: true }),
    admin: {
      language: 'json',
      description,
      position,
      // A form over the JSON, with the text one click away (JsonFormField)
      components: {
        Field: { path: '/admin/components/cvp/structured/JsonFormField#JsonFormField', clientProps: { shape } },
      },
    },
    validate: (value: unknown) => {
      if (typeof value !== 'string' || !value.trim()) return required ? 'Bắt buộc.' : true
      try {
        return isPlainObject(JSON.parse(value)) ? true : 'Phải là một object JSON: { … }.'
      } catch (error) {
        return `JSON không hợp lệ: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  }
}

type NamedField = Extract<Field, { name: string }>

const mappingOf = (field: Field): CvpFieldMapping =>
  ((field as { custom?: { cvp?: CvpFieldMapping } }).custom?.cvp ?? {}) as CvpFieldMapping

export const isPlainObject = (value: unknown): value is DataObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// The dates of a promotion as the JSON has them, which is also how Payload returns a date field
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/**
 * Fields Payload adds itself when it sanitizes the config (on getPayload): every array and block
 * row gets an `id` (its primary key in Postgres) and blocks a `blockName`; collections their
 * timestamps. None is in the CVP's JSON, and a JSON key `id` must never become a row's id.
 */
const PAYLOAD_FIELDS = new Set(['id', 'blockName', 'createdAt', 'updatedAt', '_status'])

/** The fields holding data, with rows, collapsibles and unnamed tabs opened up and ui fields left out */
export function dataFields(fields: Field[]): NamedField[] {
  return fields.flatMap((field): NamedField[] => {
    if (field.type === 'ui') return []
    if ('name' in field && PAYLOAD_FIELDS.has(field.name)) return []
    if (field.type === 'row' || field.type === 'collapsible') return dataFields(field.fields)
    if (field.type === 'tabs') {
      return field.tabs.flatMap((tab) => {
        if ('name' in tab && tab.name) {
          return [{ ...tab, type: 'group' } as unknown as NamedField]
        }
        return dataFields(tab.fields)
      })
    }
    return 'name' in field ? [field as NamedField] : []
  })
}

const extraFieldOf = (fields: NamedField[]) => fields.find((field) => mappingOf(field).extra)

const SKIP = Symbol('skip')

/** One JSON value as the field stores it, or SKIP when the field cannot hold it */
function toFieldValue(value: unknown, field: NamedField, at: string): unknown {
  if (value === null || value === undefined) return SKIP
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'code':
    case 'email':
      return typeof value === 'string' ? value : SKIP
    case 'select': {
      if (field.hasMany) return SKIP
      const options = field.options.map((option) => (typeof option === 'string' ? option : option.value))
      return typeof value === 'string' && options.includes(value) ? value : SKIP
    }
    case 'number':
      return typeof value === 'number' ? value : SKIP
    case 'checkbox':
      return typeof value === 'boolean' ? value : SKIP
    case 'date':
      return typeof value === 'string' && ISO_DATE.test(value) ? value : SKIP
    case 'json':
      return value
    case 'group':
      return isPlainObject(value) ? toFieldValues(value, field.fields, at) : SKIP
    case 'array':
      return Array.isArray(value) && value.every(isPlainObject)
        ? value.map((item, index) => toFieldValues(item, field.fields, `${at}[${index}]`))
        : SKIP
    case 'blocks': {
      if (!Array.isArray(value) || !value.every(isPlainObject)) return SKIP
      const blocks = (field.blocks ?? []) as Block[]
      return value.map((item, index) => {
        const { type, ...rest } = item
        const block = blocks.find((candidate) => candidate.slug === type)
        if (!block) {
          throw new Error(
            `${at}[${index}]: no block for type ${JSON.stringify(type)} (known: ${blocks.map((b) => b.slug).join(', ')})`,
          )
        }
        return { blockType: block.slug, ...toFieldValues(rest, block.fields, `${at}[${index}]<${block.slug}>`) }
      })
    }
    default:
      return SKIP
  }
}

/**
 * A JSON object of front-end/data as the values of `fields`. A key no field takes goes into the
 * fields' extra json field; without one it is an error, so nothing is dropped on the way in.
 */
export function toFieldValues(data: DataObject, fields: Field[], at = '$'): DataObject {
  const named = dataFields(fields)
  const values: DataObject = {}
  const taken = new Set<string>()

  for (const field of named) {
    const mapping = mappingOf(field)
    if (mapping.extra || mapping.exclude) continue
    const key = mapping.dataKey ?? field.name
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue
    const value = toFieldValue(data[key], field, `${at}.${key}`)
    if (value === SKIP) continue
    values[field.name] = value
    taken.add(key)
  }

  const rest = Object.keys(data).filter((key) => !taken.has(key))
  if (rest.length) {
    const extra = extraFieldOf(named)
    if (!extra) {
      throw new Error(`${at}: no field for ${rest.map((key) => JSON.stringify(key)).join(', ')}`)
    }
    const kept = Object.fromEntries(rest.map((key) => [key, data[key]]))
    values[extra.name] = extra.type === 'code' ? JSON.stringify(kept, null, 2) : kept
  }
  return values
}

/** What the extra field holds, as an object (it may be JSON text) */
function extraValue(field: NamedField, value: unknown): DataObject | undefined {
  if (field.type === 'code') {
    if (typeof value !== 'string' || !value.trim()) return undefined
    const parsed: unknown = JSON.parse(value)
    if (!isPlainObject(parsed)) throw new Error(`${field.name}: not a JSON object`)
    return parsed
  }
  return isPlainObject(value) ? value : undefined
}

/** One stored value as JSON, or undefined when the JSON should not have the key */
function fromFieldValue(value: unknown, field: NamedField): unknown {
  if (value === null || value === undefined) return undefined
  switch (field.type) {
    case 'group': {
      const data = fromFieldValues(value as DataObject, field.fields)
      return Object.keys(data).length ? data : undefined
    }
    case 'array':
      return Array.isArray(value) && value.length
        ? value.map((item) => fromFieldValues(item as DataObject, field.fields))
        : undefined
    case 'blocks': {
      if (!Array.isArray(value) || !value.length) return undefined
      const blocks = (field.blocks ?? []) as Block[]
      return value.map((item: DataObject) => {
        const block = blocks.find((candidate) => candidate.slug === item.blockType)
        if (!block) throw new Error(`No block for stored blockType ${JSON.stringify(item.blockType)}`)
        return { type: block.slug, ...fromFieldValues(item, block.fields) }
      })
    }
    default:
      return value
  }
}

/** The values of `fields` back as the JSON object of front-end/data: the reverse of toFieldValues */
export function fromFieldValues(values: DataObject | null | undefined, fields: Field[]): DataObject {
  const data: DataObject = {}
  if (!values) return data
  const named = dataFields(fields)

  for (const field of named) {
    const mapping = mappingOf(field)
    if (mapping.extra || mapping.exclude) continue
    const value = fromFieldValue(values[field.name], field)
    if (value !== undefined) data[mapping.dataKey ?? field.name] = value
  }

  const extra = extraFieldOf(named)
  const kept = extra ? extraValue(extra, values[extra.name]) : undefined
  if (kept) {
    for (const [key, value] of Object.entries(kept)) {
      if (!(key in data)) data[key] = value
    }
  }
  return data
}
