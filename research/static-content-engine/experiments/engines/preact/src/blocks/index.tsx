import { cx, usePage, Rich } from '../ctx';
import type { Component, PageVM, Button } from '../types';

export function Hero({ hero }: { hero: PageVM['hero'] }) {
  const { asset } = usePage();
  return (
    <section class="hero" id="banner-container">
      <video class="hero-video" src={asset(hero.video.src)} poster={asset(hero.video.poster)} autoplay muted loop playsInline />
      <div class="hero-text"><h1 class="hero-heading">{hero.heading}</h1><p class="hero-sub">{hero.subheading}</p></div>
    </section>
  );
}

type Of<T extends Component['type']> = Extract<Component, { type: T }>;

const TopMenu = ({ items }: Of<'topMenu'>) => (
  <nav class="menu-top" id="qa">
    {items.map((i) => <span class="menu-item" data-popup={i.popup || undefined} data-scroll={i.scroll || undefined} data-title={i.title}><img src={i.iconSrc} alt="" /><span>{i.text}</span></span>)}
  </nav>
);

const ImageSection = ({ id, className, src }: Of<'imageSection'>) => (
  <div class={cx('gjs-row container', className)} id={id || undefined}><div class="gjs-cell"><img class="section" src={src} alt="" /></div></div>
);

function ProductList({ id, title, columns, items }: Of<'productList'>) {
  const { t } = usePage();
  return (
    <section class={`product-list cols-${columns}`} id={id}>
      <h2 class="section-title">{title}</h2>
      <ul class="product-grid">
        {items.map((p) => (
          <li class={cx('product-card', p.isHotDeal && 'is-hot')} data-id={p.id}>
            <img class="product-thumb" src={p.thumbnail} alt={p.name} loading="lazy" />
            {p.isHotDeal && <span class="badge badge-hot">{t('badge.hot')}</span>}
            <h3 class="product-name">{p.name}</h3>
            <Rich class="product-desc" html={p.shortDesc} />
            <ul class="product-tags">{p.categories.map((c) => <li class={`tag tag-${c.toLowerCase()}`}>{c}</li>)}</ul>
            <span class="button" data-promo-id={p.id}>{t('products.cta')}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Qa({ title, items, button }: Of<'qa'>) {
  const { t } = usePage();
  return (
    <section class="faq container">
      {title?.src && <img class="section" src={title.src} alt="" />}
      <div class="accordion js-accordion">
        {items.map((i) => <div class="accordion-item"><button class="accordion-header" type="button"><span>{i.title}</span></button><Rich class="accordion-content" html={i.content} /></div>)}
      </div>
      {button && <span class="button bg-transparent w-full" data-popup="qa" data-title={t('faq.title')}><span>{button.text}</span></span>}
    </section>
  );
}

const Btn = ({ b, extra }: { b: Button; extra?: string }) => <span class={cx('button bg-transparent', extra)} data-popup={b.popup} data-title={b.title}>{b.text}</span>;
const Activation = (p: Of<'activation'>) => (
  <section class={cx('activation gjs-row container p-1', p.bgClass || 'bg-green', p.className)}>
    {p.termsButtonFullW && <Btn b={p.termsButtonFullW} extra="full-w" />}
    {p.feeButton && <Btn b={p.feeButton} />}
    {p.termsButton && <Btn b={p.termsButton} />}
  </section>
);

// Registry: dispatch by type string. The mapped type forces one entry per declared type.
const REGISTRY: { [K in Component['type']]: (p: Of<K>) => any } = {
  topMenu: TopMenu, imageSection: ImageSection, productList: ProductList, qa: Qa, activation: Activation
};

export function Block({ c }: { c: Component }) {
  const Impl = (REGISTRY as any)[c.type];
  if (!Impl) throw new Error(`[Render Error] unknown block type "${(c as any).type}"`);
  return <Impl {...c} />;
}

export function FaqTemplate({ groups }: { groups: PageVM['qaGroup'] }) {
  const { t } = usePage();
  return (
    <template id="qaTemplate"><div class="popup-inner"><h2 class="popup-title">{t('faq.title')}</h2>
      {groups.map((g) => <div class="group-item"><div class="group-heading">{g.title}</div><div class="group-content">{g.children.map((c) => <div class="group-sub"><div class="group-sub-title">{c.numOrder}. {c.title}</div><Rich html={c.content} /></div>)}</div></div>)}
    </div></template>
  );
}
