import React from "react";

import { PRODUCT_NAME } from "../../brand";
import { BrandMark } from "./BrandMark";

/**
 * What Payload draws for `graphics.Logo` (the login screen) and `graphics.Icon` (its small mark
 * slots). Both were Payload's own mark; the admin looked like the framework it is built on.
 *
 * The product name is real text beside the mark, not baked into the artwork.
 */
export function Logo() {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        gap: "var(--d-space-7)",
        justifyContent: "center",
      }}
    >
      <BrandMark height={64} title={PRODUCT_NAME} />
      <span
        style={{
          fontSize: "var(--d-text-2xl)",
          fontWeight: "var(--d-weight-bold)",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {PRODUCT_NAME}
      </span>
    </div>
  );
}

/** Payload's header slot is a small box that clips its overflow, so the mark fits the box. */
export function Icon() {
  return <BrandMark height="fill" title={PRODUCT_NAME} />;
}
