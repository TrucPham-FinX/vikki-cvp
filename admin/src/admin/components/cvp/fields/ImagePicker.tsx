"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useT } from "@/admin/i18n/useT";
import { api } from "@/contracts/api";
import type { AssetItem } from "@/contracts/cvp";
import { assetValue, htmlFolder, isVideoFile, resolveAsset } from "@/cvp/assetPaths";

import styles from "./fields.module.css";

/**
 * An image chosen from a page's images or uploaded on the spot instead of typed: the ones
 * published in vikki-cvp/<page>/ and the media library's (collections/CvpMedia.ts). An upload goes
 * into the library for this page, and "Xuất & build" copies it beside the others.
 *
 * `value` is the path the data file has always had, written the way the pages write it
 * (`./assets/a.png`, `../assets/a.png` from a language's copy: cvp/assetPaths.ts), relative to the
 * HTML of `file` in `page`. The path itself stays editable, for an address the library has not got.
 * Used by ImageField (a field of its own) and the structured editor (JsonFormField).
 */

/** A picture or a video, as small as the slot */
function Media({ src, onError }: { src: string; onError?: () => void }) {
  return isVideoFile(src) ? (
    <video muted preload="metadata" src={src} onError={onError} />
  ) : (
    <img alt="" loading="lazy" src={src} onError={onError} />
  );
}

export type ImagePickerProps = {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  /** The page folder whose images are offered, and its data file (where relative paths start) */
  page: string;
  file: string;
  locale: string;
  readOnly?: boolean;
};

export function ImagePicker({ value, onChange: setValue, page, file, locale, readOnly }: ImagePickerProps) {
  const t = useT();
  const current = typeof value === "string" && value.trim() ? value.trim() : "";
  const shown = useMemo(() => {
    if (!current || !page) return null;
    const resolved = resolveAsset(htmlFolder(page, file, locale), current);
    return resolved ? `/vikki-cvp/${resolved}` : null;
  }, [current, page, file, locale]);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [shown]);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AssetItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!page) return;
    setLoadFailed(false);
    try {
      setItems((await api.cvp.assets(page)).items);
    } catch {
      setItems(null);
      setLoadFailed(true);
    }
  }, [page]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const pick = (pathInPage: string) => {
    setValue(assetValue(file, pathInPage));
    setOpen(false);
  };

  const upload = async (chosen: File | undefined) => {
    if (!chosen || !page) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { filename } = await api.media.upload(chosen, { page, folder: "assets" });
      setValue(assetValue(file, `assets/${filename}`));
      setOpen(false);
      setItems(null);
    } catch (error) {
      setUploadError(t("pick.image.uploadFailed", { error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const listed = useMemo(() => {
    const words = query.trim().toLowerCase();
    return (items ?? []).filter((item) => !words || item.path.toLowerCase().includes(words));
  }, [items, query]);
  // The tile of the image the field holds, marked in the list
  const chosenPath = useMemo(() => {
    if (!current || !page) return null;
    const resolved = resolveAsset(htmlFolder(page, file, locale), current);
    return resolved?.startsWith(`${page}/`) ? resolved.slice(page.length + 1) : null;
  }, [current, page, file, locale]);

  return (
    <div className={styles.picker}>
      <div className={styles.current}>
        <div className={styles.thumb}>
          {shown && !broken ? (
            <Media src={shown} onError={() => setBroken(true)} />
          ) : (
            <span className={styles.thumbEmpty}>
              {current ? t("pick.image.missing") : t("pick.image.empty")}
            </span>
          )}
        </div>
        <div className={styles.meta}>
          <span className={styles.name} title={current}>
            {current ? current.split("/").pop() : t("pick.image.empty")}
          </span>
          <div className={styles.actions}>
            <button
              className={`${styles.button} ${styles.primary}`}
              disabled={readOnly || !page}
              type="button"
              onClick={() => setOpen(!open)}
            >
              {open ? t("pick.image.close") : current ? t("pick.image.change") : t("pick.image.choose")}
            </button>
            <button
              className={styles.button}
              disabled={readOnly || !page || uploading}
              type="button"
              onClick={() => input.current?.click()}
            >
              {uploading ? t("pick.image.uploading") : t("pick.image.upload")}
            </button>
            {current ? (
              <button
                className={`${styles.button} ${styles.danger}`}
                disabled={readOnly}
                type="button"
                onClick={() => setValue(null)}
              >
                {t("pick.image.remove")}
              </button>
            ) : null}
          </div>
          {!page ? <span className={styles.note}>{t("pick.image.noPage")}</span> : null}
        </div>
        <input
          ref={input}
          accept="image/*,video/mp4,video/webm"
          className={styles.hidden}
          type="file"
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </div>
      {uploadError ? <div className={styles.error}>{uploadError}</div> : null}

      {open && page ? (
        <div className={styles.library}>
          <div className={styles.libraryBar}>
            <input
              className={styles.search}
              placeholder={t("pick.image.search")}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {loadFailed ? (
            <div className={styles.error}>{t("pick.image.loadFailed")}</div>
          ) : items === null ? (
            <div className={styles.note}>{t("state.loading")}</div>
          ) : items.length === 0 ? (
            <div className={styles.note}>{t("pick.image.none")}</div>
          ) : listed.length === 0 ? (
            <div className={styles.note}>{t("pick.image.noMatch")}</div>
          ) : (
            <div className={styles.grid}>
              {listed.map((item) => (
                <button
                  key={`${item.source}:${item.path}`}
                  className={`${styles.tile} ${item.path === chosenPath ? styles.tileOn : ""}`}
                  title={item.path}
                  type="button"
                  onClick={() => pick(item.path)}
                >
                  <span className={styles.tileImage}>
                    <Media src={item.url} />
                  </span>
                  <span className={styles.tileName}>{item.path.replace(/^assets\//, "")}</span>
                  {item.source === "media" ? <span className={styles.badge}>{t("pick.image.new")}</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <details className={styles.raw}>
        <summary>{t("pick.image.path")}</summary>
        <input
          className={styles.rawInput}
          readOnly={readOnly}
          type="text"
          value={current}
          onChange={(event) => setValue(event.target.value.trim() ? event.target.value : null)}
        />
      </details>
    </div>
  );
}
