import type { Payload } from 'payload'

import { ensureTemplates, runBuild, runNode, type RunResult } from './build'
import { syncMedia, type MediaSyncReport } from './media'
import { repoPaths } from './paths'
import { writeDataDir, type WriteReport } from './repo-data'
import { exportEntries } from './store'

export type PublishReport = {
  data: WriteReport
  assets: MediaSyncReport
  templatesCreated: string[]
  validate: RunResult
  build: RunResult | null
  manifest: RunResult | null
  ok: boolean
}

// One publish at a time: two would write the same files
let running: Promise<PublishReport> | null = null

/**
 * What the admin holds, written over front-end/data (only files whose JSON changed) with the media
 * library's files copied into vikki-cvp/<page>/ (only new or changed ones), checked
 * (core/validate.js), then built into vikki-cvp/ with the manifest (core/manifest.js). The result
 * is in the repo's working tree, for a commit and the existing publish to the CDN.
 */
export function publish(payload: Payload): Promise<PublishReport> {
  if (running) return running
  running = (async () => {
    const paths = repoPaths()
    const entries = await exportEntries(payload)
    const data = writeDataDir(paths.data, entries)
    // Before the checks: a page may name an image only the library has had so far
    const assets = await syncMedia(payload)
    const templatesCreated = ensureTemplates(paths, entries)

    const validate = await runNode(paths.validate, [], { cwd: paths.root })
    if (!validate.ok) {
      return { data, assets, templatesCreated, validate, build: null, manifest: null, ok: false }
    }
    const build = await runBuild(paths)
    const manifest = build.ok ? await runNode(paths.manifest, [], { cwd: paths.root }) : null
    return {
      data,
      assets,
      templatesCreated,
      validate,
      build,
      manifest,
      ok: build.ok && Boolean(manifest?.ok),
    }
  })().finally(() => {
    running = null
  })
  return running
}

/** Which data files a publish would write, without writing anything */
export async function pendingChanges(payload: Payload): Promise<WriteReport> {
  const paths = repoPaths()
  return writeDataDir(paths.data, await exportEntries(payload), { dryRun: true })
}

/** Which media library files a publish would copy into vikki-cvp/, without copying anything */
export async function pendingAssets(payload: Payload): Promise<string[]> {
  return (await syncMedia(payload, { dryRun: true })).written
}
