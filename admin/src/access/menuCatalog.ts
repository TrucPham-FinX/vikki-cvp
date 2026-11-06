import type { NavIconName } from "../admin/components/nav/icons";
import type { TranslationKey } from "../admin/i18n/dictionary";

/**
 * The CVP admin's menus: the sidebar's rows, and the only place a menu's path lives.
 *
 * Same shape as galaxy-g-admin's `access/menuCatalog.ts`, without its permissions half: every
 * signed-in editor may open every menu here (collection access is `signedIn`, see
 * `cvp/access.ts`), so there is no role to filter rows by. A menu that needs one later gets it in
 * the collection's `access` first; the sidebar is advisory either way.
 */

export type MenuGroup = {
  key: string;
  labelKey: TranslationKey;
};

export type MenuEntry = {
  key: string;
  group: MenuGroup["key"];
  labelKey: TranslationKey;
  icon: NavIconName;
  href: string;
  /** Match only this exact path — for `/admin`, which prefixes everything. */
  exact?: boolean;
  /** The Payload collection or global the menu opens, when it opens one. */
  collection?: string;
  global?: string;
};

/** Canonical keys: use these rather than string literals. */
export const MenuKey = {
  Dashboard: "cvp-dashboard",
  Pages: "cvp-pages",
  Documents: "cvp-documents",
  Promotions: "promotions",
  CardIntros: "card-intros",
  ListSettings: "cvp-lists",
  Media: "cvp-media",
  Users: "users",
} as const;

export type MenuKeyValue = (typeof MenuKey)[keyof typeof MenuKey];

/** Sidebar order: overview, the pages' content, offers and cards, then the system. */
export const MENU_GROUPS: MenuGroup[] = [
  { key: "overview", labelKey: "nav.overview" },
  { key: "content", labelKey: "nav.content" },
  { key: "offers", labelKey: "nav.offers" },
  { key: "system", labelKey: "nav.system" },
];

export const ALL_MENUS: MenuEntry[] = [
  {
    key: MenuKey.Dashboard,
    group: "overview",
    labelKey: "nav.dashboard",
    icon: "gauge",
    href: "/admin",
    exact: true,
  },
  {
    key: MenuKey.Pages,
    group: "content",
    labelKey: "nav.pages",
    icon: "layers",
    href: "/admin/collections/cvp-pages",
    collection: "cvp-pages",
  },
  {
    key: MenuKey.Documents,
    group: "content",
    labelKey: "nav.documents",
    icon: "list",
    href: "/admin/collections/cvp-documents",
    collection: "cvp-documents",
  },
  {
    key: MenuKey.Media,
    group: "content",
    labelKey: "nav.media",
    icon: "image",
    href: "/admin/collections/cvp-media",
    collection: "cvp-media",
  },
  {
    key: MenuKey.Promotions,
    group: "offers",
    labelKey: "nav.promotions",
    icon: "megaphone",
    href: "/admin/collections/promotions",
    collection: "promotions",
  },
  {
    key: MenuKey.CardIntros,
    group: "offers",
    labelKey: "nav.cardIntros",
    icon: "creditCard",
    href: "/admin/collections/card-intros",
    collection: "card-intros",
  },
  {
    key: MenuKey.ListSettings,
    group: "offers",
    labelKey: "nav.listSettings",
    icon: "settings",
    href: "/admin/globals/cvp-lists",
    global: "cvp-lists",
  },
  {
    key: MenuKey.Users,
    group: "system",
    labelKey: "nav.users",
    icon: "users",
    href: "/admin/collections/users",
    collection: "users",
  },
];

const BY_KEY = new Map(ALL_MENUS.map((menu) => [menu.key, menu]));

export const menuOf = (key: string): MenuEntry | undefined => BY_KEY.get(key);

/** The menu's path. An unknown key is a programming error, not a page to send someone to. */
export function navHref(key: string): string {
  const menu = BY_KEY.get(key);
  if (!menu) throw new Error(`Unknown menu "${key}" — add it to access/menuCatalog.ts`);
  return menu.href;
}

/** The menus of one sidebar group, in catalog order. */
export const menusIn = (group: string): MenuEntry[] =>
  ALL_MENUS.filter((menu) => menu.group === group);
