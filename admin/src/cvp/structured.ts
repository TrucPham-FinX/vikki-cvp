/**
 * The structured editor's rules (admin/components/cvp/structured/JsonFormField.tsx): what each value
 * of a JSON object kept as text is (a popup's content, a page's own data), how it is named, which
 * editor it gets, and what a new row or block starts as. No Node imports: it runs in the browser.
 *
 * The editor changes values where they are, so a key keeps its place and every key the form does
 * not know is kept: the JSON written back differs only by what the editor typed.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type JsonObject = { [key: string]: Json }
export type Path = (string | number)[]

export const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/* ── reading and changing a value at a path, without touching the rest ─────────── */

export function getAt(root: Json, path: Path): Json | undefined {
  let node: Json | undefined = root
  for (const step of path) {
    if (Array.isArray(node) && typeof step === 'number') node = node[step]
    else if (isObject(node) && typeof step === 'string') node = node[step]
    else return undefined
  }
  return node
}

/** `root` with `value` at `path`: a copy along the path, the key's place kept; other branches shared */
export function setAt(root: Json, path: Path, value: Json): Json {
  if (!path.length) return value
  const [step, ...rest] = path
  if (Array.isArray(root) && typeof step === 'number') {
    const copy = root.slice()
    copy[step] = setAt(root[step] ?? null, rest, value)
    return copy
  }
  if (isObject(root) && typeof step === 'string') {
    // Rebuilt key by key, so the key stays where it was (a new one goes last)
    const copy: JsonObject = {}
    let placed = false
    for (const [key, child] of Object.entries(root)) {
      if (key === step) {
        copy[key] = setAt(child, rest, value)
        placed = true
      } else copy[key] = child
    }
    if (!placed) copy[step] = setAt(null, rest, value)
    return copy
  }
  return root
}

/** `root` without the key or row at `path` */
export function removeAt(root: Json, path: Path): Json {
  if (!path.length) return root
  const parentPath = path.slice(0, -1)
  const last = path[path.length - 1]
  const parent = getAt(root, parentPath)
  if (Array.isArray(parent) && typeof last === 'number') {
    return setAt(root, parentPath, parent.filter((_, index) => index !== last))
  }
  if (isObject(parent) && typeof last === 'string') {
    const copy: JsonObject = {}
    for (const [key, child] of Object.entries(parent)) if (key !== last) copy[key] = child
    return setAt(root, parentPath, copy)
  }
  return root
}

/** `root` with `value` put in the array at `arrayPath`, before `index` (its length: at the end) */
export function insertAt(root: Json, arrayPath: Path, index: number, value: Json): Json {
  const list = getAt(root, arrayPath)
  const items = Array.isArray(list) ? list.slice() : []
  items.splice(Math.max(0, Math.min(index, items.length)), 0, value)
  return setAt(root, arrayPath, items)
}

/** `root` with the row `from` of the array at `arrayPath` moved to `to` */
export function moveAt(root: Json, arrayPath: Path, from: number, to: number): Json {
  const list = getAt(root, arrayPath)
  if (!Array.isArray(list) || to < 0 || to >= list.length || from === to) return root
  const items = list.slice()
  const [row] = items.splice(from, 1)
  items.splice(to, 0, row ?? null)
  return setAt(root, arrayPath, items)
}

/* ── what a value is ──────────────────────────────────────────────────────────── */

/** The content blocks of the document layouts (front-end/components/static/blocks, legal/blocks) */
export const BLOCK_TYPES = ['paragraph', 'subheading', 'list', 'table'] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

export const isBlockType = (value: unknown): value is BlockType => BLOCK_TYPES.includes(value as BlockType)

const MEDIA_EXTENSION = /\.(png|jpe?g|gif|webp|svg|mp4|webm)(?:[?#].*)?$/i
// Keys holding an image, as the pages name them: src, img, logo, posterSrc, heroImage, iconSrc…
const IMAGE_KEY = /^(src|img|image|logo|poster|icon|thumbnail|banner|background)$|(Src|Image|Img|Logo|Icon|Poster|Thumbnail)$/
// Keys holding where a button leads: a popup's content, a page, a promotion
const LINK_KEY = /^(popup|popupLink|link|href|url)$/
// Keys whose text the pages print as HTML
const HTML_KEY = /^(text|content|value|note|html|answer|description|desc|intro|body)$/
const HTML_TAG = /<\/?[a-z][^>]*>|&(?:nbsp|amp|lt|gt|quot|#\d+);/i

export type TextKind = 'image' | 'link' | 'html' | 'multiline' | 'line'

/** Which editor a string gets, from its key and what it holds */
export function textKind(key: string | number, value: string): TextKind {
  const name = typeof key === 'string' ? key : ''
  const plain = value.trim()
  // A stream's playlist (.m3u8) is typed, not picked
  if (/hls/i.test(name)) return 'line'
  if (IMAGE_KEY.test(name) && (!plain || (MEDIA_EXTENSION.test(plain) && !/\s/.test(plain)))) return 'image'
  if (LINK_KEY.test(name) && !/\s/.test(plain)) return 'link'
  if (HTML_TAG.test(value) || (HTML_KEY.test(name) && plain.length > 60)) return 'html'
  if (value.includes('\n') || plain.length > 90) return 'multiline'
  return 'line'
}

/** Keys of how something looks or is wired, out of an editor's way ("Nâng cao") */
const ADVANCED_KEY = /^(className|classNameTitle|style|id|version|colspan|rowspan|width|height|defaultExpanded|layout|language|htmlLanguage|uiLanguage|filename|assetBase|useHeaderImage)$|ClassName$/

export const isAdvancedKey = (key: string) => ADVANCED_KEY.test(key)

/* ── names ─────────────────────────────────────────────────────────────────────── */

/** What each key is called in the form; a key not here is shown as it is written */
export const KEY_LABELS: Record<string, string> = {
  header: 'Đầu trang',
  h1: 'Tiêu đề lớn',
  img: 'Ảnh / logo',
  intro: 'Đoạn mở đầu',
  sections: 'Phần',
  articles: 'Điều / mục',
  blocks: 'Nội dung',
  title: 'Tiêu đề',
  subtitle: 'Dòng phụ',
  text: 'Nội dung',
  items: 'Các dòng',
  children: 'Danh sách con',
  style: 'Kiểu đánh số',
  className: 'CSS class',
  classNameTitle: 'CSS class của chữ',
  note: 'Ghi chú',
  footer: 'Cuối trang',
  rows: 'Các hàng',
  headerRows: 'Hàng tiêu đề',
  cells: 'Các ô',
  value: 'Giá trị',
  colspan: 'Gộp cột',
  rowspan: 'Gộp hàng',
  id: 'Mã (id)',
  version: 'Phiên bản',
  label: 'Nhãn',
  logo: 'Logo',
  alt: 'Mô tả ảnh (alt)',
  src: 'Ảnh',
  productName: 'Tên sản phẩm',
  taglineLines: 'Các dòng khẩu hiệu',
  defaultExpanded: 'Mở sẵn',
  content: 'Nội dung',
  description: 'Mô tả',
  popup: 'Mở popup',
  popupLink: 'Mở khi bấm',
  popupTitle: 'Tiêu đề popup',
  link: 'Liên kết',
  qa: 'Câu hỏi thường gặp',
  qaItems: 'Câu hỏi thường gặp',
  qaGroups: 'Nhóm câu hỏi',
  slider: 'Slider ảnh',
  bannerVideoHlsSrc: 'Video banner (HLS .m3u8)',
  videoSrc: 'Video',
  videoHlsSrc: 'Video (HLS .m3u8)',
  posterSrc: 'Ảnh chờ video',
  benefits: 'Quyền lợi',
  plans: 'Các gói',
  steps: 'Các bước',
  faqs: 'Câu hỏi thường gặp',
  legalLinks: 'Nút pháp lý',
  details: 'Trang chi tiết',
  frontPages: 'Trang bìa',
  backCover: 'Bìa sau',
  name: 'Tên',
  number: 'Số thứ tự',
  imageLabel: 'Mô tả ảnh',
  width: 'Rộng (px)',
  height: 'Cao (px)',
}

/** What one row of a list is called, for its "Thêm …" button: a section, a question, a plan */
const ROW_LABELS: Record<string, string> = {
  sections: 'phần',
  articles: 'điều / mục',
  items: 'dòng',
  rows: 'hàng',
  headerRows: 'hàng tiêu đề',
  cells: 'ô',
  intro: 'đoạn',
  taglineLines: 'dòng',
  qa: 'câu hỏi',
  qaItems: 'câu hỏi',
  faqs: 'câu hỏi',
  qaGroups: 'nhóm câu hỏi',
  slider: 'slide',
  plans: 'gói',
  steps: 'bước',
  benefits: 'quyền lợi',
  legalLinks: 'nút',
  details: 'trang chi tiết',
  frontPages: 'trang',
}

export const rowLabelOf = (key: string | number) =>
  (typeof key === 'string' && ROW_LABELS[key]) || (typeof key === 'string' ? labelOf(key).toLowerCase() : 'mục')

/** A key's name in the form */
export function labelOf(key: string | number): string {
  if (typeof key === 'number') return `#${key + 1}`
  if (KEY_LABELS[key]) return KEY_LABELS[key]
  // camelCase and kebab-case as words: backTopLabel → Back top label
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim().toLowerCase()
  return words ? words[0]!.toUpperCase() + words.slice(1) : key
}

const stripTags = (value: string) =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

const SUMMARY_KEYS = ['title', 'h1', 'name', 'label', 'text', 'value', 'subtitle', 'description', 'content', 'src', 'id']

/** A row's one-line summary, for its header: its title, else its text… else nothing */
export function summaryOf(value: Json | undefined, max = 90): string {
  let found = ''
  if (typeof value === 'string') found = stripTags(value)
  else if (typeof value === 'number' || typeof value === 'boolean') found = String(value)
  else if (isObject(value)) {
    for (const key of SUMMARY_KEYS) {
      const candidate = value[key]
      if (typeof candidate === 'string' && stripTags(candidate)) {
        found = stripTags(candidate)
        break
      }
    }
    if (!found && Array.isArray(value.items) && value.items.length) found = summaryOf(value.items[0], max)
    if (!found && Array.isArray(value.cells)) {
      found = value.cells.map((cell) => summaryOf(cell, 30)).filter(Boolean).join(' | ')
    }
  }
  return found.length > max ? `${found.slice(0, max - 1)}…` : found
}

/* ── what a new row or block starts as ─────────────────────────────────────────── */

export const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: 'Đoạn văn',
  subheading: 'Tiêu đề phụ',
  list: 'Danh sách',
  table: 'Bảng',
}

/** A new block of each type, keys in the order the CVP's files write them */
export function newBlock(type: BlockType): JsonObject {
  switch (type) {
    case 'paragraph':
      return { type: 'paragraph', text: '' }
    case 'subheading':
      return { type: 'subheading', text: '' }
    case 'list':
      return { type: 'list', style: 'decimal', items: [{ text: '' }] }
    case 'table':
      return {
        type: 'table',
        headerRows: [{ cells: [{ value: '' }, { value: '' }] }],
        rows: [{ cells: [{ value: '' }, { value: '' }] }],
      }
  }
}

/**
 * The list styles the document layouts draw (`.legal-list.<style>` in front-end/layouts/static.hbs,
 * legal-document.hbs), with what each looks like; a page's own style (`numeric`, a class list) is
 * kept and shown as it is written.
 */
export const LIST_STYLES: { value: string; label: string }[] = [
  { value: 'decimal', label: '1. 2. 3.' },
  { value: 'alpha', label: 'a. b. c.' },
  { value: 'roman', label: 'i. ii. iii.' },
  { value: 'disc', label: '• Chấm tròn' },
  { value: 'none', label: 'Không đánh số' },
]

// Kept as they are in a blank copy: they say what the row is, not what it says
const STRUCTURAL = /^(type|style|layout|language|htmlLanguage|uiLanguage)$/

/**
 * A new row made like `sample`: the same keys, every text empty, every list empty, kinds and
 * styles kept. "Thêm" in a list of sections gives a section, in a list of plans a plan.
 */
export function blankLike(sample: Json | undefined, key = ''): Json {
  if (typeof sample === 'string') return STRUCTURAL.test(key) ? sample : ''
  if (typeof sample === 'number') return STRUCTURAL.test(key) ? sample : 0
  if (typeof sample === 'boolean') return false
  if (Array.isArray(sample)) return []
  if (isObject(sample)) {
    const copy: JsonObject = {}
    for (const [name, child] of Object.entries(sample)) {
      // Merged cells and classes are the sample's own look; a new row starts plain
      if (name === 'colspan' || name === 'rowspan' || /className$/i.test(name)) continue
      copy[name] = blankLike(child, name)
    }
    return copy
  }
  return ''
}

/**
 * A document's content when it is new, by its layout (front-end/layouts): the keys the layout
 * reads, empty, so the form has a place for each.
 */
export function documentTemplate(layout: string | null | undefined): JsonObject {
  switch (layout) {
    case 'fee':
      return { blocks: [newBlock('subheading'), newBlock('table')] }
    case 'legal-document':
      return {
        header: { logo: { src: '', alt: '' }, productName: '', taglineLines: [] },
        sections: [{ id: 'phan-1', title: '', blocks: [newBlock('paragraph')] }],
        note: { label: '', text: '' },
      }
    default:
      return {
        header: { img: 'assets/vikki-logo.png', h1: '' },
        sections: [{ id: 'phan-1', title: '', articles: [{ id: 'dieu-1', title: '', blocks: [newBlock('paragraph')] }] }],
      }
  }
}

/** What an array's "Thêm" adds: a block menu for content blocks, else a row like the last */
export function isBlockList(key: string | number, list: Json[]): boolean {
  if (key === 'blocks') return true
  return list.length > 0 && list.every((item) => isObject(item) && isBlockType(item.type))
}

/** A new row for the array `list` (named `key`): like its last row, or a block / text / item when empty */
export function newRow(key: string | number, list: Json[]): Json {
  const last = list[list.length - 1]
  if (last !== undefined) return blankLike(last)
  switch (key) {
    case 'sections':
      return { id: '', title: '', articles: [] }
    case 'articles':
      return { id: '', title: '', blocks: [] }
    case 'items':
      return { text: '' }
    case 'rows':
    case 'headerRows':
      return { cells: [{ value: '' }] }
    case 'cells':
      return { value: '' }
    case 'intro':
    case 'taglineLines':
      return ''
    default:
      return ''
  }
}

/** Prefixes of the ids a new section or article gets (`phan-3`, `dieu-12`) */
const ID_PREFIX: Record<string, string> = { sections: 'phan', articles: 'dieu' }

/**
 * An id no other part of `root` has, for a new row of `key` (a section's `phan-<n>`, an article's
 * `dieu-<n>`): the layouts open and close each part by its id, so two alike would move together.
 */
export function freshId(root: Json, key: string | number): string {
  const prefix = (typeof key === 'string' && ID_PREFIX[key]) || (typeof key === 'string' && key) || 'muc'
  const taken = new Set<string>()
  const walk = (node: Json) => {
    if (Array.isArray(node)) node.forEach(walk)
    else if (isObject(node)) {
      if (typeof node.id === 'string') taken.add(node.id)
      Object.values(node).forEach(walk)
    }
  }
  walk(root)
  let n = 1
  for (const id of taken) {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(id)
    if (match) n = Math.max(n, Number(match[1]) + 1)
  }
  while (taken.has(`${prefix}-${n}`)) n++
  return `${prefix}-${n}`
}

/** A row of an array is shown folded when the array is long or its rows are big */
export const foldsRows = (list: Json[]) => list.length > 3 || list.some((item) => isObject(item) && Object.keys(item).length > 3)

/** The JSON text a form edit writes back: the way the import keeps it */
export const toText = (value: Json) => JSON.stringify(value, null, 2)

/** The text as an object to edit, or why it cannot be */
export function parseObject(text: string | null | undefined): { ok: true; value: JsonObject } | { ok: false; error: string } {
  if (typeof text !== 'string' || !text.trim()) return { ok: true, value: {} }
  try {
    const value = JSON.parse(text) as Json
    return isObject(value) ? { ok: true, value } : { ok: false, error: 'not-object' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/* ── parts a document's form can add ───────────────────────────────────────────── */

export type OptionalKey = { key: string; value: Json }

/**
 * What an object of a document (by where it is: the root, its header, a section, an article, a
 * list row) can have that it has not yet, for "Thêm phần": the keys its layout reads.
 */
export function optionalKeys(
  path: Path,
  value: JsonObject,
  layout: string | null | undefined,
  shape: 'document' | 'data' = 'document',
): OptionalKey[] {
  const last = path[path.length - 1]
  const parentKey = path.length >= 2 ? path[path.length - 2] : undefined
  let wanted: OptionalKey[] = []
  if (shape === 'data') {
    // A landing page's own keys the shared templates read: the banner video's stream (scripts.hbs)
    if (!path.length) wanted = [{ key: 'bannerVideoHlsSrc', value: '' }]
  } else if (!path.length) {
    if (layout === 'fee') wanted = [{ key: 'blocks', value: [] }]
    else if (layout === 'legal-document') {
      wanted = [
        { key: 'header', value: { logo: { src: '', alt: '' }, productName: '', taglineLines: [] } },
        { key: 'sections', value: [] },
        { key: 'note', value: { label: '', text: '' } },
      ]
    } else if (layout === 'static') {
      wanted = [
        { key: 'header', value: { img: '', h1: '' } },
        { key: 'sections', value: [] },
        { key: 'note', value: { text: '' } },
        { key: 'footer', value: { h1: '' } },
      ]
    }
  } else if (last === 'header' && path.length === 1) {
    wanted =
      layout === 'legal-document'
        ? [
            { key: 'logo', value: { src: '', alt: '' } },
            { key: 'productName', value: '' },
            { key: 'taglineLines', value: [] },
          ]
        : [
            { key: 'img', value: '' },
            { key: 'h1', value: '' },
            { key: 'intro', value: [] },
          ]
  } else if (typeof last === 'number' && parentKey === 'sections') {
    wanted =
      layout === 'legal-document'
        ? [
            { key: 'title', value: '' },
            { key: 'blocks', value: [] },
          ]
        : [
            { key: 'title', value: '' },
            { key: 'articles', value: [] },
            { key: 'blocks', value: [] },
          ]
  } else if (typeof last === 'number' && parentKey === 'articles') {
    wanted = [
      { key: 'title', value: '' },
      { key: 'blocks', value: [] },
    ]
  } else if (typeof last === 'number' && parentKey === 'items' && !isBlockType(value.type)) {
    wanted = [{ key: 'children', value: { style: 'alpha', items: [{ text: '' }] } }]
  }
  return wanted.filter(({ key }) => !(key in value))
}
