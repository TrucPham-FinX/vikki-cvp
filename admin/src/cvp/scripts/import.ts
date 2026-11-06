/**
 * npm run cvp:import — replaces everything in the CVP collections with front-end/data.
 * For the first load of a database, or to start over from the repo.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import { repoPaths } from '../paths'
import { readDataDir } from '../repo-data'
import { importEntries } from '../store'

const payload = await getPayload({ config })
const paths = repoPaths()
const entries = readDataDir(paths.data)
const report = await importEntries(payload, entries)
console.log(
  `Imported from ${paths.data}: ${report.pages} pages, ${report.documents} documents, ${report.promotions} promotions, ${report.cardIntros} card intros.`,
)
process.exit(0)
