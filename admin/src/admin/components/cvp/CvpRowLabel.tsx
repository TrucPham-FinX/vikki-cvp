"use client";

import { useRowLabel } from "@payloadcms/ui";
import React from "react";

import type { TranslationKey, Translator } from "@/admin/i18n/dictionary";
import { useT } from "@/admin/i18n/useT";
import styles from "./CvpRowLabel.module.css";

/** The blocks' names, by slug (src/cvp/blocks.ts; a client component cannot import the configs). */
export const BLOCK_NAMES: Record<string, TranslationKey> = {
  topMenu: "block.topMenu",
  video: "block.video",
  imageSection: "block.imageSection",
  slider: "block.slider",
  qa: "block.qa",
  activation: "block.activation",
  flex: "block.flex",
  title: "block.title",
  tooltip: "block.tooltip",
};

type Row = Record<string, unknown>;

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const shorten = (value: string, max = 80) => (value.length > max ? `${value.slice(0, max)}…` : value);

/** What the row is about: its title, text, name or picture, and how many items it has. */
function summary(row: Row, t: Translator): string {
  const title = row.title as unknown;
  const first =
    text(title) ??
    text((title as Row | undefined)?.src) ??
    text(row.text) ??
    text(row.name) ??
    text(row.src) ??
    text(row.srcTitle) ??
    text(row.textTooltip) ??
    text(row.htmlId);
  const count = (key: string, unit: TranslationKey) =>
    Array.isArray(row[key]) ? t(unit, { n: (row[key] as unknown[]).length }) : undefined;
  const size = count("items", "row.items") ?? count("partners", "row.partners") ?? count("children", "row.questions");
  return [first && shorten(first.replace(/<[^>]+>/g, "")), size].filter(Boolean).join(" · ");
}

/**
 * The header of a block (`admin.components.Label`) or an array row (`admin.components.RowLabel`)
 * in Payload's edit form: its number, the block's kind and a summary, instead of "Untitled".
 */
export function CvpRowLabel() {
  const t = useT();
  const { data, rowNumber = 0 } = useRowLabel<Row>();
  const row = data ?? {};
  const kind = typeof row.blockType === "string" ? row.blockType : null;
  const block = kind ? (BLOCK_NAMES[kind] ? t(BLOCK_NAMES[kind]) : kind) : null;
  const about = summary(row, t);

  return (
    <span className={styles.label}>
      <span className={styles.number}>{String(rowNumber + 1).padStart(2, "0")}</span>
      {block ? <strong className={styles.kind}>{block}</strong> : null}
      <span className={styles.summary}>{about || (block ? "" : t("row.empty"))}</span>
    </span>
  );
}
