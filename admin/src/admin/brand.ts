/**
 * The product's name, in one place: the sidebar, the login screen and the browser tab read it.
 */
export const PRODUCT_NAME = "Vikki CVP";

/**
 * The version this build was cut from. `next.config.mjs` copies it out of `package.json` at build
 * time, so a release only has to bump that file.
 */
export const APP_VERSION = process.env.APP_VERSION ?? "0.0.0";

/** The line under the sidebar wordmark: what this is, then the build's version. */
export const SUBTITLE = `Admin · v${APP_VERSION}`;
