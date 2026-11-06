import type { Access } from 'payload'

/** Signed-in editors only: nothing of the admin is public (the pages are, on the CDN) */
export const signedIn: Access = ({ req: { user } }) => Boolean(user)

/** The list screen of the CVP collections (admin/views/CatalogList.tsx), as an import map path */
export const CATALOG_LIST = '/admin/views/CatalogList#CatalogList'
