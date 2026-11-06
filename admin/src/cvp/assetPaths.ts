/**
 * Where a page's images are, as its data files name them and as vikki-cvp/ serves them: for the
 * image picker (admin/components/cvp/fields/ImageField.tsx), the media library
 * (collections/CvpMedia.ts) and its publish (cvp/media.ts). No Node imports: the picker runs in
 * the browser.
 */

// As repo-data.ts names it (that module reads the disk, so the browser cannot import it)
const LOCALE_TOKEN = '{locale}'

/** A page folder's name (front-end/pages, vikki-cvp), as identity.ts checks it */
export const PAGE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** A media library folder inside a page's folder: assets, or one below it (assets/vi) */
export const ASSET_FOLDER = /^assets(?:\/[a-z0-9]+(?:[-_][a-z0-9]+)*)*$/

/** What the library takes and the picker lists: what the pages show */
export const ASSET_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.webm', '.pdf']

export const isAssetFile = (name: string) =>
  ASSET_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension))

export const isVideoFile = (name: string) => /\.(mp4|webm)$/i.test(name)

/**
 * The folder of vikki-cvp/ a data file's HTML is written to, which its relative paths start from:
 * a `{locale}` file's copies are in `<page>/<locale>/`, the rest in `<page>/` (front-end/build.js).
 */
export function htmlFolder(page: string, file: string, locale: string): string {
  return file.includes(LOCALE_TOKEN) ? `${page}/${locale}` : page
}

/**
 * `value` (as a data file has it: `./assets/a.png`, `assets/a.png`, `../assets/a.png`) resolved
 * from `folder`, as a path in vikki-cvp/; null for a web address, an absolute path outside
 * /vikki-cvp/, or one that climbs out of vikki-cvp/.
 */
export function resolveAsset(folder: string, value: string): string | null {
  const plain = value.trim().split(/[?#]/)[0] ?? ''
  if (!plain || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(plain)) return null
  let parts: string[]
  let rest = plain
  if (plain.startsWith('/')) {
    if (!plain.startsWith('/vikki-cvp/')) return null
    parts = []
    rest = plain.slice('/vikki-cvp/'.length)
  } else {
    parts = folder.split('/').filter(Boolean)
  }
  for (const part of rest.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (!parts.length) return null
      parts.pop()
    } else {
      parts.push(part)
    }
  }
  return parts.length ? parts.join('/') : null
}

/**
 * How a data file names an image of its page's folder (`assets/a.png` there), the way the pages
 * already do: `./assets/a.png` beside its HTML, `../assets/a.png` from a language's copy.
 */
export function assetValue(file: string, pathInPage: string): string {
  return file.includes(LOCALE_TOKEN) ? `../${pathInPage}` : `./${pathInPage}`
}

/** A library file's place inside its page's folder: `<folder>/<filename>` */
export const pathInPage = (folder: string | null | undefined, filename: string) =>
  `${folder?.trim() || 'assets'}/${filename}`
