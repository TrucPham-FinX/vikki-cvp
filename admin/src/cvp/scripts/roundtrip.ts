/**
 * npm run cvp:roundtrip — no database. Every file of front-end/data through the admin's field
 * mappings and back; the JSON must be the same, and the HTML built from it byte-identical to the
 * HTML built from the repo's own data. Fails when any field mapping would lose or change a value.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { isDeepStrictEqual } from 'util'

import { compareDirs, runBuild } from '../build'
import { roundTripEntries } from '../mapping'
import { repoPaths } from '../paths'
import { entryFiles, readDataDir, writeDataDir } from '../repo-data'
import { reportComparison } from './report'

async function main() {
  const paths = repoPaths()
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cvp-roundtrip-'))
  let failed = false

  const entries = readDataDir(paths.data)
  const back = roundTripEntries(entries)
  console.log(`Read ${entries.length} data files (${entries.flatMap(entryFiles).length} JSON files).`)

  const before = new Map(entries.flatMap(entryFiles))
  const after = new Map(back.flatMap(entryFiles))
  for (const [file, data] of before) {
    if (!after.has(file)) {
      console.log(`  ✗ missing after the round trip: ${file}`)
      failed = true
    } else if (!isDeepStrictEqual(after.get(file), data)) {
      console.log(`  ✗ JSON changed: ${file}`)
      failed = true
    }
  }
  for (const file of after.keys()) {
    if (!before.has(file)) {
      console.log(`  ✗ new after the round trip: ${file}`)
      failed = true
    }
  }
  if (!failed) console.log(`✓ JSON: all ${before.size} files the same after the round trip.`)

  const dataDir = path.join(work, 'data')
  writeDataDir(dataDir, back)
  const baseline = await runBuild(paths, paths.data, path.join(work, 'out-repo'))
  const rebuilt = await runBuild(paths, dataDir, path.join(work, 'out-roundtrip'))
  if (!baseline.ok || !rebuilt.ok) {
    console.log(baseline.ok ? rebuilt.output : baseline.output)
    throw new Error('Build failed')
  }
  failed = !reportComparison(compareDirs(path.join(work, 'out-repo'), path.join(work, 'out-roundtrip'))) || failed

  fs.rmSync(work, { recursive: true, force: true })
  if (failed) process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
