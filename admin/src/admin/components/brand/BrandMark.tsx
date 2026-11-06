import React from "react";

/**
 * The Vikki wordmark, served from `/public/brand`.
 *
 * Cut from the logo the CVP pages ship (`vikki-cvp/<page>/assets/vikki-logo.png`) without its
 * "Digital Bank" line, which is unreadable at sidebar size. It is wider than tall (248×142), so
 * the mark is sized by its HEIGHT and keeps its proportions; galaxy-g-admin's square symbol was
 * sized by one number for both.
 *
 * One `<img>`, so the file in `public/brand` is the single source of truth.
 */
const SRC = "/brand/vikki-mark.png";
const RATIO = 248 / 142;

export function BrandMark({
  height = 24,
  title,
}: {
  /** A pixel height, or "fill" to take the container's box. */
  height?: "fill" | number;
  /** Announced to screen readers; omit for a decorative mark. */
  title?: string;
}) {
  const fluid = height === "fill";

  return (
    <img
      src={SRC}
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      width={fluid ? undefined : Math.round(height * RATIO)}
      height={fluid ? undefined : height}
      style={{
        display: "block",
        flex: "none",
        height: fluid ? "100%" : height,
        objectFit: "contain",
        width: fluid ? "100%" : Math.round(height * RATIO),
      }}
    />
  );
}
