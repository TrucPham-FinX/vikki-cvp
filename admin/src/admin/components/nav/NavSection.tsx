"use client";

import { Link } from "@payloadcms/ui";
import { usePathname } from "next/navigation";
import React, { useLayoutEffect, useState } from "react";

import { navHref } from "@/access/menuCatalog";
import { useT } from "@/admin/i18n/useT";
import { NavIcon, type NavIconName } from "./icons";
import { readSectionCollapsed, writeSectionCollapsed } from "./navMemory";
import styles from "./NavSection.module.css";

/**
 * One collapsible group of sidebar links — galaxy-g-admin's `NavSection`, without the parts the
 * CVP admin has no use for: there are no menu permissions to filter by (every editor sees every
 * menu), no four-eyes menus and no count badges.
 *
 * The row is `@payloadcms/ui`'s `Link`, so a click is a client-side transition, not a reload.
 */

export interface NavSectionItem {
  /** Menu catalog key: where the row goes comes from the catalog, never from here. */
  menuKey: string;
  label: string;
  icon: NavIconName;
  /** Match only this exact path — for `/admin`, which prefixes everything. */
  exact?: boolean;
  /** Keep the row on screen, muted and not a link. */
  inactive?: boolean;
  /** Tooltip on an inactive row. Falls back to the "not available yet" copy. */
  disabledHint?: string;
}

/** Strip query params before comparing — `pathname` never carries one. */
const pathMatches = (pathname: string, base: string, exact?: boolean): boolean => {
  const itemPath = base.split("?")[0] ?? base;
  return exact
    ? pathname === itemPath
    : pathname.startsWith(itemPath) && ["/", undefined].includes(pathname[itemPath.length]);
};

const matches = (pathname: string, item: NavSectionItem): boolean =>
  pathMatches(pathname, navHref(item.menuKey), item.exact);

export function NavSection({
  sectionKey,
  label,
  items,
  defaultOpen = false,
}: {
  /** Stable id for collapse memory — never the translated `label`. */
  sectionKey: string;
  label: string;
  items: NavSectionItem[];
  defaultOpen?: boolean;
}) {
  const pathname = usePathname() || "";
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const t = useT();

  const holdsActive = items.some((item) => !item.inactive && matches(pathname, item));

  /*
   * What the user chose for this section last, then "the section you are standing in is open",
   * then the section's own default. In a layout effect because the rail renders on the server,
   * where sessionStorage does not exist; before paint is early enough that nothing moves.
   */
  useLayoutEffect(() => {
    const chosen = readSectionCollapsed(sectionKey);
    setCollapsed(chosen ?? !(defaultOpen || holdsActive));
  }, [defaultOpen, holdsActive, sectionKey]);

  if (items.length === 0) return null;

  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.kicker}
        onClick={() =>
          setCollapsed((current) => {
            writeSectionCollapsed(sectionKey, !current);
            return !current;
          })
        }
        aria-expanded={!collapsed}
      >
        <span className={styles.kickerLabel}>{label}</span>
        <span className={styles.kickerToggle}>{collapsed ? "+" : "–"}</span>
      </button>

      {!collapsed && (
        <div className={styles.items}>
          {items.map((item) => {
            if (item.inactive) {
              return (
                <span
                  key={item.menuKey}
                  className={`${styles.navItem} ${styles.navItemInactive}`}
                  title={item.disabledHint ?? t("nav.inactiveHint")}
                  aria-disabled="true"
                >
                  <span className={styles.accentBar} />
                  <NavIcon name={item.icon} />
                  <span className={styles.navLabel}>{item.label}</span>
                </span>
              );
            }

            const isActive = matches(pathname, item);
            const href = navHref(item.menuKey);

            return (
              <Link
                key={item.menuKey}
                href={href}
                prefetch={false}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                {...(isActive ? { "aria-current": "page" as const } : {})}
              >
                <span
                  className={`${styles.accentBar} ${isActive ? styles.accentBarVisible : ""}`}
                />
                <NavIcon name={item.icon} />
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
