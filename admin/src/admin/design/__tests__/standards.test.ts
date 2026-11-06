import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * galaxy-g-admin's frontend standards (`docs/frontend-development-standards.md`, skill
 * `admin-ui-implement`), the parts that can be read off the source, held for the CVP admin.
 */

const SRC = join(__dirname, '..', '..', '..')
const ADMIN = join(SRC, 'admin')

const files = (dir: string, match: (path: string) => boolean): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : files(path, match)
    return match(path) ? [path] : []
  })

const rel = (path: string) => relative(SRC, path).split(sep).join('/')
const read = (path: string) => readFileSync(path, 'utf8')
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const code = files(SRC, (path) => /\.(ts|tsx)$/.test(path) && !path.endsWith('payload-types.ts'))

describe('architecture', () => {
  it('does not depend on core-ui (the design layer draws its controls, design/controls.tsx)', () => {
    const offenders = code.filter((path) =>
      /from\s+['"]@galaxyfinx\/galaxy-g-core-ui-web/.test(read(path)),
    )
    expect(offenders.map(rel)).toEqual([])
  })

  it('keeps Payload views as server components', () => {
    const views = files(join(ADMIN, 'views'), (path) => path.endsWith('.tsx'))
    expect(views.length).toBeGreaterThan(0)
    expect(views.filter((path) => /^\s*['"]use client['"]/m.test(read(path))).map(rel)).toEqual([])
  })

  it('calls the endpoints through api.* only, never fetch() from a component', () => {
    const components = files(join(ADMIN, 'components'), (path) => /\.(ts|tsx)$/.test(path))
    const offenders = components.filter((path) => /\bfetch\s*\(/.test(stripComments(read(path))))
    expect(offenders.map(rel)).toEqual([])
  })
})

describe('styling', () => {
  // The CVP's own stylesheets. The copied design layer is galaxy-g-admin's, guarded there.
  const OWN = files(ADMIN, (path) => path.endsWith('.module.css')).filter(
    (path) => !/design\.module\.css$|ListDataTable|DataState|Toasts|NavSection|NavBrand/.test(path),
  )

  it('finds the stylesheets it guards', () => {
    expect(OWN.map(rel)).toEqual(
      expect.arrayContaining([
        'admin/components/cvp/Catalog.module.css',
        'admin/design/controls.module.css',
      ]),
    )
  })

  it.each(OWN.map((path) => [rel(path), path]))('%s names no colour, only tokens', (_, path) => {
    const body = stripComments(read(path))
    expect(body.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) ?? []).toEqual([])
    expect(body.match(/var\(\s*--color-/g) ?? []).toEqual([])
  })

  it.each(OWN.map((path) => [rel(path), path]))('%s sets no font family of its own', (_, path) => {
    const families = [...stripComments(read(path)).matchAll(/font-family:\s*([^;]+);/g)].map((m) =>
      m[1]!.trim(),
    )
    expect(families.filter((family) => family !== 'var(--d-mono)')).toEqual([])
  })

  it('declares the design scale the screens spend', () => {
    const css = stripComments(read(join(ADMIN, 'design', 'design.module.css')))
    for (const [token, value] of [
      ['--d-space-7', '16px'],
      ['--d-text-md', '13px'],
      ['--d-control-h', '32px'],
      ['--d-accent', '#0000ff'],
      ['--d-ok-ink', '#11843c'],
      ['--d-bad-ink', '#c50000'],
    ]) {
      expect(css).toContain(`${token}: ${value};`)
    }
  })
})
