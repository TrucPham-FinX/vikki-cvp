import type { ComponentChildren } from 'preact';
import { cx, usePage } from './ctx';
import type { PageVM } from './types';

export function Shell({ vm, head, scripts, children }: { vm: PageVM; head?: ComponentChildren; scripts?: ComponentChildren; children: ComponentChildren }) {
  const { asset, t } = usePage();
  return (
    <html lang={vm.locale}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{vm.title}</title>
        <link rel="stylesheet" href={asset('css/base.css')} />
        {head}
      </head>
      <body class={cx(vm.hasTopSpace && 'hasTopSpace', vm.className, `lang-${vm.locale}`)} id="body">
        <header class="site-header"><img class="site-logo" src={asset('logo-vikki.png')} alt="Vikki Digital Bank" /></header>
        {children}
        <footer class="site-footer"><button type="button" id="backToTop" aria-label={t('backToTop')}><img src={asset('icon-btt.svg')} alt="" /></button></footer>
        <script src={asset('js/runtime.js')} defer />
        {scripts}
      </body>
    </html>
  );
}
