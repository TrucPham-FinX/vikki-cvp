"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { Toast } from "@/admin/design/controls";
import { useT } from "@/admin/i18n/useT";

import styles from "./Toasts.module.css";

/**
 * Result messages, top-right.
 *
 * core-ui ships the toast's looks but leaves placement to the renderer — "a
 * renderer concern", says its own source — so the stack is positioned here and
 * the card itself is still the house component.
 *
 * Two rules the callers depend on:
 *
 * - a failure carries the service's own words underneath the headline, cut at
 *   `DETAIL_MAX`. An upstream refusal is the useful part; a stack trace pasted
 *   into a toast is not a toast any more.
 * - a failure does not dismiss itself. A message the operator did not see is a
 *   message they cannot act on, and the action it reports on did not happen.
 */

export type ToastTone = "danger" | "info" | "success" | "warning";

type ToastInput = {
  /** The service's own words. Shown small, under the headline. */
  detail?: string;
  message: string;
  tone: ToastTone;
};

type Entry = ToastInput & { id: number };

type Api = { show: (toast: ToastInput) => void };

const ToastContext = createContext<Api | null>(null);

/**
 * Throws outside a provider rather than no-opping.
 *
 * A silent no-op is a toast that never appears with nothing in the console, and
 * the call site looks right — so the search starts in the wrong place.
 */
export const useToasts = (): Api => {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToasts() needs a <Toasts> above it");
  return api;
};

const DISMISS_MS = 4000;

/**
 * How much of a service's own wording a toast will carry.
 *
 * The detail is upstream prose now — the point of passing it through — and
 * upstream prose is occasionally a validation dump or a stack trace. A toast
 * that grows to fill the viewport has stopped being a toast, and the three-line
 * clamp that used to do this job went with the wrapper element when the detail
 * moved into core-ui's own text slot, which takes a string and has no class of
 * ours to hang a clamp on.
 *
 * Cut rather than hidden: the ellipsis says there is more, and the full text is
 * in the server log under the request id the failure already carries.
 */
const DETAIL_MAX = 220;

const clamp = (detail?: string): string | undefined =>
  detail && detail.length > DETAIL_MAX ? `${detail.slice(0, DETAIL_MAX).trimEnd()}…` : detail;

export function Toasts({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [entries, setEntries] = useState<Entry[]>([]);
  const next = useRef(0);

  /*
   * The portal waits for the first effect.
   *
   * `typeof document !== "undefined"` looks like the right guard and is exactly
   * the branch React reports as a hydration mismatch: the server renders
   * nothing and the client's FIRST render adds a `<div role="status">` to
   * `document.body`, so the two trees disagree and React throws out the whole
   * subtree and rebuilds it — every screen under a `<Toasts>` re-rendered from
   * scratch, with "Hydration failed because the server rendered HTML didn't
   * match the client" in the console.
   *
   * An effect runs only on the client and only after hydration, so both sides
   * agree on the first pass and the viewport appears on the second. Nothing can
   * be in it before then: a toast needs a click, and there has not been one.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const drop = useCallback((id: number) => {
    setEntries((rows) => rows.filter((row) => row.id !== id));
  }, []);

  const show = useCallback(
    (toast: ToastInput) => {
      const id = (next.current += 1);
      // Three at once; older ones go rather than queue behind. A backlog
      // appearing one by one after the operator moved on is worse than nothing.
      setEntries((rows) => [...rows, { ...toast, id }].slice(-3));

      if (toast.tone !== "danger") {
        setTimeout(() => drop(id), DISMISS_MS);
      }
    },
    [drop],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div className={styles.viewport} role="status" aria-live="polite">
            {entries.map((entry) => (
              <div className={styles.item} key={entry.id}>
                {/*
                 * The detail goes in `message`, not in children.
                 *
                 * core-ui's `Toast` draws its own slots — accent, title, text,
                 * dismiss — and renders no children at all. The second line was
                 * passed as one, so every refusal this portal has ever shown
                 * arrived as its headline alone: "Assignment failed — 0/1 done"
                 * with the service's reason dropped on the floor. It type-checks
                 * because `children` is on `HTMLAttributes`.
                 */}
                <Toast
                  dismissible
                  dismissLabel={t("common.close")}
                  message={clamp(entry.detail)}
                  title={entry.message}
                  tone={entry.tone}
                  onDismiss={() => drop(entry.id)}
                />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
