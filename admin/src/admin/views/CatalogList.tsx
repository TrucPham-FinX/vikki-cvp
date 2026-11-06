import { Gutter } from "@payloadcms/ui";
import type { ListViewServerProps } from "payload";
import React from "react";

import { CatalogListClient } from "@/admin/components/cvp/CatalogListClient";
import { isCatalogSlug } from "@/contracts/cvp";
import { PAGE_LAYOUTS } from "@/collections/CvpPages";
import { searchCatalog } from "@/cvp/catalog";
import { parseCatalogQuery } from "@/cvp/catalogQuery";
import { DEFAULT_LOCALE, isLocale } from "@/cvp/locales";
import { DOCUMENT_LAYOUTS } from "@/cvp/repo-data";
import { requireUser } from "./requireUser";

/**
 * The list screen of the four CVP collections (`admin.components.views.list` on each): the
 * list-detail pattern's list, in place of Payload's generated table.
 *
 * Server side: who is asking, what the URL says, one page of rows. Payload has already run its
 * own query for the default view by the time this renders; that result is not used, because the
 * filters here (language, layout, timing) are not Payload's list params.
 *
 * Rows open Payload's own edit form (`/admin/collections/<slug>/<id>`): a page's blocks and a
 * document's sections are what that form is good at, so editing stays a route there.
 */
export async function CatalogList(props: ListViewServerProps) {
  const { collectionConfig, hasCreatePermission, locale, payload, searchParams, user } = props;
  const signedIn = requireUser({ user });
  const slug = collectionConfig.slug;
  if (!isCatalogSlug(slug)) throw new Error(`CatalogList has no list for "${slug}"`);

  const query = parseCatalogQuery(slug, searchParams);
  const code = locale?.code;
  const contentLocale = isLocale(code) ? code : DEFAULT_LOCALE;
  const result = await searchCatalog({
    locale: contentLocale,
    payload,
    query,
    slug,
    user: signedIn,
  });

  const layouts =
    slug === "cvp-pages" ? PAGE_LAYOUTS : slug === "cvp-documents" ? DOCUMENT_LAYOUTS : [];

  return (
    <Gutter>
      <CatalogListClient
        canCreate={Boolean(hasCreatePermission)}
        contentLocale={contentLocale}
        layouts={[...layouts]}
        query={query}
        result={result}
        slug={slug}
      />
    </Gutter>
  );
}
