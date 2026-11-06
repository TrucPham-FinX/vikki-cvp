"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import type { TranslationKey } from "@/admin/i18n/dictionary";
import { useT } from "@/admin/i18n/useT";
import { hasActiveContent, isEditableHtml } from "@/cvp/html";

import styles from "./fields.module.css";

/**
 * A field the pages print as HTML (a Q&A answer, a promotion's content), written like a document:
 * bold, italic, lists and links from a toolbar, instead of tags typed into a textarea. "HTML"
 * shows the markup itself, for whoever needs it.
 *
 * It still stores the HTML string the data file has, and only rewrites it when the editor types:
 * an answer opened and left alone is saved exactly as it was. Markup that could run in the admin
 * (a script, an `on…` attribute: cvp/html.ts) is never put in the page; such a value opens as HTML.
 */

type Command = {
  command: string;
  label: TranslationKey;
  glyph: string;
};

const COMMANDS: Command[] = [
  { command: "bold", label: "html.bold", glyph: "B" },
  { command: "italic", label: "html.italic", glyph: "I" },
  { command: "underline", label: "html.underline", glyph: "U" },
  { command: "insertUnorderedList", label: "html.bullets", glyph: "•" },
  { command: "insertOrderedList", label: "html.numbers", glyph: "1." },
];

/**
 * What the editor holds, as the pages should get it; '' when it only holds the empty line the
 * browser leaves behind. Read from a copy, so the caret stays where the editor is typing.
 *
 * A list started in a paragraph is put in the paragraph by the browser (`<p><ul>…</ul></p>`), which
 * no page can hold: the lists are moved out after it, and a paragraph left empty goes.
 */
function htmlOf(editor: HTMLElement): string {
  if (!editor.textContent?.trim() && !editor.querySelector("img, video, li")) return "";
  const copy = editor.cloneNode(true) as HTMLElement;
  for (const paragraph of Array.from(copy.querySelectorAll("p"))) {
    const lists = Array.from(paragraph.children).filter((child) => child.localName === "ul" || child.localName === "ol");
    if (!lists.length) continue;
    let after: Element = paragraph;
    for (const list of lists) {
      after.after(list);
      after = list;
    }
    if (!paragraph.textContent?.trim() && !paragraph.querySelector("img, video")) paragraph.remove();
  }
  return copy.innerHTML;
}

/**
 * Puts `html` in the editor, built from an inert parse rather than assigned as markup; false, and
 * nothing put, when the parsed tree holds anything active.
 */
function render(editor: HTMLElement, html: string): boolean {
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  if (hasActiveContent(parsed.body)) return false;
  editor.replaceChildren(...Array.from(parsed.body.childNodes, (node) => document.importNode(node, true)));
  return true;
}

const isWebAddress = (href: string) => /^https?:\/\//i.test(href);

// The toolbar's two icons, in the text's colour
const LinkIcon = () => (
  <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" viewBox="0 0 16 16" width="14">
    <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.1-2.1a3 3 0 0 0-4.2-4.2l-.7.7" />
    <path d="M9.5 6.5a3 3 0 0 0-4.2 0L3.2 8.6a3 3 0 0 0 4.2 4.2l.7-.7" />
  </svg>
);

const ClearIcon = () => (
  <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" viewBox="0 0 16 16" width="14">
    <path d="M3 3.5h8M7 3.5 5 12.5" />
    <path d="m10 9.5 3 3M13 9.5l-3 3" />
  </svg>
);

export type HtmlEditorProps = {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  readOnly?: boolean;
  /** The editable area's name for a screen reader */
  label?: string;
  /** Fewer lines, for a cell or a list row of the structured editor */
  compact?: boolean;
};

/** The editor itself: toolbar, editable area, HTML source (HtmlField, and JsonFormField's text) */
export function HtmlEditor({ value, onChange: setValue, readOnly, label, compact }: HtmlEditorProps) {
  const t = useT();
  const html = typeof value === "string" ? value : "";

  // Refused by the parsed tree's check, though the text's passed (cvp/html.ts): until it changes
  const [blocked, setBlocked] = useState<string | null>(null);
  const editable = isEditableHtml(html) && blocked !== html;
  const [source, setSource] = useState(!editable);
  const editor = useRef<HTMLDivElement>(null);
  // The HTML the editor shows, so a value it wrote itself is not put back (losing the caret)
  const shown = useRef<string | null>(null);
  const [linking, setLinking] = useState<{ range: Range; href: string } | null>(null);

  // Markup that cannot be shown safely (typed in HTML, or a locale switched to) goes back to HTML
  useEffect(() => {
    if (!editable) setSource(true);
  }, [editable]);

  useEffect(() => {
    const node = editor.current;
    if (source || !node || shown.current === html) return;
    if (!render(node, html)) {
      setBlocked(html);
      setSource(true);
      return;
    }
    shown.current = html;
  }, [html, source]);

  const emit = useCallback(() => {
    const node = editor.current;
    if (!node) return;
    const next = htmlOf(node);
    shown.current = next;
    setValue(next || null);
  }, [setValue]);

  const run = (command: string, argument?: string) => {
    editor.current?.focus();
    document.execCommand(command, false, argument);
    emit();
  };

  const startLink = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editor.current?.contains(selection.anchorNode)) return;
    const range = selection.getRangeAt(0).cloneRange();
    const anchor = (selection.anchorNode instanceof Element
      ? selection.anchorNode
      : selection.anchorNode?.parentElement
    )?.closest("a");
    setLinking({ range, href: anchor?.getAttribute("href") ?? "https://" });
  };

  const applyLink = () => {
    if (!linking) return;
    const href = linking.href.trim();
    const selection = window.getSelection();
    editor.current?.focus();
    selection?.removeAllRanges();
    selection?.addRange(linking.range);
    if (!href || href === "https://") {
      document.execCommand("unlink");
    } else {
      document.execCommand("createLink", false, href);
      // As the pages' links to other sites are written: a new tab
      for (const anchor of editor.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? []) {
        if (anchor.getAttribute("href") === href && isWebAddress(href) && !anchor.hasAttribute("target")) {
          anchor.setAttribute("target", "_blank");
          anchor.setAttribute("rel", "noopener noreferrer");
        }
      }
    }
    setLinking(null);
    emit();
  };

  const toVisual = () => {
    if (!editable) return;
    shown.current = null;
    setSource(false);
  };

  return (
    <>
      <div className={`${styles.html} ${compact ? styles.htmlCompact : ""}`}>
        <div className={styles.htmlBar} role="toolbar">
          {source ? null : (
            <>
              {COMMANDS.map(({ command, label, glyph }) => (
                <button
                  key={command}
                  aria-label={t(label)}
                  className={`${styles.tool} ${styles[`tool_${command}`] ?? ""}`}
                  disabled={readOnly}
                  title={t(label)}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    run(command);
                  }}
                >
                  {glyph}
                </button>
              ))}
              <button
                aria-label={t("html.link")}
                className={styles.tool}
                disabled={readOnly}
                title={t("html.link")}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  startLink();
                }}
              >
                <LinkIcon />
              </button>
              <button
                aria-label={t("html.clear")}
                className={styles.tool}
                disabled={readOnly}
                title={t("html.clear")}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  run("removeFormat");
                  run("unlink");
                }}
              >
                <ClearIcon />
              </button>
            </>
          )}
          <span className={styles.htmlSpacer} />
          <button
            aria-pressed={source}
            className={`${styles.tool} ${source ? styles.toolOn : ""}`}
            disabled={source && !editable}
            title={source && !editable ? t("html.unsafe") : t("html.source")}
            type="button"
            onClick={() => (source ? toVisual() : setSource(true))}
          >
            {t("html.source")}
          </button>
        </div>

        {linking ? (
          <div className={styles.linkBar}>
            <input
              autoFocus
              aria-label={t("html.linkUrl")}
              className={styles.rawInput}
              placeholder="https://"
              type="text"
              value={linking.href}
              onChange={(event) => setLinking({ ...linking, href: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }
                if (event.key === "Escape") setLinking(null);
              }}
            />
            <button className={`${styles.button} ${styles.primary}`} type="button" onClick={applyLink}>
              {t("html.apply")}
            </button>
            <button className={styles.button} type="button" onClick={() => setLinking(null)}>
              {t("common.cancel")}
            </button>
          </div>
        ) : null}

        {source ? (
          <textarea
            className={styles.htmlSource}
            readOnly={readOnly}
            rows={compact ? 4 : 8}
            value={html}
            onChange={(event) => setValue(event.target.value || null)}
          />
        ) : (
          <div
            ref={editor}
            aria-label={label}
            aria-multiline
            className={styles.htmlEditor}
            contentEditable={!readOnly}
            data-placeholder={t("html.placeholder")}
            role="textbox"
            suppressContentEditableWarning
            onFocus={() => document.execCommand("defaultParagraphSeparator", false, "p")}
            onInput={emit}
            onPaste={(event) => {
              // Text only: formatting pasted from Word or a website is not the pages' markup
              event.preventDefault();
              document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
            }}
          />
        )}
      </div>
      {source && !editable ? <div className={styles.note}>{t("html.unsafe")}</div> : null}
    </>
  );
}
