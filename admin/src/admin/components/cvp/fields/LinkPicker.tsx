"use client";

import { ReactSelect } from "@payloadcms/ui";
import React, { useMemo } from "react";

import type { Translator } from "@/admin/i18n/dictionary";
import { useT } from "@/admin/i18n/useT";
import type { LinkGroupKey, LinkOption, LinkTargets } from "@/contracts/cvp";

import { BLOCK_NAMES } from "../CvpRowLabel";
import styles from "./fields.module.css";
import { useLinkTargets } from "./useLinkTargets";

/**
 * Where a button or slide leads, picked from the places the admin knows instead of typed
 * (cvp/links.ts): the page's own Q&A ("qa"), a popup's content, a page, a promotion list…
 * It stores the string the data files have always had (`/vikki-cvp/<page>/tc.html`, `qa`), and
 * anything not offered can be typed (a web address). Used by LinkField (a field of its own) and the
 * structured editor (JsonFormField).
 */

export type LinkKind = "popup" | "popupLink" | "scroll";

type Option = { label: string; value: string };
type Group = { label: string; options: Option[] };

// Each kind's groups, the likeliest first
const ORDER: Record<Exclude<LinkKind, "scroll">, LinkGroupKey[]> = {
  popup: ["documents", "pages", "promotionLists", "promotions", "cardIntros"],
  popupLink: ["promotions", "documents", "pages", "cardIntros", "promotionLists"],
};

function optionLabel(option: LinkOption, group: LinkGroupKey, t: Translator): string {
  if (group === "promotionLists") {
    return option.label ? t("pick.link.category", { category: option.label }) : t("pick.link.allPromotions");
  }
  if (!option.lang) return option.label;
  return `${option.label} · ${option.lang === "auto" ? t("pick.link.auto") : option.lang.toUpperCase()}`;
}

type Section = { id: string; blockType: string };

export function groupsFor(
  kind: LinkKind,
  targets: LinkTargets | null,
  sections: Section[],
  t: Translator,
): Group[] {
  if (kind === "scroll") {
    const options = sections.map(({ id, blockType }) => {
      const name = BLOCK_NAMES[blockType];
      return { label: name ? `#${id} — ${t(name)}` : `#${id}`, value: `#${id}` };
    });
    return options.length ? [{ label: t("pick.link.group.sections"), options }] : [];
  }
  const groups: Group[] = [];
  if (kind === "popup") {
    groups.push({ label: t("pick.link.group.here"), options: [{ label: t("pick.link.qa"), value: "qa" }] });
  }
  for (const key of ORDER[kind]) {
    const group = targets?.groups.find((candidate) => candidate.key === key);
    if (!group) continue;
    groups.push({
      label: t(`pick.link.group.${key}`),
      options: group.options.map((option) => ({ label: optionLabel(option, key, t), value: option.value })),
    });
  }
  return groups;
}

export type LinkPickerProps = {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  kind?: Exclude<LinkKind, "scroll">;
  locale: string;
  readOnly?: boolean;
};

export function LinkPicker({ value, onChange, kind = "popup", locale, readOnly }: LinkPickerProps) {
  const t = useT();
  const { targets, failed } = useLinkTargets(locale);
  const groups = useMemo(() => groupsFor(kind, targets, [], t), [kind, targets, t]);
  const current = typeof value === "string" && value.trim() ? value : null;
  const selected = useMemo(() => {
    if (!current) return undefined;
    for (const group of groups) {
      const found = group.options.find((option) => option.value === current);
      if (found) return found;
    }
    return { label: current, value: current };
  }, [current, groups]);

  return (
    <div className={styles.linkPicker}>
      <ReactSelect
        disabled={readOnly}
        isClearable
        isCreatable
        isSearchable
        options={groups}
        placeholder={t("pick.link.placeholder")}
        value={selected}
        onChange={(option) => {
          const picked = Array.isArray(option) ? option[0] : option;
          const next = typeof picked?.value === "string" ? picked.value.trim() : "";
          onChange(next || null);
        }}
      />
      {selected && selected.label !== selected.value ? (
        <div className={styles.saved}>
          {t("pick.link.saved")} <code>{selected.value}</code>
        </div>
      ) : null}
      {failed ? <div className={styles.note}>{t("pick.link.loadFailed")}</div> : null}
    </div>
  );
}
