"use client";

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
/*
 * galaxy-g-admin imports these two from @galaxyfinx/galaxy-g-core-ui-web; the CVP admin draws its
 * own with the same props (see ./controls). The rest of this file is galaxy-g-admin's, unchanged.
 */
import { Checkbox as CoreCheckbox, FormField as CoreFormField } from "./controls";

export const FormField = CoreFormField;

import styles from "./design.module.css";

/**
 * The pieces the tenant screens are drawn from, per "Galaxy G Admin — Unified
 * Screens".
 *
 * These are deliberately thin. Anything core-ui already answers — buttons,
 * inputs, checkboxes, the grid — is used directly and restyled through the
 * variables `design.module.css` retunes. What lives here is only the chrome the
 * design invents and core-ui has no component for: the bordered panel with its
 * header strip, the five badge tones, the toolbar row, the name cell.
 *
 * Keeping them here rather than in `ui.tsx` is on purpose: that module is shared
 * with screens still on the old look, and changing it would repaint them too.
 */

export type Tone = "danger" | "info" | "neutral" | "success" | "warning";

const TONE_CLASS: Record<Tone, string> = {
  danger: styles.toneDanger,
  info: styles.toneInfo,
  neutral: styles.toneNeutral,
  success: styles.toneSuccess,
  warning: styles.toneWarning,
};

const cx = (...parts: (false | null | string | undefined)[]) => parts.filter(Boolean).join(" ");

/**
 * The design's scope, and the brand that supplies its blue.
 *
 * `gg-brand-vikki` is core-ui's own class; without it the components below it
 * render in the library's default indigo rather than the design's #0000FF.
 */
export function Scope({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx(styles.scope, "gg-brand-vikki", className)}>{children}</div>;
}

/** The screen frame: one column, the design's gap, capped at its measure. */
export function Screen({
  children,
  flushBottom = false,
}: {
  children: React.ReactNode;
  /**
   * The last child reaches the bottom edge.
   *
   * Only for a screen ending in a `position: sticky; bottom: 0` element — see
   * `.screenFlush`. Everything else wants the default, which spaces the last
   * section off the bottom by the same 20px it is spaced from its neighbour.
   */
  flushBottom?: boolean;
}) {
  return <div className={cx(styles.screen, flushBottom && styles.screenFlush)}>{children}</div>;
}

export function Head({
  actions,
  subtitle,
  title,
}: {
  actions?: React.ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <div className={styles.head}>
      <div className={styles.headText}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.headActions}>{actions}</div> : null}
    </div>
  );
}

/**
 * A bordered card. `note` is the muted line opposite the title — the design
 * uses it for provenance ("Source: fsap-config · tenants").
 *
 * `padded` fills the body with the design's 16px; a panel holding a table or
 * its own rows leaves it off and lets the rows meet the border.
 *
 * Pass `onToggle` and the title turns into the card's own disclosure — the
 * pattern the mini app edit screen already draws over its capability groups,
 * here on the card itself so a form of ninety fields opens one section at a
 * time instead of arriving as one scroll. `actions` stay outside the button,
 * because a control inside a button is a control nobody can click.
 */
export function Panel({
  children,
  clip = false,
  note,
  onToggle,
  open,
  padded = false,
  title,
  actions,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
  /**
   * Round off whatever meets the bottom edge — a table's last row, a pager.
   *
   * Off by default: clipping also swallows any popover opened inside the panel.
   * See the note on `.panel` in the stylesheet.
   */
  clip?: boolean;
  note?: React.ReactNode;
  /** Makes the card a disclosure. Without it `open` is ignored. */
  onToggle?: () => void;
  /** Whether the body is showing. Only read when `onToggle` is given. */
  open?: boolean;
  padded?: boolean;
  title?: React.ReactNode;
}) {
  const shown = onToggle === undefined || open !== false;
  const trail =
    actions ?? (note !== undefined ? <span className={styles.panelNote}>{note}</span> : null);

  return (
    <section className={cx(styles.panel, clip && styles.panelClip)}>
      {title !== undefined ? (
        <header className={styles.panelHead}>
          {onToggle ? (
            <button
              aria-expanded={shown}
              className={styles.panelToggle}
              type="button"
              onClick={onToggle}
            >
              <span aria-hidden className={cx(styles.panelCaret, shown && styles.panelCaretOpen)}>
                ▸
              </span>
              <span className={styles.panelTitle}>{title}</span>
            </button>
          ) : (
            <span className={styles.panelTitle}>{title}</span>
          )}
          {/*
            One trail node so `space-between` keeps actions (or the note) on the
            right. A Fragment of buttons would otherwise become sibling flex
            children and fan out across the header.
          */}
          {trail ? <div className={styles.headActions}>{trail}</div> : null}
        </header>
      ) : null}
      {shown ? <div className={padded ? styles.panelBody : undefined}>{children}</div> : null}
    </section>
  );
}

/** The uppercase strip that opens a field group inside a panel. */
export function SectionHead({ children }: { children: React.ReactNode }) {
  return <div className={styles.sectionHead}>{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={cx(styles.badge, TONE_CLASS[tone])}>{children}</span>;
}

/**
 * Standard mapper from domain status strings to the 5 semantic Badge tones:
 * - "success": ACTIVE, ONLINE, ISSUED, APPROVED, PASSED, SUCCESS, PRODUCTION, HEALTHY, LIVE, GRANTED, DONE, RESOLVED
 * - "danger": INACTIVE, FAILED, ERROR, REJECTED, SUSPENDED, REVOKED, OFFLINE, BLOCKED, DELETED
 * - "warning": PENDING, IN_PROGRESS, ONBOARDING, STAGING, UAT, DRAFT, WARN, WARNING, REVIEW_NEEDED, EXPIRING, TRIAL, CAUTION, READY
 * - "info": BUILDING, DEV, TEST, INTEGRATION, DISPATCHED, QUEUED, SYNCING
 * - "neutral": fallback for unclassified, NONE, UNKNOWN — and TERMINATED, ARCHIVED
 *
 * One status, one tone, portal-wide. Two tenant states are deliberate:
 * ONBOARDING is a tenant mid-flight, so it reads as pending; TERMINATED is a
 * contract that ran to its end, not a fault — a wall of red on a dashboard of
 * former tenants would say something went wrong when nothing did.
 */
export function statusToBadgeTone(status: string | null | undefined): Tone {
  if (!status) return "neutral";
  const s = status.trim().toUpperCase();

  if (
    s === "ACTIVE" ||
    s === "ONLINE" ||
    s === "ISSUED" ||
    s === "APPROVED" ||
    s === "PASSED" ||
    s === "SUCCESS" ||
    s === "PRODUCTION" ||
    s === "PROD" ||
    s === "HEALTHY" ||
    s === "LIVE" ||
    s === "GRANTED" ||
    s === "DONE" ||
    s === "VERIFIED" ||
    s === "CURRENT" ||
    s === "COMPLETED" ||
    s === "PUBLISHED" ||
    s === "RESOLVED"
  ) {
    return "success";
  }

  if (
    s === "INACTIVE" ||
    s === "FAILED" ||
    s === "ERROR" ||
    s === "REJECTED" ||
    s === "SUSPENDED" ||
    s === "REVOKED" ||
    s === "OFFLINE" ||
    s === "BLOCKED" ||
    s === "DEPRECATED" ||
    s === "DELETED"
  ) {
    return "danger";
  }

  /*
   * Ended on purpose, not broken — these stay neutral.
   *
   * `TERMINATED` and `ARCHIVED` are a contract that finished and a record put
   * away; neither asks anyone to do anything. Red is reserved for the states
   * that do, which on a tenant is `SUSPENDED`. Painting a closed account the
   * same colour as a failed one is how an operator learns to stop reading the
   * colour.
   */
  if (
    s === "TERMINATED" ||
    s === "ARCHIVED" ||
    s === "CLOSED" ||
    s === "CANCELLED" ||
    s === "SKIPPED"
  ) {
    return "neutral";
  }

  if (
    s === "PENDING" ||
    s === "IN_PROGRESS" ||
    s === "IN PROGRESS" ||
    s === "ONBOARDING" ||
    s === "STAGING" ||
    s === "UAT" ||
    s === "DRAFT" ||
    s === "WARN" ||
    s === "WARNING" ||
    s === "REVIEW_NEEDED" ||
    s === "EXPIRING" ||
    s === "TRIAL" ||
    s === "CAUTION" ||
    s === "ONBOARDING" ||
    s === "CHANGES_REQUESTED" ||
    s === "IN_CERTIFICATION" ||
    s === "ROLLING_OUT" ||
    s === "READY"
  ) {
    return "warning";
  }

  if (
    s === "BUILDING" ||
    s === "DEV" ||
    s === "STG" ||
    s === "TEST" ||
    s === "INTEGRATION" ||
    s === "DISPATCHED" ||
    s === "QUEUED" ||
    s === "VERIFYING" ||
    s === "SYNCING"
  ) {
    return "info";
  }

  return "neutral";
}

export function StatusBadge({
  dot = false,
  label,
  status,
  tone,
}: {
  dot?: boolean;
  label?: React.ReactNode;
  status: string;
  tone?: Tone;
}) {
  const resolvedTone = tone ?? statusToBadgeTone(status);
  return (
    <Badge tone={resolvedTone}>
      <span className={styles.statusBadge}>
        {dot ? <span className={styles.statusBadgeDot} /> : null}
        {label ?? status}
      </span>
    </Badge>
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className={styles.toolbar}>{children}</div>;
}

export const ToolbarSpacer = () => <span className={styles.toolbarSpacer} />;

export function ToolbarCount({ children }: { children: React.ReactNode }) {
  return <span className={styles.toolbarCount}>{children}</span>;
}

export function SearchIcon() {
  return (
    <svg
      className={styles.searchIcon}
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="14"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/*
 * The design's own glyphs, traced from its markup rather than mapped onto
 * core-ui's icon set — the set has no download-tray at this weight, and a
 * near-miss beside an exact one is what makes a toolbar look assembled.
 *
 * Decorative: every one of them sits next to a label that already names it.
 */
export function DownloadIcon() {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="14"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m8 12 4 4 4-4M12 3v13" />
    </svg>
  );
}

/** `DownloadIcon` turned around — the same tray, the arrow going in. */
export function UploadIcon() {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="14"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m16 7-4-4-4 4M12 3v13" />
    </svg>
  );
}

/** The three-dot overflow glyph, at the mockup's 15px. */
export function MoreIcon() {
  return (
    <svg fill="currentColor" height="15" viewBox="0 0 24 24" width="15" aria-hidden>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="14"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** The edit verb, for a control with no room for the word. */
export function PencilIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={size}
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/**
 * Wraps an avatar so a pencil appears in its corner on hover.
 *
 * The caller keeps ownership of the click — this is a frame, not a button —
 * because the avatar's control is a `<label>` around a hidden file input on one
 * screen and may be something else on the next.
 */
export function AvatarEdit({
  busy = false,
  children,
}: {
  /** Upload in flight: the pencil stays up, since the caption that used to say
      so is gone. */
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={cx(styles.avatarEdit, busy && styles.avatarBusy)}>
      {children}
      <span className={styles.avatarPen}>
        <PencilIcon />
      </span>
    </span>
  );
}

export function ChevronLeftIcon() {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="14"
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="14"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="14"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/** Search box. Uncontrolled height by design — see the note in the stylesheet. */
export function Search({
  onChange,
  onSubmit,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  /**
   * Enter was pressed.
   *
   * For a search the SERVER runs. The tenant lists filter rows already in the
   * browser, so every keystroke can narrow them for free; a CRUD list asks the
   * service, and searching per keystroke would be a request per letter. Those
   * screens keep the typing local and pass this to say when to go.
   */
  onSubmit?: () => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className={styles.search}>
      <SearchIcon />
      <input
        aria-label={placeholder}
        className={styles.searchInput}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onSubmit) onSubmit();
        }}
      />
    </div>
  );
}

/**
 * A closed set of values, as a dropdown the page owns.
 *
 * It was a native `<select>`, and that is the one control whose list the page
 * cannot reach: the popup is drawn by the browser, so `max-height` and
 * `overflow` on the element style the shut box and nothing else. A brand kit
 * with twenty-one versions therefore opened a list as tall as it liked, and on
 * a short window there was no way to bound it. This draws the list itself —
 * portalled, capped, and scrolled.
 *
 * What the native control gave for free and is restated here: arrow keys, Home
 * and End, Enter and Space, Escape, type-ahead on the option labels, the
 * selected row scrolled into view on open, and `combobox`/`listbox`/`option`
 * roles with `aria-activedescendant` so a screen reader reads the highlight.
 * Focus stays on the trigger throughout, which is what lets one keydown handler
 * serve the whole control.
 *
 * Portalled to `<body>` and placed in viewport coordinates for the same reason
 * `Menu` is: a panel that clips or scrolls would cut the sheet off. It flips
 * above the trigger when there is no room below, and follows scroll and resize.
 */
export function Select({
  ariaLabel,
  disabled,
  onChange,
  options,
  title,
  value,
  width,
}: {
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  /** Native tooltip — used when the control is disabled to say why. */
  title?: string;
  value: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<null | {
    bottom?: number;
    left: number;
    top?: number;
    width: number;
  }>(null);
  /** Which row the keyboard is on. `-1` while shut. */
  const [active, setActive] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  /** Type-ahead buffer, cleared by a pause — the native control's behaviour. */
  const typed = useRef({ at: 0, text: "" });
  const listId = useId();

  const selected = options.findIndex((option) => option.value === value);
  const label = selected >= 0 ? options[selected]!.label : "";

  const place = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    /* One row per option plus the sheet's padding, capped where the stylesheet
       caps it — enough to decide flip vs grow-down. */
    const estimated = Math.min(8 + options.length * 30, 320);
    const below = window.innerHeight - rect.bottom - 8;
    const up = below < estimated && rect.top > below;
    const next: { bottom?: number; left: number; top?: number; width: number } = {
      left: rect.left,
      width: rect.width,
      ...(up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    };

    /*
     * Only when a number actually moved. This runs after every render the sheet
     * is open for, and a fresh object each time is a `setState` each time — the
     * layout effect below then re-runs and React stops the page with "Maximum
     * update depth exceeded". Returning the current object keeps the identity,
     * so the render loop ends where the movement does.
     */
    setCoords((current) =>
      current &&
      current.left === next.left &&
      current.width === next.width &&
      current.top === next.top &&
      current.bottom === next.bottom
        ? current
        : next,
    );
  };

  const close = () => {
    setOpen(false);
    setCoords(null);
    setActive(-1);
  };

  const openSheet = () => {
    place();
    setActive(selected >= 0 ? selected : 0);
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = options[index];
    close();
    if (option && option.value !== value) onChange(option.value);
  };

  useEffect(() => {
    if (!open) return;

    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || sheetRef.current?.contains(target)) return;
      close();
    };
    const onMove = () => place();

    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
    // `place` and `close` are stable for the life of one open sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /*
   * Re-placed after every render the sheet is open for, not only on scroll and
   * resize. The toolbar this control sits in reflows when its list arrives —
   * a count appears, a chip wraps — and the trigger moves without either event
   * firing, which left the sheet parked over the neighbouring filter.
   *
   * A `getBoundingClientRect` per render of an open sheet, which is one read of
   * one element while a dropdown is in front of the reader.
   */
  useLayoutEffect(() => {
    if (open) place();
    /* No dependency list on purpose: every render of an open sheet re-measures. */
  });

  /* The highlighted row has to be on screen, or the arrow keys move something
     nobody can see — which is most of the point of capping the height. */
  useEffect(() => {
    if (!open || active < 0) return;
    const row = sheetRef.current?.children[active] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const step = (delta: number) => {
    if (options.length === 0) return;
    setActive((current) => {
      const from = current < 0 ? selected : current;
      const next = (from < 0 ? 0 : from) + delta;
      return Math.min(Math.max(next, 0), options.length - 1);
    });
  };

  const typeAhead = (key: string) => {
    const now = Date.now();
    const text = (now - typed.current.at < 600 ? typed.current.text : "") + key.toLowerCase();
    typed.current = { at: now, text };

    const found = options.findIndex((option) => option.label.toLowerCase().startsWith(text));
    if (found >= 0) setActive(found);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
        event.preventDefault();
        openSheet();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        step(1);
        return;
      case "ArrowUp":
        event.preventDefault();
        step(-1);
        return;
      case "Home":
        event.preventDefault();
        setActive(0);
        return;
      case "End":
        event.preventDefault();
        setActive(options.length - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(active);
        return;
      case "Escape":
        event.preventDefault();
        close();
        return;
      case "Tab":
        close();
        return;
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          typeAhead(event.key);
        }
    }
  };

  const sheet =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            aria-label={ariaLabel}
            className={styles.selectSheet}
            id={listId}
            ref={sheetRef}
            role="listbox"
            style={{
              bottom: coords.bottom,
              left: coords.left,
              minWidth: coords.width,
              top: coords.top,
            }}
          >
            {options.map((option, index) => (
              <div
                aria-selected={option.value === value}
                className={cx(
                  styles.selectOption,
                  index === active && styles.selectOptionActive,
                  option.value === value && styles.selectOptionOn,
                )}
                id={`${listId}-${index}`}
                key={option.value}
                role="option"
                onClick={() => commit(index)}
                onMouseEnter={() => setActive(index)}
              >
                {option.label}
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={styles.select}
        disabled={disabled}
        ref={triggerRef}
        role="combobox"
        style={width ? { minWidth: width } : undefined}
        title={title}
        type="button"
        onClick={() => (open ? close() : openSheet())}
        onKeyDown={onKeyDown}
      >
        <span className={cx(styles.selectValue, styles.clip)}>{label}</span>
        <span aria-hidden className={styles.selectCaret}>
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12">
            <polyline
              points="6 9 12 15 18 9"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </svg>
        </span>
      </button>
      {sheet}
    </>
  );
}

export function LinkButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={styles.linkButton} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * `LinkButton`'s twin for a destination rather than an action: an anchor that
 * opens in a new tab.
 *
 * An `<a>` and not `router.push`, because the point is to keep the current page
 * — a reviewer following a reference out of a half-read screen should come back
 * to it, not navigate away and lose their place. `rel` is not optional on a
 * `_blank` target: without it the opened page gets a handle on this one.
 */
export function LinkOut({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a className={styles.linkButton} href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  {
    ariaLabel?: string;
    checked: boolean;
    disabled?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
    onChange: (checked: boolean) => void;
  }
>(function Checkbox({ ariaLabel, checked, disabled = false, size, className, onChange }, ref) {
  return (
    <CoreCheckbox
      ref={ref}
      aria-label={ariaLabel}
      checked={checked}
      className={className}
      disabled={disabled}
      size={size}
      onChange={onChange}
    />
  );
});

/** Initials, or the tenant's own logo when it has one. */
export function Avatar({ name, url }: { name: string; url?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return url ? (
    <img alt="" className={styles.avatar} src={url} />
  ) : (
    <span aria-hidden className={styles.avatar}>
      {initials || "?"}
    </span>
  );
}

/** Avatar, then the primary line over a muted one. Both clip rather than wrap. */
export function NameCell({
  avatarUrl,
  name,
  sub,
}: {
  avatarUrl?: string;
  name: string;
  sub?: string;
}) {
  return (
    <div className={styles.nameCell}>
      <Avatar name={name} url={avatarUrl} />
      <span className={styles.nameLines}>
        <span className={cx(styles.nameMain, styles.clip)} title={name}>
          {name}
        </span>
        {sub ? (
          <span className={cx(styles.nameSub, styles.clip)} title={sub}>
            {sub}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * The multiline field core-ui does not ship.
 *
 * Three screens had already drawn their own — the edit wizard's description,
 * the deployment dialog's notes, the detail screen's version notes — from three
 * copies of the same rule block that had drifted on padding and border width
 * alone. A field that looks like core-ui's `Input` is the point, so it is
 * defined here beside the rest of the layer rather than a fourth time.
 *
 * Sits inside a core-ui `FormField`, which carries the label, the helper and
 * the error; this is only the box.
 */
export function Textarea({
  disabled = false,
  onChange,
  placeholder,
  rows = 3,
  value,
  autoFocus,
}: {
  autoFocus?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
}) {
  return (
    <textarea
      autoFocus={autoFocus}
      className={styles.textarea}
      disabled={disabled}
      placeholder={placeholder}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function Mono({ children }: { children: React.ReactNode }) {
  return <span className={styles.mono}>{children}</span>;
}

/**
 * A value the reader has to hand on unchanged, with the handle to take it.
 *
 * The chip is not a `Btn`: copying is a handle on the value beside it, not one
 * of the record's verbs, and at the control height it reads as the latter. See
 * `.copyChip`.
 *
 * Labels arrive as props — this module has no dictionary, and both strings are
 * already `sub.copy` / `sub.copied` at every call site.
 *
 * A blocked clipboard is not reported: the value is on screen in full, which is
 * the fallback the reader would be pointed at anyway.
 */
export function CopyRow({
  children,
  copiedLabel,
  label,
  value,
}: {
  /** What is being copied, as it is drawn — a link, a `Mono`, plain text. */
  children: React.ReactNode;
  copiedLabel: string;
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <span className={styles.copyRow}>
      {children}
      <button
        aria-label={label}
        className={cx(styles.copyChip, copied && styles.copyChipDone)}
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value).then(
            () => setCopied(true),
            () => undefined,
          );
        }}
      >
        {copied ? copiedLabel : label}
      </button>
    </span>
  );
}

/** The design's in-panel empty state, with the way out of it. */
export function Empty({
  action,
  body,
  title,
}: {
  action?: React.ReactNode;
  body?: string;
  title: string;
}) {
  return (
    <div className={styles.empty}>
      <SearchIcon />
      <span className={styles.emptyTitle}>{title}</span>
      {body ? <span className={styles.emptyBody}>{body}</span> : null}
      {action}
    </div>
  );
}

export function BulkBar({ children }: { children: React.ReactNode }) {
  return <div className={styles.bulkBar}>{children}</div>;
}

/*
 * The bar's own furniture. Its buttons are `Btn size="sm"` like every other
 * button in the portal — it used to draw three of its own, at a different
 * height and weight from the ones directly above it in the toolbar.
 */
export const bulk = {
  bar: styles.bulkBar,
  label: styles.bulkLabel,
  rule: styles.bulkRule,
};

/* ── checklist ─────────────────────────────────────────────────────────── */

/**
 * One line of a checklist: box, then label over its note, then a status chip.
 *
 * The whole row is a `<label>` so clicking the text ticks the box — the mockup
 * draws no separate hit target, and a 15px square is a small thing to ask
 * someone to hit.
 */
export function CheckRow({
  ariaLabel,
  checked,
  chip,
  clamp = false,
  disabled = false,
  label,
  note,
  onChange,
  title,
}: {
  /** Accessible name for the box when `label` is not plain text. */
  ariaLabel?: string;
  checked: boolean;
  chip?: React.ReactNode;
  /**
   * Cut a long label to one line with an ellipsis instead of letting it wrap.
   *
   * Opt-in, because the rows it was written for — a capability and its
   * description — are meant to wrap: the note IS the explanation, and half of
   * it behind an ellipsis is half an explanation. A roster row is the other
   * case: the name identifies, so one line of it plus the rest on hover beats
   * a row that grows to three.
   *
   * Pass `title` alongside, or the cut text is unreachable.
   */
  clamp?: boolean;
  disabled?: boolean;
  label: React.ReactNode;
  note?: React.ReactNode;
  onChange: (checked: boolean) => void;
  /** Hover text for the whole row — the full label when it is being cut. */
  title?: string;
}) {
  return (
    <div
      className={cx(
        styles.checkRow,
        checked && styles.checkRowOn,
        disabled && styles.checkRowDisabled,
      )}
      title={title}
      onClick={(e) => {
        if (disabled) return;
        const target = e.target as HTMLElement;
        if (target.closest("label.gg-checkbox, button, a, input, select, textarea")) {
          return;
        }
        onChange(!checked);
      }}
    >
      <span className={styles.checkBoxSlot}>
        <CoreCheckbox
          aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
        />
      </span>
      <span className={cx(styles.checkRowText, clamp && styles.checkRowClamp)}>
        <span className={styles.checkRowLabel}>{label}</span>
        {note ? <span className={styles.checkRowNote}>{note}</span> : null}
      </span>
      {chip}
    </div>
  );
}

/* ── colour chip ───────────────────────────────────────────────────────── */

/** #abc and #aabbcc → [r, g, b]. `null` for anything else. */
const parseHex = (value: string): [number, number, number] | null => {
  const hex = value.trim().replace(/^#/, "");
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
};

const toHsl = ([r, g, b]: [number, number, number]): string => {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
};

/**
 * A hex code with the colour beside it; the chip opens its conversions.
 *
 * The sheet is portalled and placed in viewport coordinates for the same reason
 * the overflow menu is: the panel it sits in clips its own overflow, and a
 * popover that gets cut in half is worse than none.
 */
export function ColorField({ value }: { value?: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<null | { left: number; top: number }>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const rgb = value ? parseHex(value) : null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (chipRef.current?.contains(target) || sheetRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!value) return <>—</>;

  const rows: [string, string][] = rgb
    ? [
        ["hex", value.toUpperCase()],
        ["rgb", `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`],
        ["hsl", toHsl(rgb)],
        ["css", `color: ${value.toLowerCase()};`],
      ]
    : [["raw", value]];

  const sheet =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div className={styles.colorSheet} ref={sheetRef} style={coords}>
            {rows.map(([space, text]) => (
              <div className={styles.colorRow} key={space}>
                <span className={styles.colorSpace}>{space}</span>
                <span className={styles.colorValue}>{text}</span>
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <span className={styles.colorField}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={styles.colorChip}
        ref={chipRef}
        style={{ background: rgb ? value : "var(--d-surface-alt)" }}
        title={value}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          const rect = chipRef.current?.getBoundingClientRect();
          if (rect) setCoords({ left: rect.left, top: rect.bottom + 6 });
          setOpen(true);
        }}
      />
      <Mono>{value.toUpperCase()}</Mono>
      {sheet}
    </span>
  );
}

/* ── overflow menu ─────────────────────────────────────────────────────── */

export type MenuAction = {
  disabled?: boolean;
  id: string;
  label: string;
  onSelect: () => void;
  /**
   * The same scale as `D.Btn`'s `variant`, and it must agree with it: an action
   * that would be a red button in the header is a red row in the overflow.
   * Omitted is neutral — most menu rows are.
   */
  risk?: "caution" | "danger";
  title?: string;
};

/**
 * The header's `⋯` overflow, holding the actions that should not sit one click
 * from a live tenant.
 *
 * Portalled to `<body>` and placed in viewport coordinates, because a panel
 * that clips or scrolls would otherwise cut the sheet off. It flips above the
 * trigger when there is no room below, follows scroll and resize, and closes on
 * Escape or a click outside — the same behaviour the row menus in
 * `ListDataTable` already have, restated here against the design's own tokens
 * rather than imported, since that component is typed around a table row.
 */
export function Menu({
  actions,
  compact = false,
  disabled = false,
  icon,
  label,
  title,
}: {
  actions: MenuAction[];
  /** Icon-only, for a table row's last column. The label becomes the tooltip. */
  compact?: boolean;
  /** Nothing to act on — the trigger greys out and the sheet never opens. */
  disabled?: boolean;
  /** Replaces the `⋯` glyph, for a trigger that reads as a named action. */
  icon?: React.ReactNode;
  label: string;
  /** Tooltip; defaults to the label. Use it to say why a disabled trigger is off. */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<null | { right: number; bottom?: number; top?: number }>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const place = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Padding plus one row per action — enough to decide flip vs grow-down.
    const estimated = 8 + actions.length * 34;
    const below = window.innerHeight - rect.bottom - 8;
    const up = below < estimated && rect.top > below;
    setCoords({
      right: window.innerWidth - rect.right,
      ...(up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  };

  const close = () => {
    setOpen(false);
    setCoords(null);
  };

  useEffect(() => {
    if (!open) return;

    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || sheetRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onMove = () => place();

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
    // `place` and `close` are stable for the life of one open menu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (actions.length === 0) return null;

  const sheet =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            className={styles.menuSheet}
            id={menuId}
            ref={sheetRef}
            role="menu"
            style={{ bottom: coords.bottom, right: coords.right, top: coords.top }}
          >
            {actions.map((action) => (
              <button
                className={cx(
                  styles.menuItem,
                  action.risk === "caution" && styles.menuItemCaution,
                  action.risk === "danger" && styles.menuItemDanger,
                )}
                disabled={action.disabled}
                key={action.id}
                role="menuitem"
                title={action.title}
                type="button"
                onClick={() => {
                  close();
                  action.onSelect();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {/* The class is applied rather than `Btn` used: the trigger needs a ref
          and aria attributes, and `Btn` forwards neither. */}
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label || title || undefined}
        className={compact ? styles.rowMenu : styles.btn}
        disabled={disabled}
        ref={triggerRef}
        title={title || label || undefined}
        type="button"
        onClick={() => {
          if (open) {
            close();
            return;
          }
          place();
          setOpen(true);
        }}
      >
        {icon ?? <MoreIcon />}
        {compact ? null : label}
      </button>
      {sheet}
    </>
  );
}

/** Hairline between two groups of header actions. */
export function VRule() {
  return <span aria-hidden className={styles.vRule} />;
}

/* ── buttons ───────────────────────────────────────────────────────────── */

/**
 * The mockup's button, at its measurements.
 *
 * Plain markup rather than core-ui's Button: that one writes its box and its
 * colours as inline styles, which no stylesheet can correct — the padding, the
 * height and the brand gradient all had to be argued with from outside. Here
 * there is nothing to argue with.
 */
export function Btn({
  ariaLabel,
  children,
  disabled = false,
  icon,
  onClick,
  size = "md",
  form,
  title,
  type = "button",
  variant = "neutral",
}: {
  /**
   * The button's name for a screen reader, when the face carries none.
   *
   * A button whose children are an icon has no accessible name — `title` is a
   * tooltip, and what a screen reader makes of it is up to the screen reader.
   * The one on the pager either says "Previous page" or says nothing.
   *
   * Leave it off wherever the label is the children: a second name over visible
   * text is one more string to keep in step with the one on screen.
   */
  ariaLabel?: string;
  children: React.ReactNode;
  disabled?: boolean;
  /**
   * The id of the `<form>` this button submits, for a `type="submit"` button
   * that sits outside its form — the wizard footer's Continue, whose step
   * form is up in the panel.
   */
  form?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  /**
   * The three heights the portal draws, and the only three.
   *
   * `sm` (28px) for a dense contextual strip — the bulk bar. `md` (32px)
   * everywhere else. `lg` (34px) for the wizard footer, which is a page-level
   * commitment rather than a control among others.
   *
   * A screen that wants a fourth is asking for a one-off, and one-offs are how
   * a page ends up with four button heights nobody chose.
   */
  size?: "lg" | "md" | "sm";
  title?: string;
  type?: "button" | "submit";
  /**
   * The action's RISK, not a colour. See the risk scale in design.module.css.
   *
   * `neutral`  nothing changes that anyone would have to undo — Xuất dữ liệu,
   *            Sao chép, Huỷ — and every button that only navigates, even to a
   *            screen full of destructive verbs.
   * `primary`  this screen's affirmative verb — Tạo mới, Lưu, Lấy token.
   * `caution`  reversible, but someone has to do the reversing — Sửa, Tạm
   *            dừng, Bật/Tắt, Xoay khoá, Cấp lại.
   * `danger`   hard to undo, or it breaks a live integration — Xoá, Gỡ, Chấm
   *            dứt, Lưu trữ, Thu hồi.
   *
   * A confirm step does not soften it: a "Xoá" behind a dialog is still
   * `danger`, because the colour is how the reader knows to expect the dialog.
   */
  variant?: "caution" | "danger" | "neutral" | "primary";
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={cx(
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "caution" && styles.btnCaution,
        variant === "danger" && styles.btnDanger,
        size === "sm" && styles.btnSm,
        size === "lg" && styles.btnLg,
      )}
      disabled={disabled}
      form={form}
      title={title}
      type={type}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}

/* ── option card ───────────────────────────────────────────────────────── */

/**
 * One choice in a mutually exclusive set — the mockup's plan packs, tracks and
 * scope types.
 *
 * A `<button>` with `role="radio"` rather than a real `<input type="radio">`:
 * the dot is a drawn ring the native control cannot be styled into, and the
 * whole row has to be the hit target. The chosen state is a wash across the
 * row, so nothing here depends on a fixed-size chip that could end up smaller
 * than its own label.
 */
export function Option({
  desc,
  disabled = false,
  label,
  on,
  onPick,
  tag,
}: {
  desc?: React.ReactNode;
  /**
   * The choice is shown and cannot be taken.
   *
   * `aria-disabled` with a live button rather than the `disabled` attribute: a
   * disabled button is skipped by the keyboard entirely, and these cards carry
   * the reason they are unavailable in their own description — the one thing a
   * screen-reader user should still be able to reach. The click is swallowed
   * here so no caller has to remember to.
   */
  disabled?: boolean;
  label: React.ReactNode;
  on: boolean;
  onPick: () => void;
  tag?: React.ReactNode;
}) {
  return (
    <button
      aria-checked={on}
      aria-disabled={disabled || undefined}
      className={cx(styles.option, on && styles.optionOn, disabled && styles.optionOff)}
      role="radio"
      type="button"
      onClick={() => {
        if (!disabled) onPick();
      }}
    >
      <span aria-hidden className={styles.optionRadio} />
      <span className={styles.optionText}>
        <span className={styles.optionHead}>
          <span className={styles.optionLabel}>{label}</span>
          {tag ? <Badge tone="neutral">{tag}</Badge> : null}
        </span>
        {desc ? <span className={styles.optionDesc}>{desc}</span> : null}
      </span>
    </button>
  );
}

/** Groups options so assistive tech reads them as one choice. */
export function OptionGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div aria-label={label} role="radiogroup">
      {children}
    </div>
  );
}

/* ── switch ────────────────────────────────────────────────────────────── */

export function Switch({
  ariaLabel,
  disabled = false,
  on,
  onChange,
}: {
  ariaLabel: string;
  disabled?: boolean;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      aria-checked={on}
      aria-label={ariaLabel}
      className={cx(styles.switch, on && styles.switchOn)}
      disabled={disabled}
      role="switch"
      type="button"
      onClick={() => onChange(!on)}
    >
      <span aria-hidden className={styles.switchKnob} />
    </button>
  );
}

export function LockBadge({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span className={styles.lock} title={title}>
      <svg
        fill="none"
        height="11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="11"
        aria-hidden
      >
        <rect height="11" rx="2" width="18" x="3" y="11" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      {children}
    </span>
  );
}

/** A row whose control sits at the end: label over its scope, then the switch. */
export function SwitchRow({
  control,
  label,
  scope,
}: {
  control: React.ReactNode;
  label: React.ReactNode;
  scope?: React.ReactNode;
}) {
  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {scope ? <span className={styles.switchScope}>{scope}</span> : null}
      </span>
      {control}
    </div>
  );
}

/* ── sub-list ──────────────────────────────────────────────────────────── */

/** The toolbar strip inside a nested list panel — search, then its actions. */
export function SubBar({ children }: { children: React.ReactNode }) {
  return <div className={styles.subBar}>{children}</div>;
}

/* ── key / value rows ──────────────────────────────────────────────────── */

export function Panels({ children }: { children: React.ReactNode }) {
  return <div className={styles.panels}>{children}</div>;
}

/**
 * One labelled fact.
 *
 * `mono` is for values a person may need to copy exactly — ids, keys, domains.
 * A badge passed as `value` renders as itself; the row does not wrap it.
 */
export function KV({
  label,
  mono = false,
  stacked = false,
  value,
}: {
  label: React.ReactNode;
  mono?: boolean;
  /**
   * Label above the value rather than beside it.
   *
   * For a value that is itself a block — a table, a JSON dump, a paragraph.
   * Beside a 150px label such a value gets the narrow half of the row and wraps
   * into a column; stacked it gets the panel's full width.
   */
  stacked?: boolean;
  value: React.ReactNode;
}) {
  return (
    <div className={cx(styles.kv, stacked && styles.kvStacked)}>
      <span className={styles.kvLabel}>{label}</span>
      <span className={cx(styles.kvValue, mono && styles.kvMono)}>{value}</span>
    </div>
  );
}

/* ── activity timeline ─────────────────────────────────────────────────── */

/*
 * A filled disc with no glyph on it, so it takes the `solid` slot — the role's
 * hue at full strength. `ink` is the slot for text and borders and reads muddy
 * as a 8px shape; see the palette in design.module.css.
 */
const EVENT_COLOR: Record<Tone, string> = {
  danger: "var(--d-bad-solid)",
  info: "var(--d-info-solid)",
  neutral: "var(--d-neutral-solid)",
  success: "var(--d-ok-solid)",
  warning: "var(--d-warn-solid)",
};

export function Event({
  action,
  actor,
  at,
  detail,
  tone = "neutral",
}: {
  action: React.ReactNode;
  actor?: React.ReactNode;
  at?: React.ReactNode;
  detail?: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={styles.event}>
      <span aria-hidden className={styles.eventDot} style={{ background: EVENT_COLOR[tone] }} />
      <span className={styles.eventBody}>
        <span className={styles.eventHead}>
          <span className={styles.eventAction}>{action}</span>
          {at ? <span className={styles.eventAt}>{at}</span> : null}
        </span>
        {detail ? <span className={styles.eventDetail}>{detail}</span> : null}
      </span>
      {actor ? <span className={styles.eventActor}>{actor}</span> : null}
    </div>
  );
}

/** The footer rule under a list — where "see all of it" lives. */
export function PanelFoot({ children }: { children: React.ReactNode }) {
  return <div className={styles.panelFoot}>{children}</div>;
}

/* ── stat tiles ────────────────────────────────────────────────────────── */

export function Tiles({ children }: { children: React.ReactNode }) {
  return <div className={styles.tiles}>{children}</div>;
}

export function Tile({
  label,
  note,
  value,
}: {
  label: string;
  note?: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      {note ? <span className={styles.tileNote}>{note}</span> : null}
    </div>
  );
}

/* ── lifecycle track ───────────────────────────────────────────────────── */

export type TrackState = "current" | "done" | "error" | "pending";

const TRACK_COLOR: Record<TrackState, string> = {
  current: "var(--d-accent)",
  done: "var(--d-ok-solid)",
  error: "var(--d-bad-solid)",
  pending: "var(--d-border)",
};

/**
 * The four lifecycle stages on one rule.
 *
 * `error` is its own state rather than a variant of `current`: suspended and
 * terminated are where a tenant *is*, not a step it is working through, and the
 * design colours them red to say so.
 */
export function Track({ steps }: { steps: { label: string; note?: string; state: TrackState }[] }) {
  return (
    <div className={styles.track}>
      {steps.map((step, index) => (
        <div className={styles.trackStep} key={step.label}>
          <span className={styles.trackText}>
            <span className={styles.trackDot} style={{ background: TRACK_COLOR[step.state] }}>
              {step.state === "done" ? "✓" : index + 1}
            </span>
            <span
              className={styles.trackLabel}
              style={{
                color: step.state === "pending" ? "var(--d-faint)" : "var(--d-text)",
              }}
            >
              {step.label}
            </span>
            {step.note ? <span className={styles.trackNote}>{step.note}</span> : null}
          </span>
          <span
            className={cx(styles.trackLine, index === steps.length - 1 && styles.trackLineLast)}
          />
        </div>
      ))}
    </div>
  );
}

/* ── readiness ─────────────────────────────────────────────────────────── */

/** A conic gradient with a punched-out middle — no chart library involved. */
export function Ring({
  headline,
  score,
  summary,
  tone,
  total,
}: {
  headline: React.ReactNode;
  score: number;
  summary?: React.ReactNode;
  tone: GateState;
  total: number;
}) {
  const degrees = Math.round((score / Math.max(1, total)) * 360);
  const colour =
    tone === "pass"
      ? "var(--d-ok-solid)"
      : tone === "fail"
        ? "var(--d-bad-solid)"
        : "var(--d-warn-solid)";

  return (
    <div className={styles.readyHead}>
      <span
        aria-hidden
        className={styles.ring}
        style={{ background: `conic-gradient(${colour} ${degrees}deg, var(--d-border) 0deg)` }}
      >
        <span className={styles.ringHole}>{score}</span>
      </span>
      <span className={styles.readyText}>
        <span className={styles.readyHeadline}>{headline}</span>
        {summary ? <span className={styles.readySummary}>{summary}</span> : null}
      </span>
    </div>
  );
}

export function Check({
  detail,
  fix,
  label,
  state,
}: {
  detail?: React.ReactNode;
  fix?: React.ReactNode;
  label: React.ReactNode;
  state: GateState;
}) {
  return (
    <div className={styles.check}>
      <span aria-hidden className={cx(styles.gateMark, GATE_CLASS[state])}>
        {GATE_MARK[state]}
      </span>
      <span className={styles.checkText}>
        <span className={styles.checkLabel}>{label}</span>
        {detail ? <span className={styles.checkDetail}>{detail}</span> : null}
      </span>
      {fix}
    </div>
  );
}

/**
 * The remedy offered on a readiness row that is not passing.
 *
 * `onSelect` is optional on purpose: a row can name its remedy before anyone has
 * decided where that remedy lives, and showing the button disabled says more
 * than hiding it — the operator learns what would fix the row, and that the
 * portal cannot do it for them yet.
 */
export function CheckFix({
  label,
  onSelect,
  title,
}: {
  label: string;
  onSelect?: () => void;
  title?: string;
}) {
  return (
    <button
      className={styles.checkFix}
      disabled={!onSelect}
      title={title}
      type="button"
      onClick={onSelect}
    >
      {label}
    </button>
  );
}

/* ── detail ────────────────────────────────────────────────────────────── */

export function Tabs({
  items,
  onChange,
  value,
}: {
  /**
   * `count` is the chip beside a label — rows behind that tab, usually.
   *
   * `error` turns that chip red. A form laid out as tabs hides most of itself,
   * so the one thing the strip has to be able to say is "what you are looking
   * for is not on this tab" — without it, a save refused for a blank field two
   * tabs away is a dead button and no explanation.
   */
  items: { count?: number; error?: boolean; id: string; label: string }[];
  onChange: (id: string) => void;
  value: string;
}) {
  return (
    <div className={styles.tabs} role="tablist">
      {items.map((item) => (
        <button
          aria-selected={item.id === value}
          className={cx(styles.tab, item.id === value && styles.tabOn)}
          key={item.id}
          role="tab"
          type="button"
          onClick={() => onChange(item.id)}
        >
          <span>{item.label}</span>
          {item.count !== undefined ? (
            <span className={cx(styles.tabCount, item.error && styles.tabCountBad)}>
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** The name block of an identity header, without the card around it. */
export function IdentityLines({
  badge,
  meta,
  name,
}: {
  badge?: React.ReactNode;
  meta: (null | React.ReactNode)[];
  name: string;
}) {
  const shown = meta.filter(Boolean);

  return (
    <div className={styles.identityLines}>
      <div className={styles.identityName}>
        <h1 className={styles.identityTitle}>{name}</h1>
        {badge}
      </div>
      <div className={styles.identityMeta}>
        {shown.map((entry, index) => (
          <React.Fragment key={index}>
            {index > 0 ? <span className={styles.dot}>•</span> : null}
            {entry}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/** The card above the tabs: who this is, and what can be done to them. */
export function Identity({
  actions,
  badge,
  children,
  logo,
  meta,
  name,
}: {
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  logo?: React.ReactNode;
  /** Rendered with the design's separator between entries. */
  meta: React.ReactNode[];
  name: string;
}) {
  return (
    <Panel padded={!children}>
      <div
        className={styles.identity}
        style={children ? { padding: "var(--d-space-7)" } : undefined}
      >
        <div className={styles.identityMain}>
          {logo}
          <div className={styles.identityLines}>
            <div className={styles.identityName}>
              <h1 className={styles.identityTitle}>{name}</h1>
              {badge}
            </div>
            <div className={styles.identityMeta}>
              {meta.filter(Boolean).map((entry, index) => (
                <React.Fragment key={index}>
                  {index > 0 ? <span className={styles.dot}>•</span> : null}
                  {entry}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        {actions ? <div className={styles.headActions}>{actions}</div> : null}
      </div>
      {children}
    </Panel>
  );
}

/* ── wizard ────────────────────────────────────────────────────────────── */

export function Back({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className={styles.back} type="button" onClick={onClick}>
      <ChevronLeftIcon />
      {children}
    </button>
  );
}

export type StepState = "current" | "done" | "error" | "pending";

/**
 * The step row. Finished steps are reachable — the design makes them buttons,
 * and an operator who wants to re-read step 2 should not have to walk forward
 * again. A pending step is inert: there is nothing there to look at yet.
 */
export function Steps({
  current,
  errors = [],
  labels,
  onGo,
}: {
  current: number;
  /*
   * Steps the operator opened and left incomplete. Their dot turns red — the
   * only way to see, from step 5, that step 2 still needs something. A step
   * nobody has opened is not an error, so this list is never derived from
   * validity alone.
   */
  errors?: number[];
  labels: string[];
  onGo?: (step: number) => void;
}) {
  return (
    <div className={styles.steps}>
      {labels.map((label, index) => {
        const n = index + 1;
        const failed = errors.includes(n);
        const state: StepState = failed
          ? "error"
          : n < current
            ? "done"
            : n === current
              ? "current"
              : "pending";
        // Every step is reachable: the wizard is a form, not a gate.
        const active = state !== "pending";

        return (
          <button
            aria-current={state === "current" ? "step" : undefined}
            className={cx(
              styles.step,
              active && styles.stepActive,
              state === "current" && styles.stepCurrent,
            )}
            disabled={onGo === undefined}
            key={label}
            type="button"
            onClick={() => onGo?.(n)}
          >
            {/*
             * Error and active are mutually exclusive, and saying so here beats
             * relying on which rule the stylesheet happens to declare last —
             * `.stepDotActive` sits below `.stepDotError` in the file, so both
             * classes together painted a failed step blue.
             */}
            <span
              className={cx(
                styles.stepDot,
                failed ? styles.stepDotError : active && styles.stepDotActive,
              )}
            >
              {failed ? "!" : state === "done" ? "✓" : n}
            </span>
            <span className={styles.stepLabel}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Step panel on the left, gates rail on the right; stacked when narrow. */
export function WizardBody({ children }: { children: React.ReactNode }) {
  return <div className={styles.wizardBody}>{children}</div>;
}

/**
 * The footer strip. `blocker` is why the primary action is unavailable — the
 * design keeps it beside the button rather than in a tooltip, so a disabled
 * step is never a dead end.
 */
/**
 * The portal's one sticky action bar: pinned to the bottom of the viewport,
 * reason on the left, buttons on the right.
 *
 * It was `WizardFoot`, named after the only screen that had one. It is now on
 * three — the onboarding wizard, the tenant detail's entitlement strip, and
 * every create/edit form — so the name says what it is instead.
 *
 * `blocker` is why the primary action cannot be taken, beside the button rather
 * than in a tooltip: a disabled control with the reason hidden behind a hover
 * is unreadable on a touch screen and invisible to anyone who does not think to
 * hover.
 *
 * A screen that ends in one of these must pass `flushBottom` to `Screen` —
 * padding under a sticky element is still scrollable content, so without it the
 * bar lifts off the viewport's edge at the end of the scroll.
 */
export function ActionBar({
  blocker,
  children,
}: {
  blocker?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.actionBar}>
      <span className={styles.actionBarNote}>{blocker}</span>
      {children}
    </div>
  );
}

export const StickyBar = ActionBar;

export type GateState = "fail" | "pass" | "warn";

const GATE_CLASS: Record<GateState, string> = {
  fail: styles.gateFail,
  pass: styles.gatePass,
  warn: styles.gateWarn,
};

const GATE_MARK: Record<GateState, string> = { fail: "✕", pass: "✓", warn: "!" };

export function Gate({
  detail,
  label,
  state,
}: {
  detail?: React.ReactNode;
  label: React.ReactNode;
  state: GateState;
}) {
  return (
    <div className={styles.gate}>
      <span aria-hidden className={cx(styles.gateMark, GATE_CLASS[state])}>
        {GATE_MARK[state]}
      </span>
      <span className={styles.gateText}>
        <span className={styles.gateLabel}>{label}</span>
        {detail ? <span className={styles.gateDetail}>{detail}</span> : null}
      </span>
    </div>
  );
}

export function Artifact({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.artifact}>
      <span aria-hidden className={styles.artifactDot} />
      <span>{children}</span>
    </div>
  );
}

/**
 * A titled group inside a step panel: the uppercase strip, then its body.
 *
 * `flush` is for a group whose children are already full-bleed rows — a
 * checklist, a set of option cards. Those bring their own inset and their own
 * divider, so the body must not add a second one.
 */
export function FieldGroup({
  children,
  columns = 1,
  description,
  flush = false,
  title,
}: {
  children?: React.ReactNode;
  /**
   * Two columns for a group of short, independent fields — a slug beside an
   * identifier. Never for fields that read as a sentence together, and never
   * below `--d-bp-lg`, where the stylesheet folds it back to one.
   */
  columns?: 1 | 2;
  /** The line under the section head. For a rule the labels cannot carry. */
  description?: string;
  flush?: boolean;
  title: string;
}) {
  return (
    <div className={styles.fieldGroup}>
      <SectionHead>{title}</SectionHead>
      {description ? <p className={styles.fieldGroupDesc}>{description}</p> : null}
      <div
        className={cx(
          styles.fields,
          columns === 2 && styles.fieldsTwoUp,
          flush && styles.fieldsFlush,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The bottom of a Modal Form: an optional note on the left, the button pair on
 * the right.
 *
 * It lives in the `<form>` inside the modal body rather than in core-ui
 * `Modal`'s `footer` slot, because that slot is rendered outside the body and a
 * form cannot span the two. Inside the form, Enter submits and the confirm
 * button is a real `type="submit"` — the reason this primitive exists instead
 * of three screens each spelling a footer row out.
 *
 * `note` is the standing caveat that belongs beside the decision — what the
 * allowlist does not do, which version is about to roll out — not the error the
 * attempt just produced. An error belongs with the field that caused it.
 */
export function ModalFoot({
  children,
  note,
}: {
  children: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div className={styles.modalFoot}>
      <div className={styles.modalFootNote}>{note}</div>
      <div className={styles.modalFootBtns}>{children}</div>
    </div>
  );
}

/* ── table ─────────────────────────────────────────────────────────────── */

/**
 * The design's table, drawn by hand — see the note in the stylesheet for why
 * `DataGrid` could not carry it.
 *
 * `pick` and `end` are the two columns with no label: the select-all checkbox
 * and the row menu. They are named rather than indexed so a column added in the
 * middle cannot silently steal their insets.
 */
export const table = {
  end: styles.end,
  muted: styles.muted,
  nowrap: styles.nowrap,
  pick: styles.pick,
  right: styles.right,
  root: styles.table,
  wrap: styles.tableWrap,
};

/**
 * The cell modifiers a table column may need, pre-composed.
 *
 * A `<td>` inside `D.Table` is already styled by descendant selector, so these
 * only name the exceptions: an id column that must not wrap, a number column
 * that aligns right. Composed here rather than at the call site so a screen
 * writes one class instead of three, and so the set stays small enough to see.
 */
export const cell = {
  mono: styles.cellMono,
  monoMutedNoWrap: cx(styles.cellMono, styles.cellMuted, styles.cellNoWrap),
  monoNoWrap: cx(styles.cellMono, styles.cellNoWrap),
  muted: styles.cellMuted,
  noWrap: styles.cellNoWrap,
  right: styles.cellRight,
  rightNoWrap: cx(styles.cellRight, styles.cellNoWrap),
  rightMonoMuted: cx(styles.cellRight, styles.cellMono, styles.cellMuted),
  rightMonoNoWrap: cx(styles.cellRight, styles.cellMono, styles.cellNoWrap),
};

export function Table({ children, head }: { children: React.ReactNode; head: React.ReactNode }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/**
 * The rows-per-page steps every pager offers, first one first.
 *
 * Here rather than in each screen because it is the pager's own scale: a list
 * and the audit tab beside it are two views of one table, and a tab that
 * silently offers different steps than the list is a difference nobody asked
 * for. Screens spend it; none of them declares its own.
 */
export const PAGE_SIZES = [10, 20, 50];

/** The footer strip: what is being shown, how many per page, and the two steps. */
export function Pager({
  meta,
  next,
  onPageSize,
  page,
  pageSize,
  pageSizes,
  prev,
  rowsLabel,
  atFirst,
  atLast,
  nextLabel,
  prevLabel,
}: {
  atFirst: boolean;
  atLast: boolean;
  meta: string;
  next: () => void;
  nextLabel: string;
  onPageSize: (size: number) => void;
  page: string;
  pageSize: number;
  pageSizes: number[];
  prev: () => void;
  prevLabel: string;
  rowsLabel: string;
}) {
  return (
    <div className={styles.pager}>
      <span className={styles.pagerMeta}>{meta}</span>
      <div className={styles.pagerRight}>
        {pageSizes.length > 0 ? (
          <label className={styles.pagerRows}>
            {rowsLabel}
            <select
              value={String(pageSize)}
              onChange={(event) => onPageSize(Number(event.target.value))}
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className={styles.pagerNav}>
          <button className={styles.pagerBtn} disabled={atFirst} type="button" onClick={prev}>
            {prevLabel}
          </button>
          <span className={styles.pagerOf}>{page}</span>
          <button className={styles.pagerBtn} disabled={atLast} type="button" onClick={next}>
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export const grid = { clickable: styles.gridClickable, root: styles.grid };
export const layout = {
  calloutStack: styles.calloutStack,
  /**
   * The `<form>` of a Modal Form. Draws the frame its `FieldGroup` children
   * would otherwise get from a `D.Panel` — a modal body has none.
   */
  modalForm: styles.modalForm,
  /**
   * Add beside `modalForm` when the form is taller than the viewport. Bounds
   * the form; put fields in `modalFormScroll` so only they scroll and
   * `ModalFoot` stays pinned.
   */
  modalFormTall: styles.modalFormTall,
  /** Scrollable body of a tall Modal Form — FieldGroups live here, not the foot. */
  modalFormScroll: styles.modalFormScroll,
  /** Back link + identity card as one group — see `.identityGroup`. */
  identityGroup: styles.identityGroup,
  /** Adds the top spacing a stack needs inside a panel body — see the CSS. */
  calloutStackTop: styles.calloutStackTop,
  /**
   * For a wrapper that has to sit between `Screen` and its sections — a
   * `<form>`, say. Restores the gap `Screen` would have given them.
   */
  sectionStack: styles.sectionStack,
  stack: styles.stack,
};

/* ── Foundation Primitives: ConfirmDialog, TableSkeleton ───────────────────── */

/** How many `ConfirmDialog`s are open — see the body flag inside. */
let openDialogCount = 0;

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Prose — what is about to happen. A dialog with only this is an `alertdialog`. */
  message?: React.ReactNode;
  /**
   * Both labels are required, and in the reader's language. They were
   * optional with English defaults for a while, and nothing broke because
   * every caller passed them — which is exactly the state in which the next
   * caller forgets, ships "OK" / "Cancel" into a Vietnamese portal, and gets
   * no compile error to say so. The type is the guardrail; a default here
   * would remove it.
   */
  confirmLabel: string;
  cancelLabel: string;
  /**
   * The SAME risk as the button that opened the dialog. A confirm step does not
   * soften an action: the reader saw a caution button, so the button that
   * finishes the job is caution too. Omitted, it is `primary` — the create and
   * save case, which is what a dialog that is a small form usually is.
   */
  risk?: "caution" | "danger" | "primary";
  busy?: boolean;
  /**
   * Confirm is not yet valid — a required field is empty, nothing has changed.
   * Unlike `busy` this leaves Cancel and Escape working, so an incomplete form
   * is never a trap.
   */
  confirmDisabled?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  /** Fields — the dialog is then a form, and Enter in any field confirms. */
  children?: React.ReactNode;
  width?: number | string;
}

/**
 * The portal's one dialog: a confirmation, or a small form — what stands in
 * for a raw `window.confirm()`.
 *
 * The card is a `<form>`, so Enter inside a field submits the way it does on
 * every other form, and the confirm button is `type="submit"` rather than a
 * click handler — one path, whichever way the reader finishes. `children` are
 * the fields (`D.FieldGroup` + `FormField`); `message` is prose. A dialog with
 * only prose keeps `role="alertdialog"`; one with fields is a `dialog`.
 *
 * It portals to `document.body`, so it carries its own `Scope`: core-ui reads
 * its colours and control sizes from the scope, and a `Select` in the fields
 * would otherwise render in the portal's untuned palette.
 */
export function ConfirmDialog({
  busy = false,
  cancelLabel,
  children,
  confirmDisabled = false,
  confirmLabel,
  message,
  onCancel,
  onConfirm,
  open,
  risk = "primary",
  title,
  width,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // A control inside the dialog that used Escape for itself — `D.Select`
      // closing its sheet — has already prevented it; the dialog stays.
      if (e.key === "Escape" && !busy && !e.defaultPrevented) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, busy, onCancel]);

  useEffect(() => {
    if (!open) return;
    openDialogCount += 1;
    if (typeof document !== "undefined") {
      document.body.dataset.ggModal = "open";
    }
    return () => {
      openDialogCount -= 1;
      if (openDialogCount <= 0) {
        openDialogCount = 0;
        if (typeof document !== "undefined") {
          delete document.body.dataset.ggModal;
        }
      }
    };
  }, [open]);

  if (!open) return null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // The card is portalled to <body>, but React still bubbles the synthetic
    // event up the component tree — to a page <form> the opener may sit in.
    e.stopPropagation();
    if (busy || confirmDisabled) return;
    void onConfirm();
  };

  const dialogContent = (
    <Scope>
      <div
        aria-label={title}
        aria-modal="true"
        className={styles.dialogOverlay}
        role={children ? "dialog" : "alertdialog"}
      >
        <div className={styles.dialogBackdrop} onClick={busy ? undefined : onCancel} />
        <form
          className={styles.dialogCard}
          style={width ? { width: typeof width === "number" ? `${width}px` : width } : undefined}
          onSubmit={submit}
        >
          <div className={styles.dialogHead}>
            <h3 className={styles.dialogTitle}>{title}</h3>
          </div>
          {message ? <div className={styles.dialogBody}>{message}</div> : null}
          {children ? <div className={styles.dialogChildren}>{children}</div> : null}
          <div className={styles.dialogFoot}>
            <Btn disabled={busy} type="button" variant="neutral" onClick={onCancel}>
              {cancelLabel}
            </Btn>
            <Btn disabled={busy || confirmDisabled} type="submit" variant={risk}>
              {busy ? "…" : confirmLabel}
            </Btn>
          </div>
        </form>
      </div>
    </Scope>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(dialogContent, document.body);
  }
  return dialogContent;
}

/**
 * Skeleton — the one shimmer primitive for every loading placeholder.
 *
 * Three variants:
 *  · `block` (default) — a single pulsing rectangle. The building block for
 *    titles, subtitles, button placeholders, toolbar chips, big panel bodies.
 *  · `row` — an icon/avatar + one or two text bars + optional trailing chip.
 *    Repeated with `count` for a placeholder list.
 *  · `table` — a rows × cols grid, matching the `TableSkeleton` layout the old
 *    hand-rolled skeletons used to draw.
 *
 * All variants share `styles.skeletonBar` — the single shimmer animation in the
 * app. A scope with its own palette (the sidebar) can retune the tint on a
 * parent with `--d-skeleton-tint` / `--d-skeleton-tint-hi` and every child
 * skeleton follows, no bespoke class required.
 *
 * `styles.skeletonBar` is exported below as `skeletonBarClass` for the rare
 * layout where the primitive must be applied to an element the caller already
 * owns (a `<span>` inside a nav row, a table cell width the caller controls).
 */
type SkeletonRadius = "sm" | "md" | "pill" | "circle";

const SKELETON_RADIUS_CLASS: Record<SkeletonRadius, string | undefined> = {
  sm: undefined,
  md: styles.skeletonRadiusMd,
  pill: styles.skeletonRadiusPill,
  circle: styles.skeletonRadiusCircle,
};

export type SkeletonBlockProps = {
  variant?: "block";
  width?: number | string;
  height?: number | string;
  radius?: SkeletonRadius;
  className?: string;
  style?: React.CSSProperties;
};

export type SkeletonRowProps = {
  variant: "row";
  /** Draw a leading icon/avatar mark. */
  avatar?: boolean;
  avatarShape?: "circle" | "square";
  avatarSize?: number;
  /** Number of stacked text bars — used when `lineWidths` is omitted. */
  lines?: number;
  /** Explicit bar widths (px or CSS length string). Overrides `lines`. */
  lineWidths?: ReadonlyArray<number | string>;
  /** Draw a trailing chip on the right (a badge, a status). */
  trailing?: boolean;
  trailingWidth?: number | string;
  /** Repeat this row shape `count` times. */
  count?: number;
  className?: string;
  style?: React.CSSProperties;
};

export type SkeletonTableProps = {
  variant: "table";
  rows?: number;
  cols?: number;
};

export type SkeletonProps = SkeletonBlockProps | SkeletonRowProps | SkeletonTableProps;

export const skeletonBarClass = styles.skeletonBar;

export function Skeleton(props: SkeletonProps) {
  if (props.variant === "table") {
    const { rows = 5, cols = 4 } = props;
    return (
      <div aria-hidden="true" className={styles.skeletonHost}>
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className={styles.skeletonRow}>
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className={cx(styles.skeletonBar, styles.skeletonCell)}
                style={{
                  flex: cIdx === 0 ? 1.5 : cIdx === cols - 1 ? 0.8 : 1,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (props.variant === "row") {
    const {
      avatar = false,
      avatarShape = "square",
      avatarSize = 28,
      lines,
      lineWidths,
      trailing = false,
      trailingWidth = 64,
      count = 1,
      className,
      style,
    } = props;
    const widths: ReadonlyArray<number | string> =
      lineWidths ??
      (lines ? Array.from({ length: lines }, (_, i) => (i === 0 ? "62%" : "38%")) : ["62%", "38%"]);
    return (
      <>
        {Array.from({ length: count }).map((_, rIdx) => (
          <div
            key={rIdx}
            aria-hidden="true"
            className={cx(styles.skeletonRowHost, className)}
            style={style}
          >
            {avatar ? (
              <span
                className={cx(
                  styles.skeletonBar,
                  avatarShape === "circle" ? styles.skeletonRadiusCircle : styles.skeletonRadiusMd,
                )}
                style={{ width: avatarSize, height: avatarSize, flex: "none" }}
              />
            ) : null}
            <span className={styles.skeletonRowLines}>
              {widths.map((w, i) => (
                <span
                  key={i}
                  className={styles.skeletonBar}
                  style={{ height: i === 0 ? 12 : 10, width: w }}
                />
              ))}
            </span>
            {trailing ? (
              <span
                className={cx(styles.skeletonBar, styles.skeletonRadiusPill)}
                style={{ width: trailingWidth, height: 20, flex: "none" }}
              />
            ) : null}
          </div>
        ))}
      </>
    );
  }

  const { width, height = 14, radius = "sm", className, style } = props;
  return (
    <span
      aria-hidden="true"
      className={cx(styles.skeletonBar, SKELETON_RADIUS_CLASS[radius], className)}
      style={{ width, height, ...style }}
    />
  );
}

/**
 * Backwards-compatible alias for `Skeleton` with the table variant.
 *
 * Kept because `foundation.test.ts` mounts `D.TableSkeleton`, and because the
 * old `components/TableSkeleton.tsx` was a public shape.
 */
export function TableSkeleton({ cols = 4, rows = 5 }: { cols?: number; rows?: number }) {
  return <Skeleton variant="table" cols={cols} rows={rows} />;
}

/**
 * Core design tokens exported as typed constants for JavaScript/TypeScript usages.
 */
export const DESIGN_TOKENS = {
  accent: "var(--d-accent)",
  accentInk: "var(--d-accent-ink)",
  accentWash: "var(--d-accent-wash)",
  border: "var(--d-border)",
  fontMono: "var(--d-font-mono, monospace)",
  fontSans: "var(--d-font-sans, 'Be Vietnam Pro', sans-serif)",
  gapSection: "var(--d-gap-section)",
  radius: "var(--d-radius)",
  radiusPill: "var(--d-radius-pill)",
  surface: "var(--d-surface)",
  surfaceAlt: "var(--d-surface-alt)",
  zModal: 9999,
  zSticky: 20,
} as const;
