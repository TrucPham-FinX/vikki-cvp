"use client";

/**
 * What the sidebar remembers across a navigation.
 *
 * Every Payload admin view is its own server render, so the rail is torn down
 * and rebuilt on each click. Without this it comes back scrolled to the top
 * with every section at its default — which, for someone working through the
 * items near the bottom, means finding their place again after every single
 * click.
 *
 * `sessionStorage`, not `localStorage`: this is where you are in one sitting,
 * not a preference to carry into next week. A module variable mirrors the
 * same value so a remount in the same tick does not wait on Storage.
 */

const SCROLL_KEY = "gg-nav:scroll";
/** v2 keys by stable section id (not translated label), so language toggle keeps state. */
const SECTION_KEY = "gg-nav:collapsed:v2";

/** In-memory mirror of the rail scroll — survives remount, lost on full reload. */
let scrollMemory: number | null = null;

const store = (): null | Storage => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // Safari in private mode throws on access rather than returning null.
    return null;
  }
};

export const readScroll = (): null | number => {
  if (scrollMemory !== null) return scrollMemory;
  const raw = store()?.getItem(SCROLL_KEY);
  const value = raw === null || raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(value)) return null;
  scrollMemory = value;
  return value;
};

export const writeScroll = (top: number): void => {
  const next = Math.round(top);
  scrollMemory = next;
  store()?.setItem(SCROLL_KEY, String(next));
};

/**
 * Only sections the user has touched are listed, keyed by stable `sectionKey`.
 * A section they have never touched is absent, which is what lets the default
 * — and "the section holding the active row is open" — still apply.
 */
const readSections = (): Record<string, boolean> => {
  try {
    const raw = store()?.getItem(SECTION_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
};

/** `sectionKey` is a stable id (`overview`, `platform`, …), never a translated label. */
export const readSectionCollapsed = (sectionKey: string): boolean | undefined =>
  readSections()[sectionKey];

export const writeSectionCollapsed = (sectionKey: string, collapsed: boolean): void => {
  const next = { ...readSections(), [sectionKey]: collapsed };
  try {
    store()?.setItem(SECTION_KEY, JSON.stringify(next));
  } catch {
    // A full or unavailable store costs the memory, not the click.
  }
};

/**
 * The rail's own scroller.
 *
 * Prefer the outermost `.nav__scroll` ancestor: Payload's rail owns that class
 * with `overflow-y: auto`. Nested elements must never reuse the class — a past
 * impostor on the sections wrapper made the user scroll an inner box while we
 * saved the outer one's (always-zero) scrollTop.
 *
 * Overflow walk is the fallback if a Payload upgrade renames the class.
 */
export const scrollerOf = (start: Element | null): Element | null => {
  let node = start?.parentElement ?? null;
  let byClass: Element | null = null;

  while (node && node !== document.body) {
    if (node instanceof HTMLElement && node.classList.contains("nav__scroll")) {
      // Keep walking — outermost wins if anything nested stole the class.
      byClass = node;
    }
    node = node.parentElement;
  }
  if (byClass) return byClass;

  node = start?.parentElement ?? null;
  while (node && node !== document.body) {
    /*
     * Overflow only — NOT `scrollHeight > clientHeight`. This runs before the
     * rest of the rail has laid out, so at that moment the scroller is not yet
     * taller than its box and a height test finds nothing.
     */
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
    node = node.parentElement;
  }

  return null;
};
