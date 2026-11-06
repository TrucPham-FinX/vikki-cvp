"use client";

import { Link } from "@payloadcms/ui";
import React, { useState } from "react";

import { errorMessage } from "@/admin/apiError";
import { useToasts } from "@/admin/components/ui/Toasts";
import * as D from "@/admin/design/design";
import type { TranslationKey } from "@/admin/i18n/dictionary";
import { useT } from "@/admin/i18n/useT";
import { fmtDateTime } from "@/admin/lib/datetime";
import { api } from "@/contracts/api";
import type { CatalogSlug, PublishReport, PublishStatus, RunResult } from "@/contracts/cvp";
import styles from "./Catalog.module.css";

export type TileData = { href: string; label: string; note: string; value: string };

export type RecentItem = {
  id: string;
  kind: CatalogSlug;
  label: string;
  sub: string | null;
  updatedAt: string;
};

/** How many pending files the panel lists before "… and n more". */
const PENDING_SHOWN = 20;

const KIND_LABEL: Record<CatalogSlug, TranslationKey> = {
  "cvp-pages": "nav.pages",
  "cvp-documents": "nav.documents",
  promotions: "nav.promotions",
  "card-intros": "nav.cardIntros",
};

type Step = "data" | "validate" | "build" | "manifest";

/** The step a failed publish stopped at, and its output. */
function failedStep(report: PublishReport): { run: RunResult; step: Step } | null {
  if (report.ok) return null;
  if (!report.validate.ok) return { run: report.validate, step: "validate" };
  if (report.build && !report.build.ok) return { run: report.build, step: "build" };
  if (report.manifest && !report.manifest.ok) return { run: report.manifest, step: "manifest" };
  return null;
}

const stateOf = (run: RunResult | null): D.TrackState =>
  run === null ? "pending" : run.ok ? "done" : "error";

/** `<page>/<file>` as its two columns; a file at the data root has no page. */
const splitPath = (path: string) => {
  const at = path.lastIndexOf("/");
  return at < 0 ? { file: path, page: "" } : { file: path.slice(at + 1), page: path.slice(0, at) };
};

/**
 * The publish screen: counts, the files a publish would write, the last run's result, and the
 * latest edits.
 *
 * "Xuất & build" is the screen's own affirmative verb — it writes forward, into the repo's working
 * tree, and a commit is still needed to reach the CDN — so it is the one primary button. "Kiểm tra
 * lại" only reads, so it is neutral.
 *
 * A run that validates or builds badly is a RESULT, not an error: the Track and the log say which
 * step stopped and why, on the screen the editor is looking at. Only a call that could not run at
 * all is a toast.
 */
export function DashboardClient({
  initialStatus,
  recent,
  recentFailed,
  statusFailed: initialStatusFailed,
  tiles,
}: {
  initialStatus: PublishStatus | null;
  recent: RecentItem[];
  recentFailed: string | null;
  statusFailed: string | null;
  tiles: TileData[];
}) {
  const t = useT();
  const toasts = useToasts();
  const [status, setStatus] = useState(initialStatus);
  const [statusFailed, setStatusFailed] = useState(initialStatusFailed);
  const [checking, setChecking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [report, setReport] = useState<PublishReport | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);

  const busy = checking || publishing;

  const refresh = async () => {
    setChecking(true);
    try {
      setStatus(await api.cvp.status());
      setStatusFailed(null);
    } catch (err) {
      setStatusFailed(errorMessage(err) || t("dash.statusFailed"));
    } finally {
      setChecking(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const result = await api.cvp.publish();
      setReport(result);
      setRanAt(new Date().toISOString());
      await refresh();
    } catch (err) {
      toasts.show({ detail: errorMessage(err), message: t("dash.publishFailed"), tone: "danger" });
    } finally {
      setPublishing(false);
    }
  };

  const failed = report ? failedStep(report) : null;
  const stepName = (step: Step) => t(`dash.run.step.${step}`);
  const written = status?.written ?? [];

  return (
    <D.Scope>
      <D.Screen>
        <D.Head
          actions={
            <>
              <D.Btn disabled={busy} onClick={() => void refresh()}>
                {t("dash.refresh")}
              </D.Btn>
              <D.Btn disabled={busy} variant="primary" onClick={() => void publish()}>
                {publishing ? t("dash.publishing") : t("dash.publish")}
              </D.Btn>
            </>
          }
          subtitle={t("dash.subtitle")}
          title={t("dash.title")}
        />

        <D.Tiles>
          {tiles.map((tile) => (
            <Link className={styles.tileLink} href={tile.href} key={tile.href} prefetch={false}>
              <D.Tile label={tile.label} note={tile.note} value={tile.value} />
            </Link>
          ))}
        </D.Tiles>

        {report ? (
          <D.Panel note={ranAt ? fmtDateTime(ranAt) : undefined} title={t("dash.run.title")}>
            <div className={styles.runSummary}>
              <D.Track
                steps={[
                  {
                    label: stepName("data"),
                    note: t("dash.run.dataNote", { n: report.data.written.length }),
                    state: "done",
                  },
                  { label: stepName("validate"), state: stateOf(report.validate) },
                  { label: stepName("build"), state: stateOf(report.build) },
                  { label: stepName("manifest"), state: stateOf(report.manifest) },
                ]}
              />
              {report.ok ? (
                <D.Gate detail={t("dash.run.okBody")} label={t("dash.run.ok")} state="pass" />
              ) : (
                <D.Gate
                  detail={t("dash.run.failedBody")}
                  label={t("dash.run.failed", { step: failed ? stepName(failed.step) : "?" })}
                  state="fail"
                />
              )}
              {report.templatesCreated.length > 0 ? (
                <D.Gate
                  label={t("dash.run.templates", { list: report.templatesCreated.join(", ") })}
                  state="warn"
                />
              ) : null}
              {report.assets?.written.length ? (
                <D.Gate label={t("dash.run.assets", { n: report.assets.written.length })} state="pass" />
              ) : null}
              {report.assets?.missing.length ? (
                <D.Gate
                  label={t("dash.run.assetsMissing", { list: report.assets.missing.join(", ") })}
                  state="warn"
                />
              ) : null}
            </div>
            {failed ? (
              <pre aria-label={t("dash.run.log", { step: stepName(failed.step) })} className={styles.log}>
                {failed.run.output.trim()}
              </pre>
            ) : null}
          </D.Panel>
        ) : null}

        <D.Panel
          note={status ? t("dash.pending.note", { n: written.length }) : undefined}
          title={t("dash.pending.title")}
        >
          {statusFailed ? (
            <div className={styles.runSummary}>
              <D.Gate detail={statusFailed} label={t("dash.statusFailed")} state="fail" />
            </div>
          ) : written.length === 0 ? (
            <D.Empty body={t("dash.pending.cleanBody")} title={t("dash.pending.cleanTitle")} />
          ) : (
            <D.Table
              head={
                <>
                  <th>{t("dash.pending.colPage")}</th>
                  <th>{t("dash.pending.colFile")}</th>
                </>
              }
            >
              {written.slice(0, PENDING_SHOWN).map((path) => {
                const { file, page } = splitPath(path);
                return (
                  <tr key={path}>
                    <td className={D.cell.noWrap}>{page || "—"}</td>
                    <td className={D.cell.monoNoWrap}>{file}</td>
                  </tr>
                );
              })}
              {written.length > PENDING_SHOWN ? (
                <tr>
                  <td className={D.cell.muted} colSpan={2}>
                    {t("dash.pending.more", { n: written.length - PENDING_SHOWN })}
                  </td>
                </tr>
              ) : null}
            </D.Table>
          )}
        </D.Panel>

        {status && status.assets?.length ? (
          <D.Panel note={t("dash.assets.note", { n: status.assets.length })} title={t("dash.assets.title")}>
            <D.Table head={<th>{t("dash.pending.colFile")}</th>}>
              {status.assets.slice(0, PENDING_SHOWN).map((path) => (
                <tr key={path}>
                  <td className={D.cell.monoNoWrap}>{path}</td>
                </tr>
              ))}
              {status.assets.length > PENDING_SHOWN ? (
                <tr>
                  <td className={D.cell.muted}>
                    {t("dash.pending.more", { n: status.assets.length - PENDING_SHOWN })}
                  </td>
                </tr>
              ) : null}
            </D.Table>
          </D.Panel>
        ) : null}

        {status && status.stale.length > 0 ? (
          <D.Panel note={t("dash.stale.note")} title={t("dash.stale.title")}>
            <D.Table head={<th>{t("dash.pending.colFile")}</th>}>
              {status.stale.map((path) => (
                <tr key={path}>
                  <td className={D.cell.monoNoWrap}>{path}</td>
                </tr>
              ))}
            </D.Table>
          </D.Panel>
        ) : null}

        <D.Panel title={t("dash.recent.title")}>
          {recentFailed ? (
            <div className={styles.runSummary}>
              <D.Gate detail={recentFailed} label={t("state.loadFailedTitle")} state="fail" />
            </div>
          ) : recent.length === 0 ? (
            <D.Empty body={t("dash.recent.emptyBody")} title={t("dash.recent.emptyTitle")} />
          ) : (
            <D.Table
              head={
                <>
                  <th>{t("dash.recent.colItem")}</th>
                  <th>{t("dash.recent.colKind")}</th>
                  <th>{t("dash.recent.colUpdated")}</th>
                </>
              }
            >
              {recent.map((item) => (
                <tr key={`${item.kind}:${item.id}`}>
                  <td>
                    <Link
                      className={styles.link}
                      href={`/admin/collections/${item.kind}/${item.id}`}
                      prefetch={false}
                    >
                      <span className={styles.keyCell}>
                        <span className={styles.keyPage}>{item.label}</span>
                        {item.sub ? <span className={styles.keyFile}>{item.sub}</span> : null}
                      </span>
                    </Link>
                  </td>
                  <td className={D.cell.noWrap}>{t(KIND_LABEL[item.kind])}</td>
                  <td className={D.cell.monoMutedNoWrap}>{fmtDateTime(item.updatedAt)}</td>
                </tr>
              ))}
            </D.Table>
          )}
        </D.Panel>
      </D.Screen>
    </D.Scope>
  );
}
