"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";

import {
  ABSOLUTE_MIN,
  DEFAULT_WIDTH,
  contentWidths,
  draggedWidth,
  floorFor,
} from "../../crud/v2/columnLayout";

/**
 * A table whose columns can be dragged, and remember it.
 *
 * Lifted out of `crud/v2/CrudTable` so the portal has ONE resizable table
 * behaviour rather than two. `ListDataTable` — the mini-app catalog, the
 * submissions queue, the change-request queue, host apps — had none at all, and
 * writing a second copy for it is how the two would have drifted: one storing
 * widths under a different key shape, one forgetting the sort guard, one
 * measuring the header without its glyph.
 *
 * The arithmetic stays in `crud/v2/columnLayout` (pure, and tested there). What
 * is here is the part that touches the DOM: measuring what the browser drew,
 * the pointer sequence, and the record left in `localStorage`.
 *
 * Three things a host table must do for any of it to work:
 *
 * 1. `table-layout: fixed` and a `<colgroup>` fed from `widthOf` — under the
 *    default auto layout the browser re-derives every width from the content
 *    and a dragged number changes nothing on screen.
 * 2. An explicit table width (`totalWidth`) inside a horizontally scrolling
 *    box — an `auto` width is capped at the container, so widening one column
 *    silently narrows the rest instead of scrolling.
 * 3. `position: relative` on the `<th>`, since the handle is absolute inside it.
 */

export type ResizableColumn = {
  /** Cap the fitting pass for this column alone — see `contentWidth`. */
  maxWidth?: number;
  name: string;
  width?: number;
};

type StoredLayout = { columns: string; widths: Record<string, number> };

/**
 * Which columns a stored layout was measured for.
 *
 * Restoring by position would hand a column the width of whatever used to sit
 * there — and column sets do change.
 */
export const signatureOf = (columns: readonly ResizableColumn[]): string =>
  columns.map((column) => column.name).join("|");

export const loadWidths = (key: string, signature: string): Record<string, number> => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("columns" in parsed)) return {};
    const stored = parsed as StoredLayout;
    return stored.columns === signature ? (stored.widths ?? {}) : {};
  } catch {
    return {};
  }
};

/**
 * How wide one element's text is, measured off the font rather than the box.
 *
 * For the header labels, where the box is useless: `.thLabel` stretches to the
 * whole header, so `scrollWidth` and a Range over its contents both return the
 * column's own width. The header floor built on that was therefore "as wide as
 * this column already is" — a column could be dragged wider and never
 * narrower, which read as a mysterious minimum width, and a `width` declared in
 * a config was overruled by a "measurement" of the column it was changing.
 *
 * A canvas has no layout and no box, so `measureText` is the text's width and
 * nothing else. Letter-spacing is not part of it — the labels are tracked out
 * by 0.04em — so it is added back per character.
 */
let canvas: HTMLCanvasElement | null = null;

const textWidthOf = (element: HTMLElement): number => {
  const text = element.textContent ?? "";
  if (!text) return 0;

  try {
    canvas ??= document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return element.scrollWidth;

    const style = window.getComputedStyle(element);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const tracking = Number.parseFloat(style.letterSpacing);
    const spacing = Number.isFinite(tracking) ? tracking * text.length : 0;

    return Math.ceil(context.measureText(text).width + spacing);
  } catch {
    // No canvas (jsdom): fall back to the old measurement rather than to zero.
    return element.scrollWidth;
  }
};

export function useColumnWidths<C extends ResizableColumn>({
  cellPadding,
  columns,
  /** The columns outside the drag — a tick box, a row menu. */
  extraWidth = 0,
  /** Width to assume for a header's trailing glyph when the host draws none. */
  glyphFallback,
  headerPadding,
  rows,
  storageKey,
}: {
  cellPadding: number;
  columns: readonly C[];
  extraWidth?: number;
  glyphFallback: number;
  headerPadding: number;
  /** Only its identity matters — a change re-measures the widest cell. */
  rows: readonly unknown[];
  storageKey: string;
}) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [mins, setMins] = useState<Record<string, number>>({});
  const [content, setContent] = useState<Record<string, number>>({});

  const labels = useRef<Record<string, HTMLElement | null>>({});
  const glyphs = useRef<Record<string, HTMLElement | null>>({});
  const cells = useRef<Record<string, HTMLElement[]>>({});

  const dragging = useRef<null | { min: number; name: string; startWidth: number; startX: number }>(
    null,
  );
  // A drag ends in a click on the header; without this the release would sort.
  const dragged = useRef(false);

  const signature = signatureOf(columns);
  useEffect(() => setWidths(loadWidths(storageKey, signature)), [signature, storageKey]);

  // Measured on screen: the answer depends on the font the browser chose.
  useEffect(() => {
    const measured: Record<string, number> = {};
    for (const column of columns) {
      const label = labels.current[column.name];
      if (!label) continue;
      const glyph = glyphs.current[column.name];
      /*
       * The label's TEXT plus the glyph and the padding — see `textWidthOf` for
       * why the element's own width is not the answer. `+1` for the subpixel
       * the ceiling cannot see: a label 53.01px wide in a box floored at 53
       * draws "VERSI…", and one hundredth of a pixel is not worth a truncated
       * heading.
       */
      measured[column.name] = Math.max(
        ABSOLUTE_MIN,
        textWidthOf(label) + 1 + (glyph?.offsetWidth ?? glyphFallback) + headerPadding,
      );
    }
    setMins((current) =>
      JSON.stringify(current) === JSON.stringify(measured) ? current : measured,
    );
  }, [columns, glyphFallback, headerPadding]);

  /*
   * The widest value in each column.
   *
   * `scrollWidth`, deliberately, even though it answers with the cell's own
   * width for any value that does not overflow it — so an undeclared column
   * settles at whatever it started from rather than shrinking to its content.
   * That is the behaviour every screen was built against.
   *
   * Measuring the TEXT here instead (see `textWidthOf`, which the header floor
   * does use) reads a cell holding markup rather than a string far too small: a
   * catalog's identity cell is an avatar beside a title over a subtitle, and the
   * mini app column collapsed to its header, clipping every name to one letter.
   * Fitting such a cell honestly means laying it out at `max-content` and
   * measuring that, which is a second layout pass per cell — worth doing when
   * fitting is what a screen wants, not worth doing to keep a floor.
   */
  useEffect(() => {
    const measured: Record<string, number> = {};
    for (const column of columns) {
      const found = cells.current[column.name]?.filter(Boolean) ?? [];
      if (found.length === 0) continue;
      measured[column.name] = Math.max(...found.map((element) => element.scrollWidth));
    }
    setContent((current) =>
      JSON.stringify(current) === JSON.stringify(measured) ? current : measured,
    );
  }, [columns, rows]);

  const minOf = (column: C) => mins[column.name] ?? ABSOLUTE_MIN;

  const untouched = Object.keys(widths).length === 0;
  const fitted = untouched ? contentWidths(columns, content, minOf, cellPadding) : {};

  /*
   * Three answers, most specific first: what the reader dragged, what the
   * content measured, what the config declared. The last is only a starting
   * point for the render before the rows arrive — once they have, the data
   * knows better than the number somebody typed into a config.
   *
   * ...with one exception, and it is the reason the order reads oddly: a width
   * the SCREEN declared wins over the fitting pass. The fitted answer is
   * measured from a cell that fills its column, so for any value narrower than
   * its column the measurement returns the column — a stable but arbitrary
   * number, and the arbitrary number it settles on is `DEFAULT_WIDTH`. That is
   * how an audit log drew a three-digit status code in 200px and scrolled
   * sideways to do it. A column nobody declared still fits itself.
   *
   * The header floor still applies — a column narrower than its own title is
   * a column whose title cannot be read anywhere — and a declared width that
   * truncates its values is the screen's decision to make: the cell carries
   * the whole value on its `title`, and the row's own page carries it in full.
   */
  const rawWidth = (column: C): number => {
    const stored = widths[column.name];
    if (stored !== undefined) return Math.max(stored, ABSOLUTE_MIN);
    if (column.width !== undefined) return Math.max(column.width, minOf(column));
    return fitted[column.name] ?? DEFAULT_WIDTH;
  };

  /*
   * No scaling to fill the panel.
   *
   * Tried, reverted: multiplying every fitted width by `panel / sum` reads the
   * panel one render behind whatever it is about to change, so the table came
   * out wider than the box it was measured against and scrolled sideways by the
   * difference. Leftover width goes to the absorber column instead, which is
   * what keeps a dragged column landing exactly where it was dropped.
   */
  const widthOf = rawWidth;

  /**
   * Every column plus whatever the host draws outside the drag.
   *
   * Floored: a fractional width rounded up past the panel guarantees a
   * horizontal scrollbar under a table that fits.
   */
  const totalWidth = Math.floor(
    columns.reduce((total, column) => total + widthOf(column), 0) + extraWidth,
  );

  const persist = (next: Record<string, number>) => {
    try {
      const layout: StoredLayout = { columns: signature, widths: next };
      window.localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      // A browser refusing storage is not a reason to lose the drag.
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>, column: C) => {
    event.preventDefault();
    event.stopPropagation();

    dragging.current = {
      min: floorFor(widthOf(column), minOf(column)),
      name: column.name,
      startWidth: widthOf(column),
      startX: event.clientX,
    };
    dragged.current = false;

    /*
     * Freeze what is on screen: the first drag ends the measured layout, and
     * without this the other columns would snap to their defaults as it starts.
     */
    if (untouched) {
      setWidths(Object.fromEntries(columns.map((each) => [each.name, widthOf(each)])));
    }

    const target = event.currentTarget;
    if (typeof target.setPointerCapture === "function") {
      target.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragging.current;
    if (!drag) return;
    dragged.current = true;
    setWidths((current) => ({
      ...current,
      [drag.name]: draggedWidth(drag.startWidth, event.clientX - drag.startX, drag.min),
    }));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    dragging.current = null;

    const target = event.currentTarget;
    if (typeof target.releasePointerCapture === "function") {
      target.releasePointerCapture(event.pointerId);
    }

    setWidths((current) => {
      persist(current);
      return current;
    });
  };

  return {
    /** Spread onto the handle inside each `<th>`. */
    dragHandlers: {
      onPointerCancel: onPointerUp,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
    registerCell:
      (name: string, index: number) =>
      (element: HTMLElement | null): void => {
        const list = (cells.current[name] ??= []);
        if (element) list[index] = element;
      },
    registerGlyph:
      (name: string) =>
      (element: HTMLElement | null): void => {
        glyphs.current[name] = element;
      },
    registerLabel:
      (name: string) =>
      (element: HTMLElement | null): void => {
        labels.current[name] = element;
      },
    /** Every column plus `extraWidth` — what the `<table>` should be set to. */
    totalWidth,
    /**
     * True while no column has a stored / dragged width yet — measured fits
     * still apply, and the last data column may flex into leftover panel space.
     */
    untouched,
    /** True once, right after a drag — so the release does not also sort. */
    wasDragged: (): boolean => {
      if (!dragged.current) return false;
      dragged.current = false;
      return true;
    },
    widthOf,
  };
}
