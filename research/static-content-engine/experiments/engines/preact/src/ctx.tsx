import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Ctx } from './types';
declare const require: (id: string) => any;
const helpers = require('../../../lib/helpers');

export const PageCtx = createContext<Ctx>({ assetBase: './assets/', ui: {} });
export const cx: (...p: unknown[]) => string = helpers.cx;
export function usePage() {
  const c = useContext(PageCtx);
  return { asset: (f: string) => helpers.asset(c.assetBase, f) as string, t: (k: string) => helpers.t(c.ui, k) as string };
}
// The ONLY place raw HTML enters the tree. Input is already sanitised by lib/prepare.js.
export const Rich = ({ as: Tag = 'div', html, ...rest }: { as?: any; html?: string; [k: string]: any }) =>
  <Tag {...rest} dangerouslySetInnerHTML={{ __html: html ?? '' }} />;
export const scriptJson: (v: unknown) => string = helpers.scriptJson;
