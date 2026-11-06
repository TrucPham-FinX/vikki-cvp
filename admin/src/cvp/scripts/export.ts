/**
 * npm run cvp:export [-- --dry-run] — writes the CVP collections over front-end/data, only the
 * files whose JSON changed. The admin's "Xuất & build" does this and builds too.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import { repoPaths } from '../paths'
import { writeDataDir } from '../repo-data'
import { exportEntries } from '../store'

const dryRun = process.argv.includes('--dry-run')
const payload = await getPayload({ config })
const paths = repoPaths()
const report = writeDataDir(paths.data, await exportEntries(payload), { dryRun })
console.log(`${dryRun ? 'Would write' : 'Wrote'} ${report.written.length} file(s), ${report.unchanged.length} unchanged.`)
for (const file of report.written) console.log(`  ${dryRun ? '~' : '✎'} ${file}`)
for (const file of report.stale) console.log(`  ? not in the admin: ${file}`)
process.exit(0)
