/**
 * What a failed call said, in words an editor can act on — galaxy-g-admin's `apiError.ts`, the
 * part the CVP screens use.
 */

/**
 * Wording that came from the transport rather than from a service: the browser's "Failed to
 * fetch", a body that was not JSON, a bare status line. None of it says what went wrong.
 */
const TRANSPORT_NOISE: RegExp[] = [
  /^failed to fetch\b/i,
  /^fetch failed\b/i,
  /^load failed\b/i,
  /^networkerror\b/i,
  /^network ?error\b/i,
  /^the network connection was lost/i,
  /^the operation was aborted/i,
  /^signal is aborted/i,
  /^(http|lỗi|error) \d{3}\b/i,
  /^request failed \(\d{3}\)/i,
  /^unexpected (token|end of json)/i,
  /is not valid json/i,
];

export const isTransportNoise = (text: string): boolean =>
  TRANSPORT_NOISE.some((pattern) => pattern.test(text.trim()));

/**
 * What a thrown error says, for the small `detail` line under a toast's headline — the
 * service's words, or an empty string when there were none.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.name === "AbortError") return "";
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const words = raw.trim();
  return words && !isTransportNoise(words) ? words : "";
}
