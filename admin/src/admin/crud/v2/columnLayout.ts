/**
 * Column widths: what they start at, and what they may be dragged to.
 *
 * Pure, and separate from the table, because it is the one part of a resizable
 * table that is arithmetic rather than DOM — and the part that was wrong twice
 * before it was right. The table owns the pointer events and the measuring;
 * this owns the numbers.
 */

export const DEFAULT_WIDTH = 200;

/** No column may be dragged narrower than this, whatever its header measures. */
export const ABSOLUTE_MIN = 56;

/** Header padding either side, plus the gap before the sort glyph. */
export const HEADER_PADDING = 12 + 16 + 8;

/** A cell's own padding, left and right — see `.table td`. */
export const CELL_PADDING = 12 + 12;

/**
 * How wide a column may be by DEFAULT.
 *
 * A cap on the automatic answer only. One long note in one row would otherwise
 * hand that column half the table and push everything else off the side, and
 * the reader would have to drag their way back to a layout they never chose.
 * Past this, the cell truncates and its full value is on the `title`.
 *
 * A drag is not capped: an operator widening a column to read it is making a
 * decision, and there is nothing to protect them from.
 */
export const CONTENT_MAX = 360;

/**
 * The width a column wants: enough for its widest value, and its own title.
 *
 * Measured from what is on screen rather than guessed from a character count,
 * because the answer depends on the font the browser picked, the glyphs in the
 * data, and the reader's zoom. `content` is the widest cell's natural width —
 * the host measures at `max-content` so a short value is not reported as the
 * column it currently sits in.
 *
 * Ordered deliberately: the header floor is applied AFTER the cap, so a column
 * whose title is wider than `CONTENT_MAX` still shows its title. A truncated
 * heading is worse than a wide column — the value can be read from the row, the
 * heading cannot be read from anywhere.
 */
export const contentWidth = (
  content: number,
  headerMin: number,
  cellPadding: number = CELL_PADDING,
  /**
   * This column's own cap, where `CONTENT_MAX` is too generous for it.
   *
   * For the one column that holds something unbounded next to five that do not
   * — an audit log's endpoint path beside a timestamp, a code and a name. Left
   * to the shared cap it asks for 360px of a 900px panel and pushes the table
   * into a horizontal scroll, so it takes what is declared for it and truncates.
   * The header floor still wins, as it does over `CONTENT_MAX`.
   */
  maxWidth: number = CONTENT_MAX,
): number => Math.max(headerMin, Math.min(Math.ceil(content) + cellPadding, maxWidth, CONTENT_MAX));

/**
 * Every column's default, from what the rows turned out to hold.
 *
 * `{}` until something has been measured, which is the first render and any
 * render with no rows. The caller falls back to the config's own `width` there,
 * so a screen is never laid out from nothing.
 *
 * This replaced sharing the panel's width out equally between the columns. That
 * heuristic knew nothing about the data: a 24-character code and a yes/no flag
 * got the same 200px, so one truncated while the other held an inch of white
 * space. Fitting the content is strictly better information, and it is only
 * available once the rows are on screen — which is why this runs after a load
 * rather than before one.
 */
export const contentWidths = <C extends { maxWidth?: number; name: string }>(
  columns: readonly C[],
  content: Record<string, number>,
  minOf: (column: C) => number,
  /* The host table's own cell padding; `ListDataTable` and `CrudTable` pad the
     same today, but the number belongs to whoever drew the cell. */
  cellPadding: number = CELL_PADDING,
): Record<string, number> => {
  const measured = columns.filter((column) => content[column.name] !== undefined);
  if (measured.length === 0) return {};

  return Object.fromEntries(
    measured.map((column) => [
      column.name,
      contentWidth(content[column.name], minOf(column), cellPadding, column.maxWidth),
    ]),
  );
};

/**
 * The floor for a drag in progress.
 *
 * The measured header width, normally — a column dragged under its own title
 * ships a truncated title. Unless the column is ALREADY narrower than that,
 * where holding the line would mean it cannot be dragged at all.
 *
 * Same rule as the original table's `floorFor`, restated here so the v2 table
 * does not import from the file it replaces. `resize.test.ts` covers that one;
 * `columnLayout.test.ts` covers this one.
 */
export const floorFor = (current: number, measured: number): number =>
  current < measured ? ABSOLUTE_MIN : measured;

/** Where a drag lands: the pointer's delta, never below the floor. */
export const draggedWidth = (startWidth: number, delta: number, min: number): number =>
  Math.max(min, startWidth + delta);

/**
 * Click cycles ascending → descending → unsorted, so a header can undo itself.
 *
 * `null` means unsorted, which the list sends as no `sort` at all.
 */
export const nextSort = (
  current: null | { direction: "asc" | "desc"; field: string },
  field: string,
): null | { direction: "asc" | "desc"; field: string } => {
  if (current?.field !== field) return { direction: "asc", field };
  if (current.direction === "asc") return { direction: "desc", field };
  return null;
};
