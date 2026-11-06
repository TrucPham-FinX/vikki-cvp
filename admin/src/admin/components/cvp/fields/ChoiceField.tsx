"use client";

import { FieldDescription, FieldError, FieldLabel, ReactSelect, useField, useLocale } from "@payloadcms/ui";
import { mergeFieldStyles } from "@payloadcms/ui/shared";
import type { TextFieldClientProps } from "payload";
import React, { useMemo } from "react";

import { useT } from "@/admin/i18n/useT";
import type { ChoiceKey } from "@/contracts/cvp";
import { joinCodes, splitCodes, toCode } from "@/cvp/codes";

import styles from "./fields.module.css";
import { useLinkTargets } from "./useLinkTargets";

type Option = { label: string; value: string };

/**
 * A code of a promotion or card intro (cvp/codes.ts), picked from the codes already in use instead
 * of typed: `promotionCate` takes several (stored `VIKKIGO_PLUS,VIKKI_ONE`), the groups one. A new
 * code can be typed, and is written the way the others are (upper case, `_`).
 *
 * The stored string is only rewritten when the editor changes the choice, so an item saved as
 * `VIKKI_ONE, VIKKIGO_PLUS` keeps that spelling until then.
 */
export function ChoiceField(props: TextFieldClientProps & { choice: ChoiceKey; many?: boolean }) {
  const { field, path, readOnly, choice, many = false } = props;
  const t = useT();
  const locale = useLocale()?.code ?? "vi";
  const { value, setValue, showError, errorMessage } = useField<string | null>({ path });
  const { targets, failed } = useLinkTargets(locale);

  const chosen = useMemo(() => splitCodes(value), [value]);
  const options = useMemo<Option[]>(
    () =>
      [...new Set([...(targets?.choices[choice] ?? []), ...chosen])].map((code) => ({
        label: code,
        value: code,
      })),
    [targets, choice, chosen],
  );

  const toValue = (picked: unknown): string | null => {
    const list = (Array.isArray(picked) ? picked : picked ? [picked] : []) as Partial<Option>[];
    const codes = splitCodes(list.map((option) => toCode(String(option?.value ?? ""))).join(","));
    return codes.length ? joinCodes(many ? codes : codes.slice(0, 1)) : null;
  };

  const description = field.admin?.description;

  return (
    <div className={`field-type text ${styles.field}`} style={mergeFieldStyles(field)}>
      <FieldLabel label={field.label} path={path} required={field.required} localized={field.localized} />
      <FieldError path={path} showError={showError} message={errorMessage} />
      <ReactSelect
        disabled={readOnly}
        isClearable
        isCreatable
        isMulti={many}
        isSearchable
        options={options}
        placeholder={many ? t("pick.code.placeholderMany") : t("pick.code.placeholder")}
        value={
          many
            ? chosen.map((code) => ({ label: code, value: code }))
            : chosen[0]
              ? { label: chosen[0], value: chosen[0] }
              : undefined
        }
        onChange={(picked) => setValue(toValue(picked))}
      />
      {failed ? <div className={styles.note}>{t("pick.code.loadFailed")}</div> : null}
      {typeof description === "string" ? <FieldDescription description={description} path={path} /> : null}
    </div>
  );
}
