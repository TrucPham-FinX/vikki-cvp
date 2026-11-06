import {
  CVP_OPERATIONS,
  type LinkTargets,
  type MediaImportReport,
  type MediaUpload,
  type Operation,
  type PageAssets,
  type PublishReport,
  type PublishStatus,
} from "./cvp";

/**
 * The browser's client for the CVP admin's endpoints: components call `api.cvp.<op>()`, never
 * `fetch("/api/...")`, so a path is written once (`contracts/cvp.ts`).
 *
 * galaxy-g-admin builds this barrel from `defineOperation` contracts with RBAC and schemas; the CVP
 * admin has a handful of endpoints and one role, so a typed request helper is the whole of it.
 */

const API_PREFIX = "/api";

/** The media library's collection (collections/CvpMedia.ts), uploaded to through Payload's REST API. */
const MEDIA_COLLECTION = "cvp-media";

/** A refused or failed call, carrying the service's own words when it gave any. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** The body of a response, or the error it carries: the service's own words, or Payload's. */
async function read<T>(response: Response, accept: number[] = []): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: unknown; errors?: { message?: unknown }[] })
    | null;
  if (response.ok || accept.includes(response.status)) {
    if (body === null) throw new ApiError(`HTTP ${response.status}`, response.status);
    return body;
  }
  const said =
    body && typeof body.error === "string"
      ? body.error
      : typeof body?.errors?.[0]?.message === "string"
        ? body.errors[0].message
        : "";
  throw new ApiError(said || `HTTP ${response.status}`, response.status);
}

async function request<T>(
  operation: Operation,
  { accept = [], query }: { accept?: number[]; query?: Record<string, string> } = {},
): Promise<T> {
  const search = query ? `?${new URLSearchParams(query)}` : "";
  const response = await fetch(`${API_PREFIX}${operation.path}${search}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    method: operation.method.toUpperCase(),
  });
  return read<T>(response, accept);
}

export const api = {
  cvp: {
    status: () => request<PublishStatus>(CVP_OPERATIONS.status),
    /** A failed validate or build is a report (422), not an error: the screen shows its log. */
    publish: () => request<PublishReport>(CVP_OPERATIONS.publish, { accept: [422] }),
    /** The places a link field offers, titles in the content language. */
    linkTargets: (locale: string) =>
      request<LinkTargets>(CVP_OPERATIONS.linkTargets, { query: { locale } }),
    /** The images a page can use: published ones and the library's. */
    assets: (page: string) => request<PageAssets>(CVP_OPERATIONS.assets, { query: { page } }),
    /** The images already published in vikki-cvp/<page>/assets/ put into the media library. */
    importMedia: (options: { videos?: boolean } = {}) =>
      request<MediaImportReport>(CVP_OPERATIONS.mediaImport, {
        query: options.videos ? { videos: "1" } : undefined,
      }),
  },
  media: {
    /** One file into the media library, for a page's folder; the library's name for it back. */
    upload: async (file: File, data: MediaUpload): Promise<{ filename: string }> => {
      const form = new FormData();
      form.append("file", file);
      form.append("_payload", JSON.stringify(data));
      const response = await fetch(`${API_PREFIX}/${MEDIA_COLLECTION}`, {
        body: form,
        credentials: "include",
        headers: { Accept: "application/json" },
        method: "POST",
      });
      const { doc } = await read<{ doc: { filename?: unknown } }>(response);
      if (typeof doc?.filename !== "string") throw new ApiError("No file name", response.status);
      return { filename: doc.filename };
    },
  },
};
