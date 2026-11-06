"use client";

import { FieldDescription, FieldError, FieldLabel, ReactSelect, useField, useFormFields } from "@payloadcms/ui";
import { mergeFieldStyles } from "@payloadcms/ui/shared";
import type { TextFieldClientProps } from "payload";
import React, { useMemo } from "react";

import type { TranslationKey } from "@/admin/i18n/dictionary";
import { useT } from "@/admin/i18n/useT";

import styles from "./fields.module.css";

/**
 * Which data file of its page a page or popup is (cvp/identity.ts), picked from the names the CVP
 * uses instead of typed: `index.json`, one per language (`{locale}.json`), `tc.json`… Any other
 * name can be typed; it is written in lower case with `.json`, and the server checks it.
 */

export type FileKind = "page" | "document";

type Option = { label: string; value: string };

const NAMES: Record<FileKind, { file: string; note: TranslationKey }[]> = {
  page: [
    { file: "index.json", note: "pick.file.index" },
    { file: "{page}.json", note: "pick.file.named" },
    { file: "{locale}.json", note: "pick.file.perLocale" },
  ],
  document: [
    { file: "tc.json", note: "pick.file.tc" },
    { file: "fee.json", note: "pick.file.fee" },
    { file: "tc-{locale}.json", note: "pick.file.tcPerLocale" },
    { file: "fee-{locale}.json", note: "pick.file.feePerLocale" },
  ],
};

/** A typed name as a data file's: `Phi Dich Vu` → `phi-dich-vu.json` */
function toFileName(typed: string): string {
  const name = typed.trim().toLowerCase().replace(/\.json$/, "").replace(/\s+/g, "-");
  return name ? `${name}.json` : "";
}

export function FileField(props: TextFieldClientProps & { kind?: FileKind }) {
  const { field, path, readOnly, kind = "page" } = props;
  const t = useT();
  const { value, setValue, showError, errorMessage } = useField<string | null>({ path });
  const page = useFormFields(([fields]) => (typeof fields.page?.value === "string" ? fields.page.value.trim() : ""));

  const options = useMemo<Option[]>(
    () =>
      NAMES[kind].flatMap(({ file, note }) => {
        if (file.includes("{page}") && !page) return [];
        const name = file.replace("{page}", page);
        return [{ label: `${name} — ${t(note)}`, value: name }];
      }),
    [kind, page, t],
  );

  const current = typeof value === "string" && value.trim() ? value.trim() : null;
  // The name alone once chosen: the menu says what each one is
  const selected = current ? { label: current, value: current } : undefined;
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
        placeholder={t("pick.file.placeholder")}
        value={selected}
        onChange={(option) => {
          const picked = Array.isArray(option) ? option[0] : option;
          setValue(toFileName(typeof picked?.value === "string" ? picked.value : "") || null);
        }}
      />
      {typeof description === "string" ? <FieldDescription description={description} path={path} /> : null}
    </div>
  );
}
