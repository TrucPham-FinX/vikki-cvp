"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import * as D from "@/admin/design/design";

import { nextSort } from "@/admin/crud/v2/columnLayout";
import { useT } from "../../i18n/useT";
import { useColumnWidths } from "./useColumnWidths";

import styles from "./ListDataTable.module.css";

/* This table's own padding, from `.th` and `.td` in the stylesheet beside it. */
const HEADER_PADDING = 12 + 12;
const CELL_PADDING = 12 + 12;
/* The two columns a drag never touches: neither has a label to measure. */
const CHECK_WIDTH = 44;
const ACTIONS_WIDTH = 44;

/**
 * The hover text for a cell, when the cell's value is plain enough to have one.
 *
 * A string or a number says itself; a badge or an avatar row does not, and a
 * `title` reading "[object Object]" is worse than none.
 */
const cellTitle = (value: React.ReactNode): string | undefined =>
  typeof value === "string" || typeof value === "number" ? String(value) : undefined;

/** `ListColumn.width` allows a CSS string; only a number can be dragged from. */
const numberWidth = (width: number | string | undefined): number | undefined =>
  typeof width === "number" ? width : undefined;

export type ListColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  nowrap?: boolean;
  mono?: boolean;
  muted?: boolean;
  width?: number | string;
  /**
   * How wide the fitting pass may grow this column, where the shared
   * `CONTENT_MAX` is too generous — a URL beside five short columns. The value
   * then truncates, and `title` on the cell keeps it readable on hover.
   */
  maxWidth?: number;
  align?: "left" | "right" | "center";
  /**
   * This header sorts, and `sortField` is what the source is asked to sort by.
   *
   * Per column, not per table: a list is commonly sortable on the columns its
   * service can order by and not on the ones it computes — an audit log can
   * order by its timestamp and its action, and cannot order by an actor's name
   * (a resolved relationship) or by a code inside a JSON blob. A header that
   * lights a glyph, cycles, and returns the rows it always returned is a
   * control that cannot act, and the reader has no way to tell.
   *
   * Defaults to the column's `id` when `sortable` is set without it.
   */
  sortable?: boolean;
  sortField?: string;
};

/** The column a list is ordered by, and which way. Same shape as `CrudSort`. */
export type ListSort = { direction: "asc" | "desc"; field: string };

export type ListRowAction<T> = {
  id: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  onSelect: (row: T) => void;
};

export type ListPagination = {
  /** Left-side status copy; omit for cursor mode when there is nothing to show. */
  rangeLabel?: string;
  pageLabel?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  pageSizeLabel?: string;
  onPageSizeChange?: (size: number) => void;
  prevLabel: string;
  nextLabel: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export type ListDataTableProps<T> = {
  /**
   * Namespaces this list's stored column widths.
   *
   * Required rather than derived from the title: a title is translated, and a
   * reader who switched language would come back to a table that had forgotten
   * their layout. Two lists sharing a key would trade layouts instead.
   */
  storageKey: string;
  title: React.ReactNode;
  source?: React.ReactNode;
  columns: ListColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedKeys?: readonly string[];
  onSelectionChange?: (keys: string[]) => void;
  rowActions?: ListRowAction<T>[] | ((row: T) => ListRowAction<T>[]);
  rowActionsLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  pagination?: ListPagination;
  selectionBar?: React.ReactNode;
  skeletonRows?: number;
  /**
   * Sorting. Pass both and the headers of `sortable` columns become the same
   * control `CrudTable` draws — label, glyph, and a click that cycles
   * ascending → descending → unsorted, so a header can undo itself.
   *
   * Omit them and every header stays a plain label, which is what every caller
   * did before sorting existed here.
   */
  sort?: ListSort | null;
  onSortChange?: (sort: ListSort | null) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

/** Avatar + title + mono subtitle — design identity cell for list rows. */
export function IdentityCell({
  title,
  subtitle,
  avatarUrl,
  avatarName,
  avatar,
}: {
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  avatarName?: string;
  /** Prefer a shared avatar (e.g. `MiniAppAvatar`) over the built-in tile. */
  avatar?: React.ReactNode;
}) {
  const label = avatarName || title;
  return (
    <div className={styles.identity}>
      {avatar != null ? (
        avatar
      ) : avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className={`${styles.identityAvatar} ${styles.identityAvatarImg}`}
          width={28}
          height={28}
        />
      ) : (
        <span className={styles.identityAvatar} aria-hidden>
          {initials(label)}
        </span>
      )}
      <span className={styles.identityText}>
        <span className={styles.identityTitle}>{title}</span>
        {subtitle ? <span className={styles.identitySubtitle}>{subtitle}</span> : null}
      </span>
    </div>
  );
}

/**
 * Both directions, always drawn; the one in force is the one lit.
 *
 * The same mark `crud/v2/CrudTable` draws, at the same size — the two tables
 * are the same object to a reader, and a second glyph for the same gesture is
 * how they stop being.
 */
function SortMark({ direction }: { direction: ListSort["direction"] | null }) {
  return (
    <svg aria-hidden="true" focusable="false" height="14" viewBox="0 0 9 14" width="9">
      <path
        className={direction === "asc" ? styles.sortOn : styles.sortOff}
        d="M4.5 1 L8.5 6 L0.5 6 Z"
      />
      <path
        className={direction === "desc" ? styles.sortOn : styles.sortOff}
        d="M4.5 13 L0.5 8 L8.5 8 Z"
      />
    </svg>
  );
}

function MoreGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

export function RowActionsMenu<T>({
  row,
  actions,
  label,
}: {
  row: T;
  actions: ListRowAction<T>[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    right: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const placeMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    // Approx: padding + one row per action — enough to decide flip vs grow-down.
    const estimatedHeight = 8 + actions.length * 34;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow;
    const next = {
      right: window.innerWidth - rect.right,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    };
    setCoords(next);
    return next;
  }, [actions.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setCoords(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setCoords(null);
      }
    };
    const onReposition = () => placeMenu();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, placeMenu]);

  if (actions.length === 0) return null;

  const menu =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className={styles.menu}
            id={menuId}
            role="menu"
            style={{ top: coords.top, bottom: coords.bottom, right: coords.right }}
          >
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                className={[styles.menuItem, action.danger ? styles.menuItemDanger : ""]
                  .filter(Boolean)
                  .join(" ")}
                disabled={action.disabled}
                title={action.title}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  setCoords(null);
                  action.onSelect(row);
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
    <div className={styles.menuHost}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.menuTrigger}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            setOpen(false);
            setCoords(null);
            return;
          }
          placeMenu();
          setOpen(true);
        }}
      >
        <MoreGlyph />
      </button>
      {menu}
    </div>
  );
}

function ListSkeleton({ rows, colSpan }: { rows: number; colSpan: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td
            colSpan={colSpan}
            style={{
              padding: "13px 16px",
              borderBottom: "1px solid var(--d-border-soft)",
            }}
          >
            <D.Skeleton
              variant="row"
              avatar
              avatarSize={28}
              lineWidths={["42%", "28%"]}
              trailing
              trailingWidth={64}
            />
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Design-faithful list panel: header, optional selection bar, table body
 * (empty / loading / rows), optional row ⋯ menu, and pager footer.
 *
 * Parents own business handlers — selection, row actions, and page-size only
 * appear when the parent wires them.
 */
export function ListDataTable<T>({
  storageKey,
  title,
  source,
  columns,
  rows,
  rowKey,
  loading = false,
  onRowClick,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  rowActions,
  rowActionsLabel,
  emptyTitle,
  emptyDescription,
  emptyAction,
  pagination,
  selectionBar,
  skeletonRows = 5,
  sort = null,
  onSortChange,
}: ListDataTableProps<T>) {
  // The words a screen reader hears, in the reader's language like the rest.
  const t = useT();
  const actionsLabel = rowActionsLabel ?? t("crud.moreActions");
  const selected = new Set(selectedKeys ?? []);
  const keys = rows.map(rowKey);
  const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
  const someSelected = keys.some((k) => selected.has(k));

  const resolveActions = (row: T): ListRowAction<T>[] => {
    if (!rowActions) return [];
    return typeof rowActions === "function" ? rowActions(row) : rowActions;
  };

  const showActionsCol = Boolean(rowActions);
  const colSpan = columns.length + (selectable ? 1 : 0) + 1 + (showActionsCol ? 1 : 0);

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? [] : keys);
  };

  const toggleOne = (key: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange([...next]);
  };

  /*
   * Draggable column widths, from the same hook `CrudTable` runs — so a reader
   * who has widened a column on one list finds the same handle on the next.
   *
   * `ListColumn` is keyed by `id`; the hook speaks `name`, so the columns are
   * presented under that name. Cheap, and it keeps the hook from knowing about
   * two column shapes.
   */
  const resizable = React.useMemo(
    () =>
      columns.map((column) => ({
        maxWidth: column.maxWidth,
        name: column.id,
        width: numberWidth(column.width),
      })),
    [columns],
  );

  const sorting = Boolean(onSortChange);

  const {
    dragHandlers,
    registerCell,
    registerGlyph,
    registerLabel,
    totalWidth,
    wasDragged,
    widthOf,
  } = useColumnWidths<{
    maxWidth?: number;
    name: string;
    width?: number;
  }>({
    cellPadding: CELL_PADDING,
    columns: resizable,
    /* The tick and row-menu columns: outside the drag, but part of the table
         box `totalWidth` describes. */
    extraWidth: (selectable ? CHECK_WIDTH : 0) + (showActionsCol ? ACTIONS_WIDTH : 0),
    /* Room for the sort glyph before its ref lands; none when nothing sorts. */
    glyphFallback: sorting ? 10 : 0,
    headerPadding: HEADER_PADDING,
    rows,
    storageKey: `list:widths:${storageKey}`,
  });

  /* A drag ends in a click on the header; without this the release would sort. */
  const toggleSort = (column: ListColumn<T>) => {
    if (!onSortChange || wasDragged()) return;
    onSortChange(nextSort(sort, column.sortField ?? column.id));
  };

  /*
   * The column itself, not `{ name: id }`: a bare name drops the column's declared `width` and
   * `maxWidth`, so every `<col>` fell back to the content fit while `totalWidth` (the table's
   * min-width) used the declared ones — the two disagreed and the table outgrew its panel.
   * Fixed here in the CVP copy; galaxy-g-admin's ListDataTable has the same line.
   */
  const widthFor = (id: string) =>
    widthOf(resizable.find((column) => column.name === id) ?? { name: id });
  const tableWidth = totalWidth;

  const showEmpty = !loading && rows.length === 0;
  const showPager = Boolean(pagination) && !showEmpty;

  /* `emptyIcon` is no longer read: `D.Empty` draws the design's own mark, and
     a per-caller icon is how one screen's empty state stops looking like the
     next one's. The prop stays in the type so no caller breaks. */
  const emptyBody = (
    <div className={styles.empty}>
      <D.Empty
        action={emptyAction}
        body={emptyDescription}
        title={emptyTitle ?? t("crud.noMatch")}
      />
    </div>
  );

  const tableBody = (
    <>
      <div className={styles.tableWrap}>
        {/*
         * `100%` wide with a `min-width` of what the columns add up to — the
         * same pair `CrudTable` sets, and for the same reason. Under
         * `table-layout: fixed` the browser shares any leftover width out over
         * the columns in proportion, so a five-column list fills its panel
         * instead of ending in a blank strip; when the columns add up to more
         * than the panel, `min-width` wins and the panel scrolls.
         */}
        <table className={styles.table} style={{ minWidth: tableWidth, width: "100%" }}>
          <colgroup>
            {selectable && <col style={{ width: CHECK_WIDTH }} />}
            {resizable.map((column) => (
              <col key={column.name} style={{ width: widthFor(column.name) }} />
            ))}
            {/* The trailing cell's column, held at zero: leftover width goes to
                the real columns now. Sits before the actions col so the row menu
                stays flush to the right edge. */}
            <col style={{ width: 0 }} />
            {showActionsCol && <col style={{ width: ACTIONS_WIDTH }} />}
          </colgroup>
          <thead>
            <tr>
              {selectable ? (
                <th className={`${styles.th} ${styles.thCheck}`}>
                  <D.Checkbox
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    checked={allSelected}
                    ariaLabel={t("crud.selectAll")}
                    onChange={toggleAll}
                  />
                </th>
              ) : null}
              {columns.map((col) => {
                const field = col.sortField ?? col.id;
                const sortsHere = Boolean(onSortChange) && Boolean(col.sortable);
                const active = sort?.field === field;
                return (
                  <th key={col.id} className={styles.th} style={{ textAlign: col.align }}>
                    {/*
                     * A plain label when the column does not sort — not a
                     * disabled button: a header that looks like a control and
                     * refuses is worse than one that never offered.
                     */}
                    {sortsHere ? (
                      <button
                        className={styles.sortButton}
                        type="button"
                        onClick={() => toggleSort(col)}
                      >
                        <span className={styles.thLabel} ref={registerLabel(col.id)}>
                          {col.header}
                        </span>
                        <span className={styles.sortGlyph} ref={registerGlyph(col.id)}>
                          <SortMark direction={active ? sort.direction : null} />
                        </span>
                      </button>
                    ) : (
                      <span className={styles.thLabel} ref={registerLabel(col.id)}>
                        {col.header}
                      </span>
                    )}
                    <span
                      aria-label={t("crud.resizeColumn", { name: col.header })}
                      aria-orientation="vertical"
                      className={styles.resize}
                      role="separator"
                      {...dragHandlers}
                      onPointerDown={(event) => dragHandlers.onPointerDown(event, { name: col.id })}
                    />
                  </th>
                );
              })}
              <th className={`${styles.th} ${styles.thSpacer}`} aria-hidden />
              {showActionsCol ? <th className={`${styles.th} ${styles.thActions}`} /> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <ListSkeleton rows={skeletonRows} colSpan={colSpan} />
            ) : (
              rows.map((row, index) => {
                const key = rowKey(row);
                const actions = resolveActions(row);
                return (
                  <tr
                    key={key}
                    className={onRowClick ? styles.rowClickable : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {selectable ? (
                      <td
                        className={`${styles.td} ${styles.tdCheck}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <D.Checkbox
                          checked={selected.has(key)}
                          ariaLabel={t("crud.selectRow")}
                          onChange={() => toggleOne(key)}
                        />
                      </td>
                    ) : null}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={[
                          styles.td,
                          col.mono ? styles.tdMono : "",
                          col.muted ? styles.tdMuted : "",
                          col.nowrap ? styles.tdNowrap : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        style={{ textAlign: col.align }}
                      >
                        {/* `title` so a truncated value is still readable — the
                            cell clips, and a capped column clips on purpose. */}
                        <div
                          className={styles.cell}
                          ref={registerCell(col.id, index)}
                          title={cellTitle(col.cell(row))}
                        >
                          {col.cell(row)}
                        </div>
                      </td>
                    ))}
                    <td className={`${styles.td} ${styles.tdSpacer}`} aria-hidden />
                    {showActionsCol ? (
                      <td
                        className={`${styles.td} ${styles.tdActions}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActionsMenu row={row} actions={actions} label={actionsLabel} />
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/*
       * `D.Pager` — the template's own footer strip, which is where the pager
       * lost its grey background and gained the page-size control's styling.
       * The props map one to one; this component's own pager markup was a
       * second implementation of the same four controls.
       */}
      {showPager && pagination ? (
        <D.Pager
          atFirst={!pagination.canPrev}
          atLast={!pagination.canNext}
          meta={pagination.rangeLabel ?? ""}
          next={pagination.onNext}
          nextLabel={pagination.nextLabel}
          page={pagination.pageLabel ?? ""}
          pageSize={pagination.pageSize ?? pagination.pageSizeOptions?.[0] ?? 10}
          pageSizes={[...(pagination.pageSizeOptions ?? [])]}
          prev={pagination.onPrev}
          prevLabel={pagination.prevLabel}
          rowsLabel={pagination.pageSizeLabel ?? t("crud.rowsPerPage")}
          onPageSize={(size) => pagination.onPageSizeChange?.(size)}
        />
      ) : null}
    </>
  );

  const body = showEmpty ? emptyBody : tableBody;

  return (
    <div className={styles.root}>
      {selectionBar ? <div className={styles.selectionBar}>{selectionBar}</div> : null}
      <D.Panel actions={source} clip={!showActionsCol} title={title}>
        {body}
      </D.Panel>
    </div>
  );
}

/** Inner content for the blue selection strip above a list panel. */
export function ListSelectionBar({
  countLabel,
  actions,
  clearLabel,
  onClear,
}: {
  countLabel: string;
  actions: React.ReactNode;
  clearLabel: string;
  onClear: () => void;
}) {
  return (
    <>
      <span className={styles.selectionCount}>{countLabel}</span>
      <span className={styles.selectionDivider} aria-hidden />
      {actions}
      <span className={styles.selectionSpacer} />
      <D.LinkButton onClick={onClear}>{clearLabel}</D.LinkButton>
    </>
  );
}
