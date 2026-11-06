/**
 * Dates at the display edge, in Vietnam's time zone.
 *
 * Built from `formatToParts` rather than `toLocaleString`: the list rows render on the server and
 * hydrate in the browser, and the two ICU builds disagree on separators ("lúc", commas), which
 * React reports as a hydration mismatch. The numeric parts agree everywhere.
 */
const TIME_ZONE = "Asia/Ho_Chi_Minh";

const PARTS = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: TIME_ZONE,
  year: "numeric",
});

const parts = (iso: string | null | undefined) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const out: Record<string, string> = {};
  for (const part of PARTS.formatToParts(date)) out[part.type] = part.value;
  return out;
};

/** 04/11/2026 15:02 — or an em dash for nothing. */
export function fmtDateTime(iso: string | null | undefined): string {
  const p = parts(iso);
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour === "24" ? "00" : p.hour}:${p.minute}` : "—";
}

/** 04/11/2026 — or an em dash for nothing. */
export function fmtDate(iso: string | null | undefined): string {
  const p = parts(iso);
  return p ? `${p.day}/${p.month}/${p.year}` : "—";
}
