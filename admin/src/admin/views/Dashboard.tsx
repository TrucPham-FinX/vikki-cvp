import { Gutter } from "@payloadcms/ui";
import type { AdminViewServerProps, Payload, TypedUser, Where } from "payload";
import React from "react";

import {
  DashboardClient,
  type RecentItem,
  type TileData,
} from "@/admin/components/cvp/DashboardClient";
import { translator } from "@/admin/i18n/dictionary";
import type { CatalogSlug, PublishStatus } from "@/contracts/cvp";
import { timingWhere } from "@/cvp/catalog";
import { LOCALE_TOKEN } from "@/cvp/repo-data";
import { pendingAssets, pendingChanges } from "@/cvp/publish";
import { requireUser } from "./requireUser";

/**
 * The admin's home (`admin.components.views.dashboard`): what the admin holds, what a publish
 * would write, and the button that does it.
 *
 * Server side: the counts, the latest edits and the pending files, each read on its own so one
 * failing read leaves the rest of the screen standing (a failed status is shown in its panel).
 */

const RECENT = 8;

const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

async function recentItems(payload: Payload, user: TypedUser): Promise<RecentItem[]> {
  const read = async (
    slug: CatalogSlug,
    toItem: (doc: Record<string, unknown>) => Omit<RecentItem, "id" | "kind" | "updatedAt">,
  ) => {
    const { docs } = await payload.find({
      collection: slug,
      depth: 0,
      limit: RECENT,
      overrideAccess: false,
      sort: "-updatedAt",
      user,
    });
    return docs.map((doc) => {
      const row = doc as unknown as Record<string, unknown>;
      return {
        ...toItem(row),
        id: String(row.id),
        kind: slug,
        updatedAt: String(row.updatedAt ?? ""),
      };
    });
  };

  const lists = await Promise.all([
    read("cvp-pages", (doc) => ({ label: String(doc.key ?? ""), sub: null })),
    read("cvp-documents", (doc) => ({ label: String(doc.key ?? ""), sub: null })),
    read("promotions", (doc) => ({ label: String(doc.name ?? ""), sub: String(doc.promoId ?? "") })),
    read("card-intros", (doc) => ({ label: String(doc.name ?? ""), sub: String(doc.cardId ?? "") })),
  ]);
  return lists
    .flat()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT);
}

export async function Dashboard({ initPageResult }: AdminViewServerProps) {
  const { req } = initPageResult;
  const user = requireUser(req);
  const { payload } = req;
  const t = translator(req.i18n?.language);

  const count = (collection: CatalogSlug, where?: Where) =>
    payload.count({ collection, overrideAccess: false, user, where }).then((r) => r.totalDocs);

  const [pages, localizedPages, documents, promotions, running, cardIntros, recent, status] =
    await Promise.allSettled([
      count("cvp-pages"),
      count("cvp-pages", { file: { contains: LOCALE_TOKEN } }),
      count("cvp-documents"),
      count("promotions"),
      count("promotions", timingWhere("running", new Date().toISOString())),
      count("card-intros"),
      recentItems(payload, user),
      Promise.all([pendingChanges(payload), pendingAssets(payload)]).then(
        ([report, assets]): PublishStatus => ({ written: report.written, stale: report.stale, assets }),
      ),
    ]);

  const value = (result: PromiseSettledResult<number>) =>
    result.status === "fulfilled" ? String(result.value) : "—";
  const n = (result: PromiseSettledResult<number>) =>
    result.status === "fulfilled" ? result.value : 0;

  const tiles: TileData[] = [
    {
      label: t("dash.tile.pages"),
      value: value(pages),
      note: t("dash.tile.pagesNote", { n: n(localizedPages) }),
      href: "/admin/collections/cvp-pages",
    },
    {
      label: t("dash.tile.documents"),
      value: value(documents),
      note: t("dash.tile.documentsNote"),
      href: "/admin/collections/cvp-documents",
    },
    {
      label: t("dash.tile.promotions"),
      value: value(promotions),
      note: t("dash.tile.promotionsNote", { n: n(running) }),
      href: "/admin/collections/promotions",
    },
    {
      label: t("dash.tile.cardIntros"),
      value: value(cardIntros),
      note: t("dash.tile.cardIntrosNote"),
      href: "/admin/collections/card-intros",
    },
  ];

  if (status.status === "rejected") {
    payload.logger.error({ err: status.reason }, "[cvp] dashboard: reading the pending changes failed");
  }

  return (
    <Gutter>
      <DashboardClient
        initialStatus={status.status === "fulfilled" ? status.value : null}
        recent={recent.status === "fulfilled" ? recent.value : []}
        recentFailed={recent.status === "rejected" ? errorText(recent.reason) : null}
        statusFailed={status.status === "rejected" ? errorText(status.reason) : null}
        tiles={tiles}
      />
    </Gutter>
  );
}
