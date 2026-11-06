/**
 * npm run cvp:media:import [-- dry-run] [-- videos] [-- <page> …]
 *
 * Plain words, not `--flags`: `payload run` passes a script its positional arguments only.
 *
 * Puts the images already published in vikki-cvp/<page>/assets/ into the media library, each under
 * its own page, folder and name (cvp/media.ts importPublishedAssets): to try the library and the
 * pickers on real pictures. What the library already has is left alone, so it can be run again.
 * The same as "Nạp ảnh từ assets" above the library's list.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import { importPublishedAssets } from '../media'
import { storageNote } from '../storage'

const args = process.argv.slice(2)
const dryRun = args.includes('dry-run')
const videos = args.includes('videos')
const pages = args.filter((arg) => arg !== 'dry-run' && arg !== 'videos')

const payload = await getPayload({ config })
console.log(storageNote())
const report = await importPublishedAssets(payload, {
  pages: pages.length ? pages : undefined,
  videos,
  dryRun,
})
console.log(
  `${dryRun ? 'Would add' : 'Added'} ${report.added.length} files · ` +
    `${report.existing} already in the library · ${report.skipped.length} skipped (videos/PDFs without "videos", or folders the library cannot name)`,
)
for (const failure of report.failed) console.error(`  failed: ${failure}`)
process.exit(report.failed.length ? 1 : 0)
