import { cx, Rich } from '../ctx';
import type { Cell, DocBlock, List, Section as S, Table as T } from '../types';

const CellEl = ({ as, c }: { as: 'th' | 'td'; c: Cell }) => <Rich as={as} class={c.className || undefined} colspan={c.colspan || undefined} rowspan={c.rowspan || undefined} html={c.value} />;

export const Table = ({ t }: { t: Pick<T, 'headerRows' | 'rows' | 'note'> }) => (
  <div class="table-scroll"><table class="fee-table">
    <thead>{(t.headerRows || []).map((r) => <tr>{r.cells.map((c) => <CellEl as="th" c={c} />)}</tr>)}</thead>
    <tbody>{(t.rows || []).map((r) => <tr>{r.cells.map((c) => <CellEl as="td" c={c} />)}</tr>)}</tbody>
  </table>{t.note && <Rich class="legal-note" html={t.note} />}</div>
);

export const ListEl = ({ l }: { l: List }) => (
  <ul class={cx('legal-list', l.style)}>{l.items.map((i) => (
    <li class={cx('legal-list-item', i.className)}>
      <Rich as="span" class="legal-list-text" html={i.text} />
      {i.type === 'table' && <Table t={i} />}
      {i.children?.items?.length ? <ListEl l={i.children} /> : null}
    </li>
  ))}</ul>
);

function DocBlockEl({ b }: { b: DocBlock }) {
  switch (b.type) {
    case 'paragraph': return <Rich class={cx('legal-paragraph', b.className)} html={b.text} />;
    case 'subheading': return <Rich as="h3" class={cx('legal-subheading', b.className)} html={b.text} />;
    case 'list': return <ListEl l={b} />;
    case 'table': return <Table t={b} />;
    default: throw new Error(`[Render Error] unknown document block type "${(b as any).type}"`);
  }
}

export const Section = ({ s }: { s: S }) => (
  <section class="accordion" id={s.id}><h2 class="accordion-header" data-toggle={`body-${s.id}`}>{s.title}</h2>
    <div class={cx('accordion-body', s.defaultExpanded && 'is-open')} id={`body-${s.id}`}>
      {(s.articles || []).map((a) => <Section s={a} />)}
      {(s.sections || []).map((x) => <Section s={x} />)}
      {(s.blocks || []).map((b) => <DocBlockEl b={b} />)}
    </div>
  </section>
);
