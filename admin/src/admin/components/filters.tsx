"use client";

import React from "react";

import * as D from "../design/design";

/**
 * The ONE set of list-filtering controls every screen uses.
 *
 * The canonical look is the CRUD template's toolbar — `D.Search`, `D.Select`,
 * and a chip that fills when it is on. This file used to say the opposite
 * ("all core-ui"), which was true while the screens around it were core-ui;
 * eight screens now draw their toolbar through here, so leaving it on core-ui
 * put a 40px indigo control row above every design-drawn table.
 *
 * Screens must not hand-roll pills or bare `<select>`s for filtering — that is
 * exactly the drift this file exists to stop.
 *
 * These render INSIDE a `D.Scope`; a screen that has not been wrapped in one
 * will get the design's classes against core-ui's untuned palette.
 */

/**
 * A filter that is either on or off.
 *
 * On is the filled primary, off is the plain chip. The design layer has no
 * pressed state of its own, and inventing a third button look for "toggled"
 * would put a shape on the page that means nothing anywhere else — the filled
 * variant already reads as "this one is active", which is what a chip says.
 */
export function FilterChip({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  /* `onClick`, not `onPress`: `D.Btn` reads `onClick`, and a prop named for
     core-ui's API is how three tenant buttons ended up rendering and doing
     nothing. */
  onClick: () => void;
}) {
  return (
    <D.Btn disabled={disabled} size="sm" variant={active ? "primary" : "neutral"} onClick={onClick}>
      {label}
    </D.Btn>
  );
}

/**
 * A toolbar dropdown.
 *
 * `D.Select` — a native select — is what the CRUD template's own `FilterBar`
 * renders for every declared filter, and both callers here pass a short static
 * enum. A searchable combobox is the FORM control; a toolbar filter is a
 * one-glance choice among a handful.
 *
 * `disabled` + `title` are here because the CRUD `FilterBar` composes this
 * component for relationship filters whose option set is fetched: while the
 * fetch is in flight the control has to sit disabled with a tooltip saying so,
 * and the alternative — the CRUD bar reaching past this file to `D.Select`
 * again — is the drift this file exists to stop.
 */
export function FilterSelect({
  disabled,
  onChange,
  options,
  placeholder,
  title,
  value,
  width = 190,
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  /** Used as the control's accessible name — it is what the filter is FOR. */
  placeholder?: string;
  /** Native tooltip — used when the control is disabled to say why. */
  title?: string;
  value: string;
  width?: number;
}) {
  return (
    <D.Select
      ariaLabel={placeholder ?? options[0]?.label ?? "filter"}
      disabled={disabled}
      options={options}
      title={title}
      value={value}
      width={width}
      onChange={onChange}
    />
  );
}

export function FilterSearch({
  onChangeText,
  placeholder,
  value,
}: {
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  /*
   * No `onSubmit`: every caller here filters rows already in the browser, so
   * each keystroke can narrow them for free. The CRUD list, whose search the
   * service runs, passes `onSubmit` to `D.Search` directly.
   */
  return <D.Search placeholder={placeholder ?? ""} value={value} onChange={onChangeText} />;
}
