// Props contracts. In a real system these would be derived from one schema source
// (e.g. Zod -> z.infer + z.toJSONSchema) so Ajv validation and TS types cannot drift.
export type Ui = Record<string, string>;
export interface Ctx { assetBase: string; ui: Ui }
export interface MenuItem { title: string; text: string; iconSrc: string; popup?: string; scroll?: string }
export interface Button { popup?: string; title?: string; text: string }
export type Component =
  | { type: 'topMenu'; items: MenuItem[] }
  | { type: 'imageSection'; id?: string; className?: string; src: string }
  | { type: 'productList'; id: string; title: string; columns: number; items: Product[] }
  | { type: 'qa'; title?: { src?: string }; button?: { text: string }; items: { title: string; content: string }[] }
  | { type: 'activation'; bgClass?: string; className?: string; termsButtonFullW?: Button; feeButton?: Button; termsButton?: Button };
export interface Product { id: string; name: string; thumbnail: string; shortDesc: string; isHotDeal: boolean; categories: string[] }
export interface Cell { value?: string; className?: string; colspan?: number; rowspan?: number }
export interface Table { type: 'table'; headerRows?: { cells: Cell[] }[]; rows?: { cells: Cell[] }[]; note?: string }
export interface ListItem { text?: string; className?: string; type?: string; children?: List; headerRows?: Table['headerRows']; rows?: Table['rows']; note?: string }
export interface List { type?: 'list'; style?: string; items: ListItem[] }
export type DocBlock = { type: 'paragraph' | 'subheading'; text: string; className?: string } | (List & { type: 'list' }) | Table;
export interface Section { id: string; title: string; defaultExpanded?: boolean; articles?: Section[]; sections?: Section[]; blocks?: DocBlock[] }
export interface PageVM extends Ctx {
  locale: string; title: string; className?: string; hasTopSpace: boolean;
  hero: { video: { src: string; poster: string; hls: string }; heading: string; subheading: string };
  components: Component[];
  qaGroup: { title?: string; children: { numOrder: number; title: string; content: string }[] }[];
  document: { header: { img: string; h1: string; intro: string[] }; sections: Section[] };
}
