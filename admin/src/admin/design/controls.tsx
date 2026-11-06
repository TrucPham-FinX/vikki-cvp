"use client";

import React, { useId } from "react";

import styles from "./controls.module.css";

/**
 * The four controls galaxy-g-admin takes from `@galaxyfinx/galaxy-g-core-ui-web`, drawn here
 * instead.
 *
 * The CVP admin does not depend on core-ui: it is a private package on GitHub Packages, and this
 * repo's CI has no token for it. Everything else in `design.tsx` is galaxy-g-admin's own code;
 * these keep the same props, so a screen reads the same in both repos and the design layer can be
 * re-synced by copying `design.tsx` again and pointing its core-ui import here.
 *
 * Colours are the design layer's `--d-*` tokens, so both themes follow.
 */

const cx = (...parts: (false | null | string | undefined)[]) => parts.filter(Boolean).join(" ");

type Size = "sm" | "md" | "lg";

/* ── FormField ──────────────────────────────────────────────────────────── */

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  error?: string | undefined;
  helper?: string | undefined;
  /** The control's id, so clicking the label focuses it. */
  htmlFor?: string;
  label?: string | undefined;
  required?: boolean | undefined;
  /** Accepted for core-ui parity; `.scope` sets one size for every field. */
  size?: Size | undefined;
}

/** Label, control, then the helper — or the error in its place, announced. */
export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(function FormField(
  { children, className, error, helper, htmlFor, label, required, size: _size, ...rest },
  ref,
) {
  const messageId = useId();
  const message = error ?? helper;

  return (
    <div ref={ref} className={cx(styles.field, className)} {...rest}>
      {label ? (
        <label className={styles.fieldLabel} htmlFor={htmlFor}>
          {label}
          {required ? (
            <span aria-hidden className={styles.fieldRequired}>
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {message ? (
        <p
          className={cx(styles.fieldMessage, error && styles.fieldError)}
          id={messageId}
          role={error ? "alert" : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
});

/* ── Checkbox ───────────────────────────────────────────────────────────── */

export interface CheckboxProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "checked" | "disabled" | "onChange" | "size" | "type"
  > {
  checked?: boolean;
  children?: React.ReactNode;
  disabled?: boolean;
  /** The NEW checked value, as core-ui's does — not a DOM event. */
  onChange?: (checked: boolean) => void;
  size?: Size;
}

/**
 * A real checkbox input under a painted box.
 *
 * The wrapper keeps core-ui's class name, `gg-checkbox`: `D.CheckRow` toggles on a click anywhere
 * in its row EXCEPT on `label.gg-checkbox`, which toggles itself, and a click must not count twice.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { checked = false, children, className, disabled = false, onChange, size = "md", ...rest },
  ref,
) {
  return (
    <label
      className={cx("gg-checkbox", styles.checkbox, styles[`checkbox_${size}`], className)}
      data-disabled={disabled || undefined}
    >
      <input
        ref={ref}
        checked={checked}
        className={styles.checkboxInput}
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onChange?.(event.target.checked)}
        {...rest}
      />
      <span aria-hidden className={styles.checkboxBox}>
        <svg fill="none" viewBox="0 0 12 12">
          <path
            d="M2.5 6.2 4.8 8.5 9.5 3.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </span>
      {children ? <span className={styles.checkboxLabel}>{children}</span> : null}
    </label>
  );
});

/* ── Spinner ────────────────────────────────────────────────────────────── */

export function Spinner({ label, size = "md" }: { label?: string; size?: Size }) {
  return (
    <span
      aria-label={label}
      className={cx(styles.spinner, styles[`spinner_${size}`])}
      role={label ? "status" : undefined}
    />
  );
}

/* ── Toast ──────────────────────────────────────────────────────────────── */

const TOAST_TONE: Record<"danger" | "info" | "success" | "warning", string | undefined> = {
  danger: styles.toastBad,
  info: styles.toastInfo,
  success: styles.toastOk,
  warning: styles.toastWarn,
};

/** One card of the toast stack: accent, headline, the detail under it, a close button. */
export function Toast({
  dismissible = false,
  dismissLabel = "Đóng",
  message,
  onDismiss,
  title,
  tone,
}: {
  dismissible?: boolean;
  dismissLabel?: string;
  message?: string;
  onDismiss?: () => void;
  title: string;
  tone: keyof typeof TOAST_TONE;
}) {
  return (
    <div className={cx(styles.toast, TOAST_TONE[tone])} role={tone === "danger" ? "alert" : undefined}>
      <span aria-hidden className={styles.toastAccent} />
      <div className={styles.toastText}>
        <p className={styles.toastTitle}>{title}</p>
        {message ? <p className={styles.toastMessage}>{message}</p> : null}
      </div>
      {dismissible ? (
        <button
          aria-label={dismissLabel}
          className={styles.toastClose}
          title={dismissLabel}
          type="button"
          onClick={onDismiss}
        >
          <svg aria-hidden fill="none" height="14" viewBox="0 0 14 14" width="14">
            <path
              d="m3.5 3.5 7 7m0-7-7 7"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
