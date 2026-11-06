"use client";

import { useTranslation } from "@payloadcms/ui";
import React from "react";

import { DICTIONARIES, translate } from "../i18n/dictionary";

/**
 * One-click Vietnamese ⇄ English switch, sitting beside the theme toggle.
 *
 * `switchLanguage` is Payload's own server action: it writes the `payload-lng`
 * cookie and refreshes, which is what `getRequestLanguage` reads on the server.
 * Going through it rather than setting the cookie by hand keeps this control,
 * **Account → Language** and server-rendered copy in agreement.
 *
 * The label is the code of the language you would switch TO ("EN" while you are
 * reading Vietnamese), so the button says where it takes you rather than where
 * you already are.
 */

type Lang = "vi" | "en";

export const LanguageToggle: React.FC = () => {
  const { i18n, switchLanguage } = useTranslation();

  const current: Lang = i18n?.language === "en" ? "en" : "vi";
  const next: Lang = current === "vi" ? "en" : "vi";
  // Name the target language in the target language — an English speaker who
  // landed on the Vietnamese UI should still recognise the way out.
  const label = translate(next, next === "en" ? "lang.switchToEn" : "lang.switchToVi");

  // Nothing to switch to if the app was configured with a single language.
  if (!switchLanguage || Object.keys(DICTIONARIES).length < 2) return null;

  return (
    <button
      aria-label={label}
      className="header-icon-btn language-toggle"
      onClick={() => void switchLanguage(next)}
      title={label}
      type="button"
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 20 20"
        width="20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="10" cy="10" r="7.5" />
        <path d="M2.5 10h15M10 2.5c1.9 2 3 4.7 3 7.5s-1.1 5.5-3 7.5c-1.9-2-3-4.7-3-7.5s1.1-5.5 3-7.5Z" />
      </svg>
      <span aria-hidden className="language-toggle__code">
        {next.toUpperCase()}
      </span>
    </button>
  );
};
