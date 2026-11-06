import type { ServerProps } from "payload";
import { Link } from "@payloadcms/ui";
import React from "react";

import type { User } from "@/payload-types";
import { translator } from "../i18n/dictionary";

/**
 * Signed-in editor card pinned to the bottom of the sidebar: [initials · email · role] and the
 * logout control — the one account surface in the admin. Payload's header avatar is hidden in
 * shell.scss and its nav logout renders nothing (`NoNavLogout` below).
 *
 * A server component (`afterNavLinks`), so the language comes from `props.i18n`. The identity is
 * Payload's `Link` so it soft-navigates; logout is a hard navigation to Payload's own route.
 */
export function NavUserCard(props: ServerProps) {
  const user = props.user as User | null | undefined;
  const t = translator(props.i18n?.language);
  if (!user) return null;

  const name: string = user.email || "—";
  const initials =
    name
      .split("@")[0]
      ?.split(/[.\-_\s]+/)
      .map((part: string) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="nav-user-card">
      <Link className="nav-user-card__identity" href="/admin/account" title={t("nav.account")}>
        <span aria-hidden className="nav-user-card__avatar">
          {initials}
        </span>
        <span className="nav-user-card__text">
          <span className="nav-user-card__name">{name}</span>
          <span className="nav-user-card__role">{t("nav.roleEditor")}</span>
        </span>
      </Link>

      <a
        aria-label={t("nav.logout")}
        className="nav-user-card__logout"
        href="/admin/logout"
        title={t("nav.logout")}
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="18"
          viewBox="0 0 20 20"
          width="18"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 16H14.6667C15.0203 16 15.3594 15.8595 15.6095 15.6095C15.8595 15.3594 16 15.0203 16 14.6667V5.33333C16 4.97971 15.8595 4.64057 15.6095 4.39052C15.3594 4.14048 15.0203 4 14.6667 4H12M7.33333 13.3333L4 10M4 10L7.33333 6.66667M4 10H12"
            stroke="currentColor"
            strokeLinecap="square"
            strokeWidth="1.5"
          />
        </svg>
      </a>
    </div>
  );
}

/** Payload's own nav logout: nothing, the user card above carries it. */
export function NoNavLogout() {
  return null;
}
