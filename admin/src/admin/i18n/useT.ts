"use client";

import { useTranslation } from "@payloadcms/ui";
import { useMemo } from "react";

import { translator, type Translator } from "./dictionary";

/**
 * Translator for this portal's own copy, bound to Payload's active language.
 *
 * The language comes from Payload (account → language), so switching it there
 * switches our screens together with the rest of the admin. Keys and their
 * `{placeholder}` variables are typed — see `dictionary.ts`.
 */
export function useT(): Translator {
  const { i18n } = useTranslation();
  return useMemo(() => translator(i18n?.language), [i18n?.language]);
}
