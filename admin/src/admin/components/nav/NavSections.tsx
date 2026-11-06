"use client";

import React from "react";

import { MENU_GROUPS, menusIn } from "@/access/menuCatalog";
import { useT } from "@/admin/i18n/useT";
import { NavSection } from "./NavSection";

/**
 * The sidebar: one section per menu group, rows straight from `access/menuCatalog.ts`.
 *
 * galaxy-g-admin writes one component per section because its rows carry per-section rules
 * (placeholders, permission gates). The CVP's menus carry none, so the sections are drawn from
 * the catalog and a new menu is one catalog row plus its `nav.*` keys.
 *
 * Registered in `admin.components.beforeNavLinks`; the collections and the global set
 * `admin.group: false`, so Payload's own nav links stay out of the rail.
 */
export default function NavSections() {
  const t = useT();

  return (
    <div className="nav-sections">
      {MENU_GROUPS.map((group, index) => (
        <NavSection
          key={group.key}
          defaultOpen={index === 0}
          sectionKey={group.key}
          label={t(group.labelKey)}
          items={menusIn(group.key).map((menu) => ({
            menuKey: menu.key,
            label: t(menu.labelKey),
            icon: menu.icon,
            exact: menu.exact,
          }))}
        />
      ))}
    </div>
  );
}
