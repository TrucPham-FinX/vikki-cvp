import React from "react";

import { PRODUCT_NAME, SUBTITLE } from "../../brand";
import { BrandMark } from "../brand/BrandMark";
import styles from "./NavBrand.module.css";

/**
 * The mark at the top of the sidebar: the Vikki wordmark, the product's name, and the build's
 * version under it — one constant (`brand.ts`) for the rail, the login screen and the tab title.
 *
 * Not a link: the Dashboard row sits right below it. The name is real text, so the product is
 * announced once; the mark is decorative and hidden.
 */
export function NavBrand() {
  return (
    <div className={styles.brand}>
      <span className={styles.mark}>
        <BrandMark height={22} />
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{PRODUCT_NAME}</span>
        <span className={styles.suffix}>{SUBTITLE}</span>
      </span>
    </div>
  );
}
