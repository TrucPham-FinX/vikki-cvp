import { redirect } from "next/navigation";

/**
 * Send an anonymous visitor to login instead of a dead-end message, with the current path as
 * `?redirect=` so they land back here. Throws, so callers may treat the user as present after.
 */
export const requireUser = <T>(req: { url?: null | string; user?: null | T }): T => {
  if (!req.user) {
    let target = "/admin";
    if (req.url) {
      const url = new URL(req.url, "http://localhost");
      target = `${url.pathname}${url.search}`;
    }
    redirect(`/admin/login?redirect=${encodeURIComponent(target)}`);
  }
  return req.user;
};
