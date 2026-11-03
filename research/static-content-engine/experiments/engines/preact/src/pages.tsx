import { render } from 'preact-render-to-string';
import { PageCtx, usePage, scriptJson } from './ctx';
import { Shell } from './Shell';
import { Hero, Block, FaqTemplate } from './blocks';
import { Section } from './doc';
import type { PageVM } from './types';

function Landing({ vm }: { vm: PageVM }) {
  const { asset } = usePage();
  return (
    <Shell vm={vm}
      head={<link rel="stylesheet" href={asset('css/landing.css')} />}
      scripts={<script dangerouslySetInnerHTML={{ __html: `window.CVP_VIDEO = ${scriptJson(vm.hero.video)};` }} />}>
      <main class="landing">
        <Hero hero={vm.hero} />
        {vm.components.map((c) => <Block c={c} />)}
        <FaqTemplate groups={vm.qaGroup} />
      </main>
    </Shell>
  );
}

function Document({ vm }: { vm: PageVM }) {
  const { asset, t } = usePage();
  const d = vm.document;
  return (
    <Shell vm={vm} head={<link rel="stylesheet" href={asset('css/document.css')} />}>
      <main class="legal-doc">
        <header class="legal-header"><img class="legal-logo" src={d.header.img} alt="" /><h1 class="legal-title">{d.header.h1}</h1>{d.header.intro.map((p) => <p class="legal-intro">{p}</p>)}</header>
        <nav class="toc" aria-label={t('doc.toc')}><ol>{d.sections.map((s) => <li><a href={`#${s.id}`}>{s.title}</a></li>)}</ol></nav>
        {d.sections.map((s) => <Section s={s} />)}
      </main>
    </Shell>
  );
}

const page = (Page: typeof Landing) => (vm: PageVM) =>
  '<!DOCTYPE html>' + render(<PageCtx.Provider value={{ assetBase: vm.assetBase, ui: vm.ui }}><Page vm={vm} /></PageCtx.Provider>);

export const renderLanding = page(Landing);
export const renderDocument = page(Document);
