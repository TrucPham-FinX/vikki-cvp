import type { CollectionConfig } from 'payload'

import { signedIn } from '../cvp/access'

/** Editors, signed in with email and password. The first one is created on the admin's first open. */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: { vi: 'Người dùng', en: 'User' },
    plural: { vi: 'Người dùng', en: 'Users' },
  },
  // Payload's own list view, restyled by payload-collections.scss; the sidebar is menuCatalog.ts
  admin: { useAsTitle: 'email', group: false, defaultColumns: ['email', 'updatedAt', 'createdAt'] },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    cookies: {
      secure: (process.env.PAYLOAD_PUBLIC_SERVER_URL ?? '').startsWith('https://'),
      sameSite: 'Lax',
    },
  },
  access: { read: signedIn, create: signedIn, update: signedIn, delete: signedIn },
  fields: [],
}
