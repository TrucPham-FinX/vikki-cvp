"use client";

import { FieldDescription, FieldError, FieldLabel, useField } from "@payloadcms/ui";
import { mergeFieldStyles } from "@payloadcms/ui/shared";
import type { TextareaFieldClientProps } from "payload";
import React from "react";

import styles from "./fields.module.css";
import { HtmlEditor } from "./HtmlEditor";

/**
 * A field the pages print as HTML (a Q&A answer, a promotion's content), written like a document
 * with HtmlEditor's toolbar instead of tags typed into a textarea. It stores the HTML string the
 * data file has, rewritten only when the editor types.
 */
export function HtmlField(props: TextareaFieldClientProps) {
  const { field, path, readOnly } = props;
  const { value, setValue, showError, errorMessage } = useField<string | null>({ path });
  const description = field.admin?.description;

  return (
    <div className={`field-type textarea ${styles.field}`} style={mergeFieldStyles(field)}>
      <FieldLabel label={field.label} path={path} required={field.required} localized={field.localized} />
      <FieldError path={path} showError={showError} message={errorMessage} />
      <HtmlEditor
        label={typeof field.label === "string" ? field.label : undefined}
        readOnly={readOnly}
        value={value}
        onChange={setValue}
      />
      {typeof description === "string" ? <FieldDescription description={description} path={path} /> : null}
    </div>
  );
}
