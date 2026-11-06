"use client";

import { useTheme } from "@payloadcms/ui";
import React from "react";

import { useT } from "../i18n/useT";

/**
 * Light/dark switcher in the admin header, registered through
 * `admin.components.actions` and placed to the left of the account avatar by the
 * `order` rules in `shell.scss`.
 *
 * `useTheme()` already owns the hard parts: `setTheme` persists the choice in the
 * `payload-theme` cookie and sets `data-theme` on `<html>`, which is what the
 * whole token ramp in `shell.scss` keys off. So this is purely a control — no
 * theme state of its own to drift out of sync.
 *
 * It toggles between the two explicit themes rather than cycling through `auto`.
 * A header control should take one click to do the obvious thing; `auto` is
 * still reachable from **Account → Theme** for anyone who wants to hand the
 * choice back to the OS.
 */

const SunIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="20"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="1.5"
    viewBox="0 0 20 20"
    width="20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="10" cy="10" r="3.5" />
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" />
  </svg>
);

const MoonIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="20"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
    viewBox="0 0 20 20"
    width="20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M16.5 12.4A6.8 6.8 0 0 1 7.6 3.5a6.8 6.8 0 1 0 8.9 8.9Z" />
  </svg>
);

export const ThemeToggle: React.FC = () => {
  const { autoMode, setTheme, theme } = useTheme();
  const t = useT();

  const nextTheme = theme === "dark" ? "light" : "dark";
  // One key per sentence: the "following your system" half is its own sentence.
  const label = t(nextTheme === "dark" ? "theme.toDark" : "theme.toLight");
  const title = autoMode
    ? t(nextTheme === "dark" ? "theme.toDarkAuto" : "theme.toLightAuto")
    : label;

  return (
    <button
      aria-label={label}
      className="header-icon-btn theme-toggle"
      onClick={() => setTheme(nextTheme)}
      title={title}
      type="button"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
};
