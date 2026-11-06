"use client";

import React from "react";

import { Spinner } from "@/admin/design/controls";

import styles from "./DataState.module.css";
import { isTransportNoise } from "../../apiError";
import { useT } from "../../i18n/useT";

/**
 * What a screen shows when it cannot show what it is for.
 *
 * A failed load used to print the exception — "Error: fetch failed" — in the
 * middle of an otherwise empty page. That sentence is addressed to whoever
 * wrote the fetch, not to whoever opened the screen: it says nothing about
 * what is missing and offers nothing to do about it. Both are what this covers.
 */

const NoDataMark = () => (
  <svg
    aria-hidden="true"
    className={styles.icon}
    fill="none"
    focusable="false"
    height="52"
    viewBox="0 0 52 52"
    width="52"
  >
    <path
      d="M9 29V14a3 3 0 0 1 3-3h28a3 3 0 0 1 3 3v15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
    />
    <path
      d="M9 29h9l3 5h10l3-5h9v9a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="2"
    />
    <path d="M20 19h12M20 24h7" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
  </svg>
);

/**
 * The headline says what happened, not "no data".
 *
 * It used to read "Không có dữ liệu" over every case — a load that failed (the
 * data may well be there), a role without the permission, a screen waiting for
 * a tenant to be picked — and the default line under it blamed "the API" even
 * where nothing had been fetched. Now:
 *
 * - `reason` alone is the headline: "pick a tenant", "you may not read this",
 *   "not found" — the caller knows what happened, so that is what it says;
 * - `title` + `reason` is a headline with a line under it;
 * - neither is a failed load: `state.loadFailedTitle` over `state.loadFailed`.
 *
 * `detail` is the raw message from below. It stays on screen, small, when it is
 * a service's own sentence — the only thing that says WHICH call broke — and is
 * dropped when it is transport noise ("fetch failed", "HTTP 500") or a repeat
 * of the line above it.
 *
 * There is no retry button. Reloading is what the browser's own reload does,
 * and a button that only repeats it earns a place on the screen from nobody.
 */
export const NoData = ({
  action,
  detail,
  fill = false,
  reason,
  title,
}: {
  /** A way out of the empty state, when there is one — usually one button. */
  action?: React.ReactNode;
  detail?: null | string;
  /** Set when this stands in for a whole screen rather than a panel's body. */
  fill?: boolean;
  reason?: string;
  title?: string;
}) => {
  const t = useT();

  const failedLoad = !title && !reason;
  const headline = title ?? reason ?? t("state.loadFailedTitle");
  const line = failedLoad ? t("state.loadFailed") : title && reason ? reason : null;
  /* The shared "could not complete the action" adds nothing under a headline
     that already says which action. */
  const extra =
    detail &&
    !isTransportNoise(detail) &&
    detail !== headline &&
    detail !== line &&
    detail !== t("common.actionFailed")
      ? detail
      : null;

  return (
    <div className={`${styles.block} ${fill ? styles.fill : ""}`}>
      <NoDataMark />
      <p className={styles.title}>{headline}</p>
      {line && <p className={styles.reason}>{line}</p>}
      {extra && <p className={styles.detail}>{extra}</p>}
      {action}
    </div>
  );
};

/**
 * Covers what is already on screen rather than replacing it: a reload keeps the
 * table where it was, so the page does not collapse to a spinner and jump back.
 * The host needs a positioned box — `loadingHost` is that class.
 */
export const LoadingOverlay = () => {
  const t = useT();

  return (
    <div className={styles.overlay}>
      <Spinner label={t("state.loading")} size="md" />
      <span>{t("state.loading")}</span>
    </div>
  );
};

/** For the element the overlay sits on. */
export const loadingHost = styles.host;
