/**
 * The code fields of promotions and card intros (`promotionCate`, `promotionGroup`, `cardGroup`):
 * upper-case codes such as VIKKI_ONE. A promotion's categories are several codes in one string
 * (`VIKKIGO_PLUS,VIKKI_ONE`), which promotion/list.html filters with `?category=<code>`
 * (front-end/pages/promotion/list.hbs). No Node imports: the picker runs in the browser.
 */

/** The codes of a field's value, in order, without repeats: `"A, B,A"` → `["A", "B"]` */
export function splitCodes(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return [...new Set(value.split(/[\s,]+/).filter(Boolean))]
}

/** Several codes as the data files write them: comma, no space */
export const joinCodes = (codes: string[]) => codes.join(',')

/** A typed code the way the others are written: `vikki go+` → `VIKKI_GO` */
export function toCode(typed: string): string {
  return typed
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const CATEGORY_LINK = /promotion\/list\.html\?(?:[^"'\s]*&)?category=([A-Za-z0-9_]+)/g

/** The categories the pages' links filter the promotion list by */
export function linkedCategories(data: unknown): string[] {
  const found = new Set<string>()
  for (const match of JSON.stringify(data ?? null).matchAll(CATEGORY_LINK)) found.add(match[1]!)
  return [...found]
}
