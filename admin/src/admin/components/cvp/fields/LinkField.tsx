"use client";

import {
  FieldDescription,
  FieldError,
  FieldLabel,
  ReactSelect,
  useField,
  useFormFields,
  useLocale,
} from "@payloadcms/ui";
import { mergeFieldStyles } from "@payloadcms/ui/shared";
import type { TextFieldClientProps } from "payload";
import React, { useMemo } from "react";

import { useT } from "@/admin/i18n/useT";

import styles from "./fields.module.css";
import { groupsFor, type LinkKind } from "./LinkPicker";
import { useLinkTargets } from "./useLinkTargets";

export type { LinkKind } from "./LinkPicker";

/**
 * A link of a landing page's block, picked instead of typed (src/cvp/blocks.ts):
 *
 * - `popup`: the popup a button or menu item opens: the page's own Q&A ("qa"), or a popup
 *   document, page, promotion list…
 * - `popupLink`: where a slide leads: a promotion, a document, a page, or a web address
 * - `scroll`: the part of this page a menu item scrolls to (`#intro`), from the blocks' element ids
 *
 * What it stores is the string the data file has always had (`/vikki-cvp/<page>/tc.html`, `qa`,
 * `#intro`), so the JSON, the build and the round trip are as before. Anything not offered can be
 * typed: a web address, a page not in the admin.
 */

// The blocks' element ids, as one string so the form's other keystrokes do not redraw the picker
const SECTION_PATH = /^components\.(\d+)\.htmlId$/;

export function LinkField(props: TextFieldClientProps & { kind?: LinkKind }) {
  const { field, path, readOnly, kind = "popup" } = props;
  const t = useT();
  const locale = useLocale()?.code ?? "vi";
  const { value, setValue, showError, errorMessage } = useField<string | null>({ path });
  const { targets, failed } = useLinkTargets(locale);

  const sectionKey = useFormFields(([fields]) =>
    kind !== "scroll"
      ? ""
      : Object.entries(fields)
          .flatMap(([fieldPath, state]) => {
            const match = SECTION_PATH.exec(fieldPath);
            const id = typeof state?.value === "string" ? state.value.trim() : "";
            if (!match || !id) return [];
            const blockType = fields[`components.${match[1]}.blockType`]?.value;
            return [`${id}\t${typeof blockType === "string" ? blockType : ""}`];
          })
          .join("\n"),
  );

  const groups = useMemo(() => {
    const sections = sectionKey
      ? sectionKey.split("\n").map((line) => {
          const [id = "", blockType = ""] = line.split("\t");
          return { id, blockType };
        })
      : [];
    return groupsFor(kind, targets, sections, t);
  }, [kind, targets, sectionKey, t]);

  const current = typeof value === "string" && value.trim() ? value : null;
  const selected = useMemo(() => {
    if (!current) return undefined;
    for (const group of groups) {
      const found = group.options.find((option) => option.value === current);
      if (found) return found;
    }
    return { label: current, value: current };
  }, [current, groups]);

  const description = field.admin?.description;

  return (
    <div className={`field-type text ${styles.field}`} style={mergeFieldStyles(field)}>
      <FieldLabel label={field.label} path={path} required={field.required} localized={field.localized} />
      <FieldError path={path} showError={showError} message={errorMessage} />
      <ReactSelect
        disabled={readOnly}
        isClearable
        isCreatable
        isSearchable
        options={groups}
        placeholder={kind === "scroll" ? t("pick.link.scrollPlaceholder") : t("pick.link.placeholder")}
        value={selected}
        onChange={(option) => {
          const picked = Array.isArray(option) ? option[0] : option;
          const next = typeof picked?.value === "string" ? picked.value.trim() : "";
          // Cleared: no key in the data file, rather than an empty one
          setValue(next || null);
        }}
      />
      {selected && selected.label !== selected.value ? (
        <div className={styles.saved}>
          {t("pick.link.saved")} <code>{selected.value}</code>
        </div>
      ) : null}
      {failed && kind !== "scroll" ? <div className={styles.note}>{t("pick.link.loadFailed")}</div> : null}
      {typeof description === "string" ? <FieldDescription description={description} path={path} /> : null}
    </div>
  );
}
