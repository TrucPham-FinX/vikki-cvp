"use client";

import React from "react";

import * as D from "@/admin/design/design";
import type { ListColumn } from "@/admin/components/ui/ListDataTable";
import type { Translator } from "@/admin/i18n/dictionary";
import { fmtDate, fmtDateTime } from "@/admin/lib/datetime";
import type {
  CardIntroRow,
  CatalogRow,
  CatalogSlug,
  DocumentRow,
  PageRow,
  PromotionRow,
  PromotionTiming,
} from "@/contracts/cvp";
import styles from "./Catalog.module.css";

/**
 * The columns of each CVP list. `sortField` is the Payload field the server orders by, and must
 * be one of `SORTABLE[slug]` in `cvp/catalogQuery.ts` — anything else is ignored there.
 */

/**
 * A timing as one of the status words `D.statusToBadgeTone` knows, so its colour comes from the
 * portal's one status scale rather than a map of this screen's: running is live, upcoming is
 * queued, ended is closed. No date at all asks nothing of anyone, so it stays neutral.
 */
const TIMING_STATUS: Record<PromotionTiming, string> = {
  running: "LIVE",
  upcoming: "QUEUED",
  ended: "CLOSED",
  undated: "",
};

/** Folder over file: where the item's JSON lives in front-end/data. */
function KeyCell({ file, page }: { file: string; page: string }) {
  return (
    <span className={styles.keyCell}>
      <span className={styles.keyPage} title={page}>
        {page}
      </span>
      <span className={styles.keyFile} title={file}>
        {file}
      </span>
    </span>
  );
}

function Languages({ current, languages }: { current: string; languages: string[] }) {
  return (
    <span className={styles.badges}>
      {languages.map((code) => (
        <D.Badge key={code} tone={code === current ? "info" : "neutral"}>
          {code.toUpperCase()}
        </D.Badge>
      ))}
    </span>
  );
}

const updated = <T extends { updatedAt: string }>(t: Translator): ListColumn<T> => ({
  id: "updatedAt",
  header: t("catalog.col.updated"),
  cell: (row) => fmtDateTime(row.updatedAt),
  muted: true,
  nowrap: true,
  sortable: true,
  width: 150,
});

const order = <T extends { sortOrder: number | null }>(t: Translator): ListColumn<T> => ({
  id: "sortOrder",
  header: t("catalog.col.order"),
  cell: (row) => (row.sortOrder === null ? "—" : row.sortOrder),
  align: "right",
  muted: true,
  sortable: true,
  width: 110,
});

const title = <T extends { title: string | null }>(t: Translator): ListColumn<T> => ({
  id: "title",
  header: t("catalog.col.title"),
  cell: (row) => row.title ?? <span className={styles.muted}>{t("catalog.untitled")}</span>,
  maxWidth: 420,
  sortable: true,
});

function pageColumns(t: Translator, locale: string): ListColumn<PageRow>[] {
  return [
    {
      id: "key",
      header: t("catalog.col.key"),
      cell: (row) => <KeyCell file={row.file} page={row.page} />,
      sortable: true,
      width: 260,
    },
    title(t),
    {
      id: "layout",
      header: t("catalog.col.layout"),
      cell: (row) => (row.layout ? <D.Badge>{row.layout}</D.Badge> : "—"),
      width: 150,
    },
    {
      id: "languages",
      header: t("catalog.col.languages"),
      cell: (row) => <Languages current={locale} languages={row.languages} />,
      width: 140,
    },
    {
      id: "blocks",
      header: t("catalog.col.blocks"),
      cell: (row) => row.blocks,
      align: "right",
      muted: true,
      width: 80,
    },
    updated(t),
  ];
}

function documentColumns(t: Translator, locale: string): ListColumn<DocumentRow>[] {
  return [
    {
      id: "key",
      header: t("catalog.col.key"),
      cell: (row) => <KeyCell file={row.file} page={row.page} />,
      sortable: true,
      width: 260,
    },
    title(t),
    {
      id: "layout",
      header: t("catalog.col.layout"),
      cell: (row) => (row.layout ? <D.Badge>{row.layout}</D.Badge> : "—"),
      sortable: true,
      width: 150,
    },
    {
      id: "languages",
      header: t("catalog.col.languages"),
      cell: (row) => <Languages current={locale} languages={row.languages} />,
      width: 140,
    },
    updated(t),
  ];
}

function promotionColumns(t: Translator): ListColumn<PromotionRow>[] {
  return [
    {
      id: "promoId",
      header: t("catalog.col.code"),
      cell: (row) => row.code,
      mono: true,
      nowrap: true,
      sortable: true,
      width: 130,
    },
    {
      id: "name",
      header: t("catalog.col.name"),
      cell: (row) => (
        <span className={styles.nameCell}>
          <span className={styles.clip} title={row.name}>
            {row.name}
          </span>
          {row.hot ? <D.Badge tone="info">{t("catalog.filter.hot")}</D.Badge> : null}
        </span>
      ),
      maxWidth: 280,
      sortable: true,
    },
    {
      id: "category",
      header: t("catalog.col.category"),
      cell: (row) => row.category ?? "—",
      maxWidth: 160,
      muted: true,
    },
    {
      id: "startDate",
      header: t("catalog.col.period"),
      cell: (row) =>
        row.startDate || row.endDate ? `${fmtDate(row.startDate)} – ${fmtDate(row.endDate)}` : "—",
      nowrap: true,
      sortable: true,
      width: 190,
    },
    {
      id: "timing",
      header: t("catalog.col.status"),
      cell: (row) => (
        <D.StatusBadge
          dot
          label={t(`catalog.timing.${row.timing}`)}
          status={TIMING_STATUS[row.timing]}
        />
      ),
      width: 130,
    },
    order(t),
    updated(t),
  ];
}

function cardIntroColumns(t: Translator): ListColumn<CardIntroRow>[] {
  return [
    {
      id: "cardId",
      header: t("catalog.col.code"),
      cell: (row) => row.code,
      mono: true,
      nowrap: true,
      sortable: true,
      width: 180,
    },
    {
      id: "name",
      header: t("catalog.col.name"),
      cell: (row) => row.name,
      maxWidth: 420,
      sortable: true,
    },
    {
      id: "cardGroup",
      header: t("catalog.col.group"),
      cell: (row) => row.group ?? "—",
      muted: true,
      sortable: true,
      width: 160,
    },
    order(t),
    updated(t),
  ];
}

/**
 * One list's columns. The rows of a list are all of its own kind (the server maps them per
 * collection), so each set is typed by its row and widened once here.
 */
export function catalogColumns(
  slug: CatalogSlug,
  t: Translator,
  locale: string,
): ListColumn<CatalogRow>[] {
  switch (slug) {
    case "cvp-pages":
      return pageColumns(t, locale) as ListColumn<CatalogRow>[];
    case "cvp-documents":
      return documentColumns(t, locale) as ListColumn<CatalogRow>[];
    case "promotions":
      return promotionColumns(t) as ListColumn<CatalogRow>[];
    case "card-intros":
      return cardIntroColumns(t) as ListColumn<CatalogRow>[];
  }
}
