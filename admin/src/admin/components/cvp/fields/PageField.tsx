"use client";

import { FieldDescription, FieldError, FieldLabel, ReactSelect, useField, useLocale } from "@payloadcms/ui";
import { mergeFieldStyles } from "@payloadcms/ui/shared";
import type { TextFieldClientProps } from "payload";
import React, { useMemo } from "react";

import { useT } from "@/admin/i18n/useT";

import styles from "./fields.module.css";
import { useLinkTargets } from "./useLinkTargets";

/**
 * The page a media library file belongs to (collections/CvpMedia.ts), picked from the folders the
 * admin knows: its pages', its documents', and those of vikki-cvp/. A new folder can be typed.
 */
export function PageField(props: TextFieldClientProps) {
  const { field, path, readOnly } = props;
  const t = useT();
  const locale = useLocale()?.code ?? "vi";
  const { value, setValue, showError, errorMessage } = useField<string | null>({ path });
  const { targets } = useLinkTargets(locale);

  const options = useMemo(
    () => (targets?.pages ?? []).map((page) => ({ label: page, value: page })),
    [targets],
  );
  const current = typeof value === "string" && value.trim() ? value.trim() : null;
  const description = field.admin?.description;

  return (
    <div className={`field-type text ${styles.field}`} style={mergeFieldStyles(field)}>
      <FieldLabel label={field.label} path={path} required={field.required} />
      <FieldError path={path} showError={showError} message={errorMessage} />
      <ReactSelect
        disabled={readOnly}
        isClearable
        isCreatable
        isSearchable
        options={options}
        placeholder={t("pick.page.placeholder")}
        value={current ? { label: current, value: current } : undefined}
        onChange={(option) => {
          const picked = Array.isArray(option) ? option[0] : option;
          const next = typeof picked?.value === "string" ? picked.value.trim().toLowerCase() : "";
          setValue(next || null);
        }}
      />
      {typeof description === "string" ? <FieldDescription description={description} path={path} /> : null}
    </div>
  );
}
