import { describe, expect, it } from 'vitest'

import { CardIntros } from '../../collections/CardIntros'
import { CvpDocuments } from '../../collections/CvpDocuments'
import { CvpMedia } from '../../collections/CvpMedia'
import { CvpPages } from '../../collections/CvpPages'
import { Promotions } from '../../collections/Promotions'
import { Users } from '../../collections/Users'
import { CATALOG_SLUGS } from '../../contracts/cvp'
import { CATALOG_LIST } from '../../cvp/access'
import { CvpLists } from '../../globals/CvpLists'
import { ALL_MENUS, MENU_GROUPS, MenuKey, menusIn, navHref } from '../menuCatalog'

const COLLECTIONS = [CvpPages, CvpDocuments, Promotions, CardIntros, CvpMedia, Users]

describe('the menu catalog', () => {
  it('has one row per key, all named by MenuKey', () => {
    const keys = ALL_MENUS.map((menu) => menu.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect([...keys].sort()).toEqual(Object.values(MenuKey).sort())
  })

  it('puts every row in a declared group, and leaves no group empty', () => {
    const groups = MENU_GROUPS.map((group) => group.key)
    for (const menu of ALL_MENUS) expect(groups).toContain(menu.group)
    for (const group of groups) expect(menusIn(group).length).toBeGreaterThan(0)
  })

  it('opens each collection and global at its admin route', () => {
    const slugs = COLLECTIONS.map((collection) => collection.slug)
    for (const menu of ALL_MENUS) {
      if (menu.collection) {
        expect(slugs).toContain(menu.collection)
        expect(menu.href).toBe(`/admin/collections/${menu.collection}`)
      }
      if (menu.global) {
        expect(menu.global).toBe(CvpLists.slug)
        expect(menu.href).toBe(`/admin/globals/${menu.global}`)
      }
    }
  })

  it('has a row for every collection and global, which keep out of Payload’s own nav', () => {
    const opened = ALL_MENUS.map((menu) => menu.collection ?? menu.global)
    for (const entity of [...COLLECTIONS, CvpLists]) {
      expect(opened).toContain(entity.slug)
      expect(entity.admin?.group).toBe(false)
    }
  })

  it('draws the CVP collections with the CVP list screen', () => {
    for (const collection of COLLECTIONS) {
      const list = collection.admin?.components?.views?.list
      const drawn = list && 'Component' in list ? list.Component : undefined
      expect(drawn).toBe(
        (CATALOG_SLUGS as readonly string[]).includes(collection.slug) ? CATALOG_LIST : undefined,
      )
    }
  })

  it('refuses an unknown key rather than linking nowhere', () => {
    expect(navHref(MenuKey.Dashboard)).toBe('/admin')
    expect(() => navHref('no-such-menu')).toThrow(/Unknown menu/)
  })
})
