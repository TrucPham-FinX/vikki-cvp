"use client";

import { useStepNav } from "@payloadcms/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { FilterChip, FilterSelect } from "@/admin/components/filters";
import { ListDataTable, type ListSort } from "@/admin/components/ui/ListDataTable";
import * as D from "@/admin/design/design";
import { useT } from "@/admin/i18n/useT";
import type { CatalogQuery, CatalogResult, CatalogRow, CatalogSlug } from "@/contracts/cvp";
import {
  DEFAULT_SORT,
  FILTERS,
  PAGE_SIZES,
  TIMING_FILTERS,
  catalogSearch,
  isFiltered,
} from "@/cvp/catalogQuery";
import { LOCALE_LABELS, LOCALES } from "@/cvp/locales";
import styles from "./Catalog.module.css";
import { catalogColumns } from "./catalogColumns";

/** Where a list's items are written on publish — the panel's provenance line. */
const SOURCE: Record<CatalogSlug, string> = {
  "cvp-pages": "front-end/data/<page>/*.json",
  "cvp-documents": "front-end/data/<page>/*.json",
  promotions: "front-end/data/promotion/list.json",
  "card-intros": "front-end/data/card-intro/list.json",
};

const toListSort = (sort: string): ListSort =>
  sort.startsWith("-")
    ? { direction: "desc", field: sort.slice(1) }
    : { direction: "asc", field: sort };

/**
 * A CVP list: search and filters in the toolbar, the table, the pager.
 *
 * The URL is the state (frontend standards §6): every control writes the search params and the
 * server view re-reads them, inside a transition so the table stays on screen while the next page
 * loads. Payload's `?locale=` rides along untouched, so the content language the editor picked in
 * the header holds across searches and into the edit form.
 */
export function CatalogListClient({
  canCreate,
  contentLocale,
  layouts,
  query,
  result,
  slug,
}: {
  canCreate: boolean;
  contentLocale: string;
  layouts: string[];
  query: CatalogQuery;
  result: CatalogResult;
  slug: CatalogSlug;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q);
  const { setStepNav } = useStepNav();

  const title = t(`catalog.${slug}.title`);
  const localeParam = searchParams.get("locale");

  // The header's breadcrumb, as Payload's own list view sets it
  useEffect(() => setStepNav([{ label: title }]), [setStepNav, title]);
  // A back/forward navigation changes the URL under the box
  useEffect(() => setSearch(query.q), [query.q]);

  const withLocale = useCallback(
    (search: string) => {
      if (!localeParam) return search;
      const params = new URLSearchParams(search);
      params.set("locale", localeParam);
      return `?${params.toString()}`;
    },
    [localeParam],
  );

  const go = useCallback(
    (next: Partial<CatalogQuery>) => {
      // Any change but a page step starts again from the first page
      const merged: CatalogQuery = { ...query, page: 1, ...next };
      startTransition(() => router.push(`${pathname}${withLocale(catalogSearch(slug, merged))}`));
    },
    [pathname, query, router, slug, withLocale],
  );

  const setFilter = (name: string, value: string) => {
    const filters = { ...query.filters };
    if (value) filters[name] = value;
    else delete filters[name];
    go({ filters });
  };

  const clear = () => {
    setSearch("");
    go({ filters: {}, q: "" });
  };

  const create = () => router.push(`/admin/collections/${slug}/create${withLocale("")}`);
  const open = (row: CatalogRow) =>
    router.push(`/admin/collections/${slug}/${row.id}${withLocale("")}`);

  const columns = useMemo(() => catalogColumns(slug, t, contentLocale), [slug, t, contentLocale]);
  const filtered = isFiltered(query);
  const offers = FILTERS[slug];
  const from = result.total === 0 ? 0 : (result.page - 1) * result.limit + 1;
  const to = Math.min(result.page * result.limit, result.total);

  const createButton = canCreate ? (
    <D.Btn icon={<D.PlusIcon />} variant="primary" onClick={create}>
      {t("catalog.create")}
    </D.Btn>
  ) : null;

  return (
    <D.Scope>
      <D.Screen>
        <D.Head
          actions={createButton}
          subtitle={t(`catalog.${slug}.subtitle`)}
          title={title}
        />

        <D.Toolbar>
          <D.Search
            placeholder={t(`catalog.${slug}.search`)}
            value={search}
            onChange={setSearch}
            onSubmit={() => go({ q: search.trim() })}
          />
          {offers.includes("lang") ? (
            <FilterSelect
              options={[
                { label: t("catalog.filter.langAll"), value: "" },
                ...LOCALES.map((code) => ({ label: LOCALE_LABELS[code], value: code })),
              ]}
              placeholder={t("catalog.col.languages")}
              value={query.filters.lang ?? ""}
              width={170}
              onChange={(value) => setFilter("lang", value)}
            />
          ) : null}
          {offers.includes("layout") ? (
            <FilterSelect
              options={[
                { label: t("catalog.filter.layoutAll"), value: "" },
                ...layouts.map((layout) => ({ label: layout, value: layout })),
              ]}
              placeholder={t("catalog.col.layout")}
              value={query.filters.layout ?? ""}
              width={170}
              onChange={(value) => setFilter("layout", value)}
            />
          ) : null}
          {offers.includes("timing") ? (
            <FilterSelect
              options={[
                { label: t("catalog.filter.timingAll"), value: "" },
                ...TIMING_FILTERS.map((timing) => ({
                  label: t(`catalog.timing.${timing}`),
                  value: timing,
                })),
              ]}
              placeholder={t("catalog.col.status")}
              value={query.filters.timing ?? ""}
              width={170}
              onChange={(value) => setFilter("timing", value)}
            />
          ) : null}
          {offers.includes("hot") ? (
            <FilterChip
              active={query.filters.hot === "1"}
              label={t("catalog.filter.hot")}
              onClick={() => setFilter("hot", query.filters.hot === "1" ? "" : "1")}
            />
          ) : null}
          {filtered ? <D.LinkButton onClick={clear}>{t("catalog.clear")}</D.LinkButton> : null}
          <D.ToolbarSpacer />
          <D.ToolbarCount>{t("catalog.count", { n: result.total })}</D.ToolbarCount>
        </D.Toolbar>

        <ListDataTable<CatalogRow>
          columns={columns}
          emptyAction={
            filtered ? (
              <D.Btn size="sm" onClick={clear}>
                {t("catalog.clear")}
              </D.Btn>
            ) : (
              createButton
            )
          }
          emptyDescription={t(filtered ? "catalog.emptyFilteredBody" : "catalog.emptyBody")}
          emptyTitle={t(filtered ? "catalog.emptyFiltered" : "catalog.emptyTitle")}
          loading={pending}
          pagination={{
            canNext: result.page < result.pages,
            canPrev: result.page > 1,
            nextLabel: t("catalog.next"),
            onNext: () => go({ page: result.page + 1 }),
            onPageSizeChange: (limit) => go({ limit }),
            onPrev: () => go({ page: result.page - 1 }),
            pageLabel: t("catalog.page", { page: result.page, pages: result.pages }),
            pageSize: result.limit,
            pageSizeOptions: [...PAGE_SIZES],
            prevLabel: t("catalog.prev"),
            rangeLabel: t("catalog.range", { from, to, total: result.total }),
          }}
          rowKey={(row) => row.id}
          rows={result.rows}
          sort={toListSort(query.sort)}
          source={
            <span className={styles.source}>{t("catalog.source", { path: SOURCE[slug] })}</span>
          }
          storageKey={`cvp:${slug}`}
          title={title}
          onRowClick={open}
          onSortChange={(sort) =>
            go({
              sort: sort
                ? `${sort.direction === "desc" ? "-" : ""}${sort.field}`
                : DEFAULT_SORT[slug],
            })
          }
        />
      </D.Screen>
    </D.Scope>
  );
}
