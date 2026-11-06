import { postgresAdapter } from '@payloadcms/db-postgres'
import { en } from '@payloadcms/translations/languages/en'
import { vi } from '@payloadcms/translations/languages/vi'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { PRODUCT_NAME } from './admin/brand'
import { CardIntros } from './collections/CardIntros'
import { CvpDocuments } from './collections/CvpDocuments'
import { CvpMedia } from './collections/CvpMedia'
import { CvpPages } from './collections/CvpPages'
import { Promotions } from './collections/Promotions'
import { Users } from './collections/Users'
import { DEFAULT_LOCALE, LOCALE_LABELS, LOCALES } from './cvp/locales'
import { mediaStoragePlugin, storageNote } from './cvp/storage'
import { cvpEndpoints } from './endpoints/cvp'
import { CvpLists } from './globals/CvpLists'

const dirname = path.dirname(fileURLToPath(import.meta.url))

function requiredEnv(name: string): string {
  const value = (process.env[name] ?? '').trim()
  if (!value) throw new Error(`${name} is not set (see admin/.env.example)`)
  return value
}

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ` · ${PRODUCT_NAME}`,
      icons: [{ rel: 'icon', type: 'image/png', url: '/brand/favicon.png' }],
    },
    importMap: { baseDir: path.resolve(dirname) },
    // The shell and screens follow galaxy-g-admin's admin-ui-implement standards: design layer in
    // admin/design, sidebar from access/menuCatalog.ts, copy in admin/i18n/dictionary.ts
    components: {
      // One toast host for the whole admin, above the router so it survives navigation
      providers: ['/admin/components/ui/Toasts#Toasts'],
      graphics: {
        Icon: '/admin/components/brand/PayloadGraphics#Icon',
        Logo: '/admin/components/brand/PayloadGraphics#Logo',
      },
      actions: [
        '/admin/components/LanguageToggle#LanguageToggle',
        '/admin/components/ThemeToggle#ThemeToggle',
      ],
      // The user card at the bottom of the rail carries logout
      logout: { Button: '/admin/components/NavUserCard#NoNavLogout' },
      beforeNavLinks: [
        // Renders nothing; puts the rail back where it was scrolled to
        '/admin/components/nav/NavScrollMemory#NavScrollMemory',
        '/admin/components/nav/NavBrand#NavBrand',
        '/admin/components/nav/NavSections',
      ],
      afterNavLinks: ['/admin/components/NavUserCard#NavUserCard'],
      views: {
        // The publish screen in place of Payload's card grid
        dashboard: { Component: '/admin/views/Dashboard#Dashboard' },
      },
    },
  },
  i18n: {
    fallbackLanguage: 'vi',
    supportedLanguages: { vi, en },
  },
  collections: [CvpPages, CvpDocuments, Promotions, CardIntros, CvpMedia, Users],
  globals: [CvpLists],
  // The CVP's languages (?lang, runtime/README.md). Each page keeps what it has in each language:
  // no fallback, so a language left empty is not written as another's copy
  localization: {
    locales: LOCALES.map((code) => ({ code, label: LOCALE_LABELS[code] })),
    defaultLocale: DEFAULT_LOCALE,
    fallback: false,
  },
  endpoints: cvpEndpoints,
  graphQL: { disable: true },
  secret: requiredEnv('PAYLOAD_SECRET'),
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || undefined,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: requiredEnv('DATABASE_URL') },
  }),
  // The media library's store: admin/media, or S3 configured as g-digital-center's (cvp/storage.ts)
  plugins: [mediaStoragePlugin()],
  onInit: (payload) => {
    payload.logger.info(storageNote())
  },
})
