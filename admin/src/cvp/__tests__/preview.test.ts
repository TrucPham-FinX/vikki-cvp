import fs from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, it } from 'vitest'

import { runNode } from '../build'
import { repoPaths } from '../paths'
import { buildError, builtFileOf, isPreviewToken, resolvePreviewFile, resolvePublishedFile } from '../preview'
import { previewShell } from '../previewShell'
import { translator } from '../../admin/i18n/dictionary'

const TOKEN = 'a'.repeat(32)
const RENDER = 'rabc123'

describe('builtFileOf', () => {
  it('names a single-language file after its data file', () => {
    expect(builtFileOf({ page: 'vikki-go-cvp', file: 'tc.json', byLocale: { vi: {} } }, 'en')).toBe(
      'vikki-go-cvp/tc.html',
    )
  })

  it('puts a {locale} page in its language folder, under its filename or the page', () => {
    const entry = { page: 'fx', file: '{locale}.json', byLocale: { vi: { filename: 'index' }, en: {} } }
    expect(builtFileOf(entry, 'vi')).toBe('fx/vi/index.html')
    expect(builtFileOf(entry, 'en')).toBe('fx/en/fx.html')
  })

  it('names x-{locale}.json as x.html, and has nothing in a language the file lacks', () => {
    const entry = { page: 'fx', file: 'tc-{locale}.json', byLocale: { vi: {} } }
    expect(builtFileOf(entry, 'vi')).toBe('fx/vi/tc.html')
    expect(builtFileOf(entry, 'ko')).toBeNull()
  })
})

describe('buildError', () => {
  it('keeps the error, not the list of partials', () => {
    const output = [
      '✓ partial: topMenu',
      '✓ partial: video',
      '⚙️ rebuilding...',
      'Error: [Build Error] Unknown block type "carousel" at component index 2 in page "x/index"',
      '    at validateComponents (build.js:139:17)',
    ].join('\n')
    expect(buildError(output)).toMatch(/^Error: \[Build Error\] Unknown block type "carousel"/)
    expect(buildError(output)).not.toContain('partial')
  })
})

describe('resolvePreviewFile', () => {
  it('refuses anything but a token, a render id and a path inside them', () => {
    expect(resolvePreviewFile(['not-a-token', RENDER, 'x.html'])).toBeNull()
    expect(resolvePreviewFile([TOKEN, '../etc', 'x.html'])).toBeNull()
    expect(resolvePreviewFile([TOKEN, RENDER])).toBeNull()
    expect(resolvePreviewFile([TOKEN, RENDER, '..', '..', '..', 'package.json'])).toBeNull()
    expect(resolvePreviewFile([TOKEN, RENDER, '..', '..', 'admin', '.env'])).toBeNull()
  })

  it('falls back to the published vikki-cvp/ for what a render does not have', () => {
    const found = resolvePreviewFile([TOKEN, RENDER, 'vikki-go-cvp', 'assets', 'vikki-logo.png'])
    expect(found?.rendered).toBe(false)
    expect(found?.file).toBe(path.join(repoPaths().output, 'vikki-go-cvp', 'assets', 'vikki-logo.png'))
  })

  it('serves /vikki-cvp paths from the published folder, never outside it', () => {
    expect(resolvePublishedFile(['vikki-go-cvp', 'tc.html'], null)?.rendered).toBe(false)
    expect(resolvePublishedFile(['..', 'front-end', 'build.js'], null)).toBeNull()
  })

  it('knows a token when it sees one', () => {
    expect(isPreviewToken(TOKEN)).toBe(true)
    expect(isPreviewToken('A'.repeat(32))).toBe(false)
    expect(isPreviewToken(undefined)).toBe(false)
  })
})

describe('previewShell', () => {
  it('posts to the preview operation and tells Payload it is ready', () => {
    const html = previewShell(translator('vi'))
    expect(html).toContain('"/api/cvp/preview"')
    expect(html).toContain("type: 'payload-live-preview', ready: true")
    expect(html).toContain(translator('vi')('preview.missing'))
  })
})

describe('a build of one page folder (CVP_ONLY_PAGE / CVP_PAGES_DIR)', () => {
  it('writes that page exactly as the whole build does, and nothing else', async () => {
    const paths = repoPaths()
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cvp-preview-test-'))
    try {
      const all = path.join(tmp, 'all')
      const one = path.join(tmp, 'one')
      const pages = path.join(tmp, 'pages')
      fs.cpSync(path.join(paths.pages, 'vikki-go-cvp'), path.join(pages, 'vikki-go-cvp'), { recursive: true })

      const whole = await runNode(paths.build, [], { cwd: paths.root, env: { CVP_OUT_DIR: all } })
      const single = await runNode(paths.build, [], {
        cwd: paths.root,
        env: { CVP_OUT_DIR: one, CVP_ONLY_PAGE: 'vikki-go-cvp', CVP_PAGES_DIR: pages },
      })
      expect(whole.ok).toBe(true)
      expect(single.ok).toBe(true)

      expect(fs.readdirSync(one)).toEqual(['vikki-go-cvp'])
      const built = fs.readdirSync(path.join(one, 'vikki-go-cvp')).sort()
      expect(built.length).toBeGreaterThan(0)
      for (const file of built) {
        expect(fs.readFileSync(path.join(one, 'vikki-go-cvp', file))).toEqual(
          fs.readFileSync(path.join(all, 'vikki-go-cvp', file)),
        )
      }
    } finally {
      fs.rmSync(tmp, { force: true, recursive: true })
    }
  }, 60000)
})
