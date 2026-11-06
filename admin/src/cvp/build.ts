import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

import type { RepoPaths } from './paths'
import { kindOf, LOCALE_TOKEN, type DataEntry } from './repo-data'

export type RunResult = { ok: boolean; code: number | null; output: string }

/** Runs a Node script of the repo, its output kept (the last 200 lines) */
export function runNode(script: string, args: string[], options: { cwd: string; env?: Record<string, string> }) {
  return new Promise<RunResult>((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    })
    const lines: string[] = []
    const keep = (chunk: Buffer) => {
      lines.push(...chunk.toString('utf8').split('\n'))
      if (lines.length > 400) lines.splice(0, lines.length - 200)
    }
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)
    child.on('error', (error) => resolve({ ok: false, code: null, output: String(error) }))
    child.on('close', (code) =>
      resolve({ ok: code === 0, code, output: lines.slice(-200).join('\n').trim() }),
    )
  })
}

/** front-end/build.js over `dataDir`, into `outDir` (CVP_DATA_DIR / CVP_OUT_DIR) */
export function runBuild(paths: RepoPaths, dataDir = paths.data, outDir = paths.output) {
  return runNode(paths.build, [], {
    cwd: paths.root,
    env: { CVP_DATA_DIR: dataDir, CVP_OUT_DIR: outDir },
  })
}

/**
 * The template each data file needs (front-end/build.js renders pages/<page>/<template>.hbs inside
 * the data's layout); the CVP's are empty or hold the page's CSS. A page made in the admin has
 * none yet, so an empty one is written: its layout does the rest.
 */
export function ensureTemplates(paths: RepoPaths, entries: DataEntry[]): string[] {
  const created: string[] = []
  for (const entry of entries) {
    const kind = kindOf(entry)
    if (kind === 'promotions' || kind === 'cardIntros') continue
    let template: string
    if (entry.file === `${LOCALE_TOKEN}.json`) {
      const first = Object.values(entry.byLocale)[0]
      template = typeof first?.filename === 'string' ? first.filename : entry.page
    } else {
      // tc-{locale}.json and tc.json both render pages/<page>/tc.hbs
      template = entry.file.replace(`-${LOCALE_TOKEN}.json`, '').replace(/\.json$/, '')
    }
    const dir = path.join(paths.pages, entry.page)
    const target = path.join(dir, `${template}.hbs`)
    const pageTemplate = path.join(dir, `${entry.page}.hbs`)
    if (fs.existsSync(target) || (entry.file === `${LOCALE_TOKEN}.json` && fs.existsSync(pageTemplate))) continue
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(target, '')
    created.push(path.relative(paths.root, target))
  }
  return created
}

/** Every file under `dir`, relative to it */
export function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const files: string[] = []
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else files.push(path.relative(dir, full))
    }
  }
  walk(dir)
  return files.sort()
}

export type Comparison = { same: number; different: string[]; onlyInA: string[]; onlyInB: string[] }

/** Two build outputs file by file, byte for byte */
export function compareDirs(a: string, b: string): Comparison {
  const filesA = listFiles(a)
  const filesB = new Set(listFiles(b))
  const result: Comparison = { same: 0, different: [], onlyInA: [], onlyInB: [] }
  for (const file of filesA) {
    if (!filesB.has(file)) {
      result.onlyInA.push(file)
      continue
    }
    filesB.delete(file)
    if (fs.readFileSync(path.join(a, file)).equals(fs.readFileSync(path.join(b, file)))) result.same++
    else result.different.push(file)
  }
  result.onlyInB.push(...filesB)
  return result
}
