"use client";

import { FieldDescription, FieldError, FieldLabel, useField, useFormFields, useLocale } from "@payloadcms/ui";
import { mergeFieldStyles } from "@payloadcms/ui/shared";
import type { TextFieldClientProps } from "payload";
import React from "react";

import styles from "./fields.module.css";
import { ImagePicker } from "./ImagePicker";

/**
 * An image of a landing page's block (src/cvp/blocks.ts), chosen from the page's images or uploaded
 * on the spot instead of typed (ImagePicker).
 *
 * A promotion's or card intro's images are those of one fixed folder (`promotion/`, `card-intro/`),
 * given as `page` and `file` by its collection; a page's are those of the page the form names.
 * It stores the path the data file has always had, so the JSON and the build are as before.
 */
export function ImageField(props: TextFieldClientProps & { file?: string; page?: string }) {
  const { field, path, readOnly, page: fixedPage, file: fixedFile } = props;
  const locale = useLocale()?.code ?? "vi";
  const { value, setValue, showError, errorMessage } = useField<string | null>({ path });

  // Where the item's HTML is, which its relative paths start from (top of the form: identity.ts)
  const formPage = useFormFields(([fields]) => (typeof fields.page?.value === "string" ? fields.page.value.trim() : ""));
  const formFile = useFormFields(([fields]) => (typeof fields.file?.value === "string" ? fields.file.value.trim() : ""));
  const description = field.admin?.description;

  return (
    <div className={`field-type text ${styles.field}`} style={mergeFieldStyles(field)}>
      <FieldLabel label={field.label} path={path} required={field.required} localized={field.localized} />
      <FieldError path={path} showError={showError} message={errorMessage} />
      <ImagePicker
        file={fixedFile ?? formFile}
        locale={locale}
        page={fixedPage ?? formPage}
        readOnly={readOnly}
        value={value}
        onChange={setValue}
      />
      {typeof description === "string" ? <FieldDescription description={description} path={path} /> : null}
    </div>
  );
}
