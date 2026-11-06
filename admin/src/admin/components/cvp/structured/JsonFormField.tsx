"use client";

import { FieldDescription, FieldError, FieldLabel, useField, useFormFields, useLocale } from "@payloadcms/ui";
import { mergeFieldStyles } from "@payloadcms/ui/shared";
import type { CodeFieldClientProps } from "payload";
import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useT } from "@/admin/i18n/useT";
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  blankLike,
  documentTemplate,
  foldsRows,
  freshId,
  getAt,
  insertAt,
  isAdvancedKey,
  isBlockList,
  isBlockType,
  isObject,
  labelOf,
  LIST_STYLES,
  moveAt,
  newBlock,
  newRow,
  optionalKeys,
  parseObject,
  removeAt,
  rowLabelOf,
  setAt,
  summaryOf,
  textKind,
  toText,
  type Json,
  type JsonObject,
  type Path,
} from "@/cvp/structured";

import { HtmlEditor } from "../fields/HtmlEditor";
import { ImagePicker } from "../fields/ImagePicker";
import { LinkPicker } from "../fields/LinkPicker";
import styles from "./structured.module.css";

/**
 * A JSON object kept as text (a popup's content, a page's own data: cvp/fields.ts extraJsonField),
 * edited as a form instead of typed: sections and articles fold, a paragraph or a list answer is
 * written with the rich-text toolbar, a table is a grid, an image is picked from the page's, a
 * button's popup from the popups the admin knows. "JSON" shows the text itself.
 *
 * Values change where they are (cvp/structured.ts), so every key keeps its place and the keys the
 * form has no editor for are kept as they were: the JSON written back differs only by what was
 * typed. Nothing is rewritten until the editor changes something.
 */

type Shape = "document" | "data";

type Ctx = {
  edit: (path: Path, value: Json) => void;
  change: (update: (root: Json) => Json) => void;
  page: string;
  file: string;
  locale: string;
  layout: string;
  shape: Shape;
  readOnly: boolean;
};

const Context = createContext<Ctx | null>(null);

const useCtx = () => {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("JsonFormField's editors are used inside it");
  return ctx;
};

const keyOf = (path: Path) => path.join(".");

export function JsonFormField(props: CodeFieldClientProps & { shape?: Shape }) {
  const { field, path, readOnly = false, shape = "data" } = props;
  const t = useT();
  const locale = useLocale()?.code ?? "vi";
  const { value, setValue, showError, errorMessage } = useField<string | null>({ path });
  const page = useFormFields(([fields]) => (typeof fields.page?.value === "string" ? fields.page.value.trim() : ""));
  const file = useFormFields(([fields]) => (typeof fields.file?.value === "string" ? fields.file.value.trim() : ""));
  const layout = useFormFields(([fields]) => (typeof fields.layout?.value === "string" ? fields.layout.value : ""));

  const text = typeof value === "string" ? value : "";
  const parsed = useMemo(() => parseObject(text), [text]);
  // The tree is the form's while it edits: rows not edited keep their identity, so they are not
  // drawn again. Text that changes from elsewhere (JSON mode, another language, a reset) replaces it
  const [tree, setTree] = useState<JsonObject>(() => (parsed.ok ? parsed.value : {}));
  const written = useRef(text);
  const latest = useRef<Json>(tree);
  useEffect(() => {
    if (text === written.current) return;
    written.current = text;
    if (parsed.ok) {
      setTree(parsed.value);
      latest.current = parsed.value;
    }
  }, [text, parsed]);

  const [mode, setMode] = useState<"form" | "json">(parsed.ok ? "form" : "json");

  const commit = useCallback(
    (next: Json) => {
      const root = isObject(next) ? next : {};
      latest.current = root;
      setTree(root);
      const out = Object.keys(root).length ? toText(root) : "";
      written.current = out;
      setValue(out || null);
    },
    [setValue],
  );

  const ctx = useMemo<Ctx>(
    () => ({
      edit: (at, next) => commit(setAt(latest.current, at, next)),
      change: (update) => commit(update(latest.current)),
      page,
      file,
      locale,
      layout,
      shape,
      readOnly,
    }),
    [commit, page, file, locale, layout, shape, readOnly],
  );

  const description = field.admin?.description;
  const empty = !Object.keys(tree).length;

  return (
    <div className={`field-type json ${styles.root}`} style={mergeFieldStyles(field)}>
      <div className={styles.head}>
        <FieldLabel label={field.label} path={path} required={field.required} localized={field.localized} />
        <div className={styles.modes} role="group">
          <button
            aria-pressed={mode === "form"}
            className={`${styles.mode} ${mode === "form" ? styles.modeOn : ""}`}
            disabled={!parsed.ok}
            title={parsed.ok ? undefined : t("json.invalid", { error: parsed.error })}
            type="button"
            onClick={() => setMode("form")}
          >
            {t("json.mode.form")}
          </button>
          <button
            aria-pressed={mode === "json"}
            className={`${styles.mode} ${mode === "json" ? styles.modeOn : ""}`}
            type="button"
            onClick={() => setMode("json")}
          >
            {t("json.mode.json")}
          </button>
        </div>
      </div>
      <FieldError path={path} showError={showError} message={errorMessage} />
      {typeof description === "string" ? <FieldDescription description={description} path={path} /> : null}

      {mode === "json" || !parsed.ok ? (
        <>
          {!parsed.ok ? (
            <div className={styles.warn}>
              {parsed.error === "not-object" ? t("json.notObject") : t("json.invalid", { error: parsed.error })}
            </div>
          ) : null}
          <textarea
            className={styles.source}
            readOnly={readOnly}
            rows={18}
            spellCheck={false}
            value={text}
            onChange={(event) => setValue(event.target.value || null)}
          />
        </>
      ) : (
        <Context.Provider value={ctx}>
          <div className={styles.form}>
            {empty && shape === "data" ? (
              <>
                <div className={styles.empty}>
                  <span>{t("json.empty")}</span>
                </div>
                <ObjectBody path={[]} pathKey="" value={tree} />
              </>
            ) : empty ? (
              <div className={styles.empty}>
                <span>{t("json.empty")}</span>
                {shape === "document" ? (
                  <button
                    className={`${styles.btn} ${styles.primary}`}
                    disabled={readOnly}
                    type="button"
                    onClick={() => commit(documentTemplate(layout))}
                  >
                    {t("json.start")}
                  </button>
                ) : null}
              </div>
            ) : (
              <ObjectBody path={[]} pathKey="" value={tree} />
            )}
          </div>
        </Context.Provider>
      )}
    </div>
  );
}

/* ── an object: its keys as labelled fields ─────────────────────────────────────── */

type NodeProps<T extends Json = Json> = { path: Path; pathKey: string; value: T };

const sameNode = (a: NodeProps, b: NodeProps) => a.value === b.value && a.pathKey === b.pathKey;

// Keys a block's own editor draws
const BLOCK_OWN = new Set(["type", "text", "items", "style", "headerRows", "rows"]);

const ObjectBody = memo(function ObjectBody({ path, value, skip }: NodeProps<JsonObject> & { skip?: Set<string> }) {
  const t = useT();
  const { change, layout, shape, readOnly } = useCtx();
  const entries = Object.entries(value).filter(([key]) => !skip?.has(key));
  const main = entries.filter(([key, child]) => !isAdvancedKey(key) || isObject(child) || Array.isArray(child));
  const advanced = entries.filter(([key, child]) => isAdvancedKey(key) && !isObject(child) && !Array.isArray(child));
  const addable = optionalKeys(path, value, layout, shape).filter(({ key }) => !skip?.has(key));

  return (
    <div className={styles.object}>
      {main.map(([key, child]) => (
        <KeyRow key={key} keyName={key} path={[...path, key]} value={child} />
      ))}
      {advanced.length ? (
        <details className={styles.advanced}>
          <summary>{t("json.advanced", { list: advanced.map(([key]) => labelOf(key)).join(", ") })}</summary>
          {advanced.map(([key, child]) => (
            <KeyRow key={key} keyName={key} path={[...path, key]} value={child} />
          ))}
        </details>
      ) : null}
      {addable.length ? (
        <div className={styles.addKeys}>
          {addable.map(({ key, value: start }) => (
            <button
              key={key}
              className={styles.btnGhost}
              disabled={readOnly}
              type="button"
              onClick={() => change((root) => setAt(root, [...path, key], start))}
            >
              + {labelOf(key)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}, (a, b) => a.value === b.value && a.pathKey === b.pathKey && a.skip === b.skip);

/** One key of an object: its name and its editor */
const KeyRow = memo(function KeyRow({ keyName, path, value }: { keyName: string; path: Path; value: Json }) {
  const pathKey = keyOf(path);
  const label = labelOf(keyName);
  if (Array.isArray(value)) {
    return (
      <section className={styles.group}>
        <div className={styles.groupLabel}>
          {label} <span className={styles.count}>{value.length}</span>
        </div>
        <ArrayEditor keyName={keyName} path={path} pathKey={pathKey} value={value} />
      </section>
    );
  }
  if (isObject(value)) {
    if (isBlockType(value.type)) {
      return (
        <section className={styles.group}>
          <div className={styles.groupLabel}>{label}</div>
          <BlockEditor path={path} pathKey={pathKey} value={value} />
        </section>
      );
    }
    return (
      <section className={styles.group}>
        <div className={styles.groupLabel}>{label}</div>
        <div className={styles.nested}>
          <ObjectBody path={path} pathKey={pathKey} value={value} />
        </div>
      </section>
    );
  }
  // Not a <label>: an image or link picker holds buttons, which a label's click would press
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel} title={keyName}>
        {label}
      </span>
      <Scalar keyName={keyName} label={label} path={path} pathKey={pathKey} value={value} />
    </div>
  );
}, (a, b) => a.value === b.value && keyOf(a.path) === keyOf(b.path));

/* ── text, numbers, yes/no ───────────────────────────────────────────────────────── */

const Scalar = memo(function Scalar({
  keyName,
  label,
  path,
  value,
}: NodeProps & { keyName: string | number; label?: string }) {
  const { edit, page, file, locale, readOnly } = useCtx();
  // Chosen once: an editor does not turn into another while one types into it
  const [kind] = useState(() => (typeof value === "string" ? textKind(keyName, value) : null));

  if (typeof value === "boolean") {
    return (
      <input
        aria-label={label}
        checked={value}
        className={styles.check}
        disabled={readOnly}
        type="checkbox"
        onChange={(event) => edit(path, event.target.checked)}
      />
    );
  }
  if (typeof value === "number") {
    return (
      <input
        aria-label={label}
        className={styles.input}
        readOnly={readOnly}
        type="number"
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => edit(path, event.target.value === "" ? 0 : Number(event.target.value))}
      />
    );
  }
  const textValue = typeof value === "string" ? value : "";
  const write = (next: string | null) => edit(path, next ?? "");
  switch (kind) {
    case "image":
      return page ? (
        <ImagePicker file={file} locale={locale} page={page} readOnly={readOnly} value={textValue} onChange={write} />
      ) : (
        <input aria-label={label} className={styles.input} readOnly={readOnly} value={textValue} onChange={(e) => write(e.target.value)} />
      );
    case "link":
      return (
        <LinkPicker
          kind={keyName === "popupLink" ? "popupLink" : "popup"}
          locale={locale}
          readOnly={readOnly}
          value={textValue}
          onChange={write}
        />
      );
    case "html":
      return <HtmlEditor compact label={label} readOnly={readOnly} value={textValue} onChange={write} />;
    case "multiline":
      return <AutoText label={label} readOnly={readOnly} value={textValue} onChange={write} />;
    default:
      return (
        <input aria-label={label} className={styles.input} readOnly={readOnly} value={textValue} onChange={(e) => write(e.target.value)} />
      );
  }
}, sameNode);

/** A textarea as tall as its text */
function AutoText({
  value,
  onChange,
  readOnly,
  className,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  className?: string;
  label?: string;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={box}
      aria-label={label}
      className={className ?? styles.textarea}
      readOnly={readOnly}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/* ── arrays: rows that fold, move, copy, go ──────────────────────────────────────── */

const ArrayEditor = memo(function ArrayEditor({
  keyName,
  path,
  value,
  asList = false,
}: NodeProps<Json[]> & { keyName: string | number; asList?: boolean }) {
  const t = useT();
  const { change, readOnly } = useCtx();
  // A list's rows are one line of text each: never folded
  const folding = !asList && foldsRows(value);
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const blocks = isBlockList(keyName, value);
  const listItems = asList;

  const toggle = (index: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  // Rows keep their open state when one moves or goes
  const remap = (map: (index: number) => number | null) =>
    setOpen((current) => new Set([...current].map(map).filter((index): index is number => index !== null)));

  const add = (row: Json) => {
    const index = value.length;
    change((root) => {
      // A new part gets an id of its own: the layouts open and close parts by id
      const placed = isObject(row) && row.id === "" ? { ...row, id: freshId(root, keyName) } : row;
      return insertAt(root, path, index, placed);
    });
    if (folding || foldsRows([...value, row])) setOpen((current) => new Set(current).add(index));
  };

  const move = (from: number, to: number) => {
    change((root) => moveAt(root, path, from, to));
    remap((index) => (index === from ? to : index === to ? from : index));
  };

  const duplicate = (index: number) => {
    change((root) => insertAt(root, path, index + 1, structuredClone(value[index] ?? null)));
    remap((i) => (i > index ? i + 1 : i));
  };

  const remove = (index: number) => {
    const row = value[index];
    if ((isObject(row) || Array.isArray(row)) && summaryOf(row) && !window.confirm(t("json.row.removeConfirm"))) return;
    change((root) => removeAt(root, [...path, index]));
    remap((i) => (i === index ? null : i > index ? i - 1 : i));
  };

  return (
    <div className={styles.array}>
      {value.map((item, index) => {
        const itemPath = [...path, index];
        const itemKey = keyOf(itemPath);
        const folded = folding && !open.has(index) && (isObject(item) || Array.isArray(item));
        const blockType = isObject(item) && isBlockType(item.type) ? item.type : null;
        return (
          <div key={index} className={`${styles.row} ${blockType ? styles[`row_${blockType}`] ?? "" : ""}`}>
            <div className={styles.rowHead}>
              {folding && (isObject(item) || Array.isArray(item)) ? (
                <button
                  aria-expanded={!folded}
                  className={styles.fold}
                  title={folded ? t("json.fold.open") : t("json.fold.close")}
                  type="button"
                  onClick={() => toggle(index)}
                >
                  {folded ? "▸" : "▾"}
                </button>
              ) : null}
              <button className={styles.rowTitle} type="button" onClick={() => folding && toggle(index)}>
                <span className={styles.rowIndex}>{listItems ? `${index + 1}.` : blockType ? BLOCK_LABELS[blockType] : `#${index + 1}`}</span>
                {/* A list row's text is right below it, a block's kind says what it is */}
                {folded || (!blockType && !listItems) ? (
                  <span className={styles.rowSummary}>{summaryOf(item) || t("json.untitled")}</span>
                ) : null}
              </button>
              <RowActions
                disabled={readOnly}
                first={index === 0}
                last={index === value.length - 1}
                onCopy={() => duplicate(index)}
                onDown={() => move(index, index + 1)}
                onRemove={() => remove(index)}
                onUp={() => move(index, index - 1)}
              />
            </div>
            {folded ? null : (
              <div className={styles.rowBody}>
                {blockType ? (
                  <BlockEditor path={itemPath} pathKey={itemKey} value={item as JsonObject} />
                ) : isObject(item) ? (
                  listItems ? (
                    <ListItem path={itemPath} pathKey={itemKey} value={item} />
                  ) : (
                    <ObjectBody path={itemPath} pathKey={itemKey} value={item} />
                  )
                ) : Array.isArray(item) ? (
                  <ArrayEditor keyName={index} path={itemPath} pathKey={itemKey} value={item} />
                ) : (
                  <Scalar keyName={keyName} path={itemPath} pathKey={itemKey} value={item} />
                )}
              </div>
            )}
          </div>
        );
      })}
      {value.length === 0 ? <div className={styles.none}>{t("json.none")}</div> : null}
      <div className={styles.adds}>
        {blocks ? (
          BLOCK_TYPES.map((type) => (
            <button key={type} className={styles.btnGhost} disabled={readOnly} type="button" onClick={() => add(newBlock(type))}>
              + {BLOCK_LABELS[type]}
            </button>
          ))
        ) : (
          <button className={styles.btnGhost} disabled={readOnly} type="button" onClick={() => add(newRow(keyName, value))}>
            + {t("json.add", { what: rowLabelOf(keyName) })}
          </button>
        )}
      </div>
    </div>
  );
}, (a, b) => a.value === b.value && a.pathKey === b.pathKey && a.asList === b.asList);

function RowActions({
  disabled,
  first,
  last,
  onUp,
  onDown,
  onCopy,
  onRemove,
}: {
  disabled: boolean;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onCopy: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  return (
    <span className={styles.rowActions}>
      <button aria-label={t("json.row.up")} className={styles.icon} disabled={disabled || first} title={t("json.row.up")} type="button" onClick={onUp}>
        ↑
      </button>
      <button aria-label={t("json.row.down")} className={styles.icon} disabled={disabled || last} title={t("json.row.down")} type="button" onClick={onDown}>
        ↓
      </button>
      <button aria-label={t("json.row.copy")} className={styles.icon} disabled={disabled} title={t("json.row.copy")} type="button" onClick={onCopy}>
        ⧉
      </button>
      <button
        aria-label={t("json.row.remove")}
        className={`${styles.icon} ${styles.iconDanger}`}
        disabled={disabled}
        title={t("json.row.remove")}
        type="button"
        onClick={onRemove}
      >
        ✕
      </button>
    </span>
  );
}

/* ── content blocks: paragraph, subheading, list, table ──────────────────────────── */

const BlockEditor = memo(function BlockEditor({ path, value }: NodeProps<JsonObject>) {
  const { edit, readOnly } = useCtx();
  const type = value.type;
  return (
    <div className={styles.block}>
      {typeof value.text === "string" ? (
        <HtmlEditor
          compact={type !== "paragraph"}
          readOnly={readOnly}
          value={value.text}
          onChange={(next) => edit([...path, "text"], next ?? "")}
        />
      ) : null}
      {type === "list" ? <ListBody path={path} pathKey={keyOf(path)} value={value} /> : null}
      {type === "table" ? <TableEditor path={path} pathKey={keyOf(path)} value={value} /> : null}
      <ObjectBody path={path} pathKey={keyOf(path)} skip={BLOCK_OWN} value={value} />
    </div>
  );
}, sameNode);

/** A list's numbering and rows (a list block, or the nested list of a row: `children`) */
const ListBody = memo(function ListBody({ path, value }: NodeProps<JsonObject>) {
  const t = useT();
  const { edit, readOnly } = useCtx();
  const style = typeof value.style === "string" ? value.style : "";
  const items = Array.isArray(value.items) ? value.items : null;
  const known = LIST_STYLES.some((option) => option.value === style);
  return (
    <div className={styles.list}>
      <label className={styles.inline}>
        <span>{t("json.list.style")}</span>
        <select
          className={styles.select}
          disabled={readOnly}
          value={style}
          onChange={(event) => edit([...path, "style"], event.target.value)}
        >
          {known || !style ? null : <option value={style}>{style}</option>}
          {style ? null : <option value="">—</option>}
          {LIST_STYLES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {items ? (
        <ArrayEditor asList keyName="items" path={[...path, "items"]} pathKey={keyOf([...path, "items"])} value={items} />
      ) : null}
    </div>
  );
}, sameNode);

// A list row's own keys, drawn by ListItem
const LIST_ITEM_OWN = new Set(["text", "children"]);

/** A list row: its text, and the list nested in it */
const ListItem = memo(function ListItem({ path, value }: NodeProps<JsonObject>) {
  const t = useT();
  const { edit, change, readOnly } = useCtx();
  const children = value.children;
  return (
    <div className={styles.listItem}>
      {typeof value.text === "string" || !Object.keys(value).length ? (
        <HtmlEditor
          compact
          readOnly={readOnly}
          value={typeof value.text === "string" ? value.text : ""}
          onChange={(next) => edit([...path, "text"], next ?? "")}
        />
      ) : null}
      {isObject(children) && Array.isArray(children.items) ? (
        <div className={styles.sublist}>
          <div className={styles.sublistHead}>
            <span>{t("json.list.children")}</span>
            <button
              className={styles.btnGhost}
              disabled={readOnly}
              type="button"
              onClick={() => change((root) => removeAt(root, [...path, "children"]))}
            >
              {t("json.list.removeChildren")}
            </button>
          </div>
          <ListBody path={[...path, "children"]} pathKey={keyOf([...path, "children"])} value={children} />
        </div>
      ) : children !== undefined ? (
        <KeyRow keyName="children" path={[...path, "children"]} value={children} />
      ) : null}
      <ObjectBody path={path} pathKey={keyOf(path)} skip={LIST_ITEM_OWN} value={value} />
    </div>
  );
}, sameNode);

/* ── a table as a grid ───────────────────────────────────────────────────────────── */

type CellRef = { part: "headerRows" | "rows"; row: number; cell: number };

// A cell's line breaks are the HTML's <br>: typed as Enter, shown as lines
const toLines = (value: string) => (value.includes("\n") ? value : value.replace(/<br\s*\/?>/gi, "\n"));
const fromLines = (value: string, before: string) => (before.includes("\n") ? value : value.replace(/\n/g, "<br>"));

const TableEditor = memo(function TableEditor({ path, value }: NodeProps<JsonObject>) {
  const t = useT();
  const { edit, change, readOnly } = useCtx();
  const [selected, setSelected] = useState<CellRef | null>(null);
  const parts = (["headerRows", "rows"] as const).filter((part) => Array.isArray(value[part]));
  const rowsOf = (part: CellRef["part"]) => (Array.isArray(value[part]) ? (value[part] as Json[]) : []);
  const cellsOf = (row: Json) => (isObject(row) && Array.isArray(row.cells) ? row.cells : []);
  const cellAt = (ref: CellRef | null) => (ref ? getAt(value, [ref.part, ref.row, "cells", ref.cell]) : undefined);
  const current = cellAt(selected);
  const currentCell = isObject(current) ? current : null;

  const widest = Math.max(1, ...parts.flatMap((part) => rowsOf(part).map((row) => cellsOf(row).length)));

  const addRow = (part: CellRef["part"], at: number) => {
    const rows = rowsOf(part);
    const sample = rows[Math.min(at, rows.length - 1)] ?? rows[rows.length - 1];
    const row = sample ? blankLike(sample) : { cells: Array.from({ length: widest }, () => ({ value: "" })) };
    change((root) => insertAt(root, [...path, part], at, row));
    setSelected({ part, row: at, cell: 0 });
  };

  const addColumn = () =>
    change((root) => {
      let next = root;
      for (const part of parts) {
        rowsOf(part).forEach((_, row) => {
          const cellsPath = [...path, part, row, "cells"];
          const cells = getAt(next, cellsPath);
          next = insertAt(next, cellsPath, Array.isArray(cells) ? cells.length : 0, { value: "" });
        });
      }
      return next;
    });

  const removeLastColumn = () =>
    change((root) => {
      let next = root;
      for (const part of parts) {
        rowsOf(part).forEach((_, row) => {
          const cells = getAt(next, [...path, part, row, "cells"]);
          if (Array.isArray(cells) && cells.length > 1) next = removeAt(next, [...path, part, row, "cells", cells.length - 1]);
        });
      }
      return next;
    });

  const setCellKey = (key: "colspan" | "rowspan" | "className", raw: string) => {
    if (!selected) return;
    const cellPath = [...path, selected.part, selected.row, "cells", selected.cell];
    const trimmed = raw.trim();
    if (key === "className") {
      change((root) => (trimmed ? setAt(root, [...cellPath, key], trimmed) : removeAt(root, [...cellPath, key])));
      return;
    }
    const n = Number(trimmed);
    change((root) =>
      Number.isInteger(n) && n > 1 ? setAt(root, [...cellPath, key], n) : removeAt(root, [...cellPath, key]),
    );
  };

  return (
    <div className={styles.table}>
      <div className={styles.tableBar}>
        <button className={styles.btnGhost} disabled={readOnly} type="button" onClick={() => addRow("rows", rowsOf("rows").length)}>
          + {t("json.table.addRow")}
        </button>
        <button className={styles.btnGhost} disabled={readOnly} type="button" onClick={addColumn}>
          + {t("json.table.addColumn")}
        </button>
        <button className={styles.btnGhost} disabled={readOnly || widest <= 1} type="button" onClick={removeLastColumn}>
          {t("json.table.removeColumn")}
        </button>
        {!Array.isArray(value.headerRows) ? (
          <button
            className={styles.btnGhost}
            disabled={readOnly}
            type="button"
            onClick={() => edit([...path, "headerRows"], [{ cells: Array.from({ length: widest }, () => ({ value: "" })) }])}
          >
            + {t("json.table.addHeader")}
          </button>
        ) : null}
      </div>

      {selected && currentCell ? (
        <div className={styles.cellBar}>
          <span className={styles.cellWhere}>
            {selected.part === "headerRows" ? t("json.table.headerRow") : t("json.table.row")} {selected.row + 1} · {t("json.table.cell")}{" "}
            {selected.cell + 1}
          </span>
          <label className={styles.inline}>
            <span>{t("json.table.colspan")}</span>
            <input
              className={styles.small}
              min={1}
              readOnly={readOnly}
              type="number"
              value={typeof currentCell.colspan === "number" ? currentCell.colspan : 1}
              onChange={(event) => setCellKey("colspan", event.target.value)}
            />
          </label>
          <label className={styles.inline}>
            <span>{t("json.table.rowspan")}</span>
            <input
              className={styles.small}
              min={1}
              readOnly={readOnly}
              type="number"
              value={typeof currentCell.rowspan === "number" ? currentCell.rowspan : 1}
              onChange={(event) => setCellKey("rowspan", event.target.value)}
            />
          </label>
          <label className={styles.inline}>
            <span>{t("json.table.cellClass")}</span>
            <input
              className={styles.input}
              readOnly={readOnly}
              value={typeof currentCell.className === "string" ? currentCell.className : ""}
              onChange={(event) => setCellKey("className", event.target.value)}
            />
          </label>
          <span className={styles.spacer} />
          <button className={styles.btnGhost} disabled={readOnly} type="button" onClick={() => addRow(selected.part, selected.row + 1)}>
            + {t("json.table.rowBelow")}
          </button>
          <button
            className={styles.btnGhost}
            disabled={readOnly}
            type="button"
            onClick={() => {
              change((root) => insertAt(root, [...path, selected.part, selected.row, "cells"], selected.cell + 1, { value: "" }));
              setSelected({ ...selected, cell: selected.cell + 1 });
            }}
          >
            + {t("json.table.cellRight")}
          </button>
          <button
            className={`${styles.btnGhost} ${styles.dangerText}`}
            disabled={readOnly || cellsOf(rowsOf(selected.part)[selected.row] ?? null).length <= 1}
            type="button"
            onClick={() => {
              change((root) => removeAt(root, [...path, selected.part, selected.row, "cells", selected.cell]));
              setSelected(null);
            }}
          >
            {t("json.table.removeCell")}
          </button>
          <button
            className={`${styles.btnGhost} ${styles.dangerText}`}
            disabled={readOnly}
            type="button"
            onClick={() => {
              change((root) => removeAt(root, [...path, selected.part, selected.row]));
              setSelected(null);
            }}
          >
            {t("json.table.removeRow")}
          </button>
        </div>
      ) : (
        <div className={styles.hint}>{t("json.table.hint")}</div>
      )}

      <div className={styles.gridWrap}>
        <table className={styles.grid}>
          {parts.map((part) => {
            const Section = part === "headerRows" ? "thead" : "tbody";
            return (
              <Section key={part}>
                {rowsOf(part).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {cellsOf(row).map((cell, cellIndex) => {
                      const data = isObject(cell) ? cell : { value: typeof cell === "string" ? cell : "" };
                      const text = typeof data.value === "string" ? data.value : data.value == null ? "" : String(data.value);
                      const on =
                        selected?.part === part && selected.row === rowIndex && selected.cell === cellIndex;
                      const Cell = part === "headerRows" ? "th" : "td";
                      return (
                        <Cell
                          key={cellIndex}
                          className={`${styles.gridCell} ${on ? styles.gridCellOn : ""} ${
                            typeof data.className === "string" && /\bbold\b/.test(data.className) ? styles.bold : ""
                          }`}
                          colSpan={typeof data.colspan === "number" ? data.colspan : undefined}
                          rowSpan={typeof data.rowspan === "number" ? data.rowspan : undefined}
                          onFocus={() => setSelected({ part, row: rowIndex, cell: cellIndex })}
                        >
                          <AutoText
                            className={styles.cellText}
                            readOnly={readOnly}
                            value={toLines(text)}
                            onChange={(next) =>
                              edit([...path, part, rowIndex, "cells", cellIndex, "value"], fromLines(next, text))
                            }
                          />
                        </Cell>
                      );
                    })}
                  </tr>
                ))}
              </Section>
            );
          })}
        </table>
      </div>
    </div>
  );
}, sameNode);
