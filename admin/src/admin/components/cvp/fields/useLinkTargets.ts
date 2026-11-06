"use client";

import { useEffect, useState } from "react";

import { api } from "@/contracts/api";
import type { LinkTargets } from "@/contracts/cvp";

/**
 * What the link pickers offer (`GET /api/cvp/link-targets`), loaded once per content language for
 * every picker of the form: a page has dozens of them. A failed load is forgotten, so the next
 * picker to mount tries again.
 */
const loaded = new Map<string, Promise<LinkTargets>>();

function load(locale: string): Promise<LinkTargets> {
  let pending = loaded.get(locale);
  if (!pending) {
    pending = api.cvp.linkTargets(locale);
    pending.catch(() => loaded.delete(locale));
    loaded.set(locale, pending);
  }
  return pending;
}

export function useLinkTargets(locale: string): { targets: LinkTargets | null; failed: boolean } {
  const [state, setState] = useState<{ targets: LinkTargets | null; failed: boolean }>({
    targets: null,
    failed: false,
  });
  useEffect(() => {
    let live = true;
    load(locale).then(
      (targets) => live && setState({ targets, failed: false }),
      () => live && setState({ targets: null, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [locale]);
  return state;
}
