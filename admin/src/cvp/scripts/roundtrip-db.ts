/**
 * npm run cvp:roundtrip:db — REPLACES the CVP collections with front-end/data, reads them back,
 * and builds both: the HTML from the database must be byte-identical to the HTML from the repo.
 * Proves the collections keep every value the pages need. Run it on a local database only.
 */
import config from '@payload-config'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getPayload } from 'payload'
import { isDeepStrictEqual } from 'util'

import { compareDirs, runBuild } from '../build'
import { repoPaths } from '../paths'
import { entryFiles, readDataDir, writeDataDir } from '../repo-data'
import { exportEntries, importEntries } from '../store'
import { reportComparison } from './report'

const payload = await getPayload({ config })
const paths = repoPaths()
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cvp-roundtrip-db-'))
let failed = false

const entries = readDataDir(paths.data)
const imported = await importEntries(payload, entries)
console.log(`Imported: ${JSON.stringify(imported)}`)

const back = await exportEntries(payload)
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
if (!failed) console.log(`✓ JSON: all ${before.size} files the same after the database.`)

const dataDir = path.join(work, 'data')
writeDataDir(dataDir, back)
const baseline = await runBuild(paths, paths.data, path.join(work, 'out-repo'))
const rebuilt = await runBuild(paths, dataDir, path.join(work, 'out-db'))
if (!baseline.ok || !rebuilt.ok) {
  console.log(baseline.ok ? rebuilt.output : baseline.output)
  failed = true
} else {
  failed = !reportComparison(compareDirs(path.join(work, 'out-repo'), path.join(work, 'out-db'))) || failed
}

if (failed) console.log(`Kept for a look: ${work}`)
else fs.rmSync(work, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
