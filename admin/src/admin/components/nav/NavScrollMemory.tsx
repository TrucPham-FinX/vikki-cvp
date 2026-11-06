"use client";

import React, { useLayoutEffect, useRef } from "react";

import { readScroll, scrollerOf, writeScroll } from "./navMemory";

/**
 * Puts the sidebar back where it was.
 *
 * Renders nothing — it is here for the anchor, which is how it finds the rail's
 * scroller. `useLayoutEffect` so the restore lands before paint.
 *
 * Restore re-runs while the rail's height is still settling (section collapse,
 * permission-gated rows). A ResizeObserver drives that, but only until the
 * saved offset sticks or the user scrolls — otherwise a late layout would yank
 * them back.
 */
export function NavScrollMemory() {
  const anchor = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const scroller = scrollerOf(anchor.current);
    if (!scroller) return;

    const saved = readScroll();
    let restoring = false;
    let settled = saved === null;

    const onScroll = () => {
      if (restoring) return;
      // Operator moved the rail — stop fighting them and remember where they are.
      settled = true;
      writeScroll(scroller.scrollTop);
    };

    const apply = () => {
      if (settled || saved === null) return;
      restoring = true;
      scroller.scrollTop = saved;
      requestAnimationFrame(() => {
        restoring = false;
        // Content tall enough to hold the offset (or we landed on it).
        if (Math.abs(scroller.scrollTop - saved) <= 1) {
          settled = true;
        }
      });
    };

    apply();
    scroller.addEventListener("scroll", onScroll, { passive: true });

    const frame = requestAnimationFrame(apply);

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            apply();
          })
        : null;
    ro?.observe(scroller);
    if (scroller.firstElementChild) ro?.observe(scroller.firstElementChild);

    // Give late-mounting rows a moment, then stop watching height.
    const stop = window.setTimeout(() => {
      settled = true;
      ro?.disconnect();
    }, 1000);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(stop);
      ro?.disconnect();
      if (!restoring) writeScroll(scroller.scrollTop);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, []);

  return <span aria-hidden="true" ref={anchor} style={{ display: "none" }} />;
}
