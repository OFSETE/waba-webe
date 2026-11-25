// Painel lateral dentro de um Shadow DOM próprio.

import { isRtl, t } from '../../shared/i18n';
import type { WwData } from '../../shared/types';
import type { App } from '../app';
import { h, clear } from './h';
import { logoSvg, icon } from './icons';
import { PANEL_CSS } from './styles';
import { setUiRoot, toast } from './components';
import type { View, ViewCtx } from './view';

export function isWhatsAppDark(): boolean {
  const b = document.body;
  if (b?.classList.contains('dark')) return true;
  if (document.documentElement.classList.contains('dark')) return true;
  return false;
}

export class Panel {
  host: HTMLElement;
  shadow: ShadowRoot;
  root: HTMLElement;
  private panel: HTMLElement;
  private content: HTMLElement;
  private nav: HTMLElement;
  private statusEl: HTMLElement;
  private offlineBtn: HTMLElement;
  private current: string;
  private payload: unknown;
  private pendingRender = false;
  private fab!: HTMLElement;

  /** O botão flutuante só aparece quando o ícone na barra de ferramentas do WhatsApp não pôde ser colocado. */
  setFabVisible(v: boolean): void {
    this.fab.style.display = v ? '' : 'none';
  }

  constructor(private app: App, private views: View[], mount: HTMLElement = document.body) {
    this.host = h('div', { id: 'wabawebe-root' });
    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.shadow.appendChild(h('style', null, PANEL_CSS));
    this.root = h('div', { class: 'root' });
    this.shadow.appendChild(this.root);
    setUiRoot({ layer: this.root });
    this.current = views[0].id;

    this.statusEl = h('div', { class: 'status' });
    this.offlineBtn = h('button', { class: 'btn ghost', onclick: () => app.store.update('settings', (s) => void (s.offline = !s.offline)) });
    this.nav = h('div', { class: 'nav' });
    this.content = h('div', { class: 'content' });
    this.panel = h(
      'div',
      { class: 'panel', role: 'dialog', 'aria-label': 'WABA WEBE' },
      h('div', { class: 'top' },
        h('span', { html: logoSvg(), style: 'line-height:0' }),
        h('div', null, h('div', { class: 'title' }, 'WABA WEBE'), this.statusEl),
        h('div', { class: 'spacer' }),
        this.offlineBtn,
        h('button', { class: 'btn ghost', title: t('close'), onclick: () => this.close() }, icon('close')),
      ),
      h('div', { class: 'body' }, this.nav, this.content),
    );
    this.fab = h('button', { class: 'fab', title: 'WABA WEBE', html: logoSvg(), onclick: () => this.toggle() });
    this.root.append(this.fab, this.panel);
    mount.appendChild(this.host);

    app.ui = {
      toast: (text, kind) => toast(text, kind),
      openPanel: (tab, payload) => this.open(tab, payload),
      togglePanel: () => this.toggle(),
    };

    app.store.subscribe((field) => this.onStoreChange(field));
    this.applyTheme();
    new MutationObserver(() => this.applyTheme()).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => this.applyTheme());
    this.renderChrome();
  }

  get isOpen(): boolean {
    return this.panel.classList.contains('open');
  }

  open(tab?: string, payload?: unknown): void {
    if (tab && this.views.some((v) => v.id === tab)) this.current = tab;
    this.payload = payload;
    this.panel.classList.add('open');
    this.renderView();
  }

  close(): void {
    this.panel.classList.remove('open');
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  setReady(ready: boolean): void {
    clear(this.statusEl);
    this.statusEl.append(h('span', { class: `dot ${ready ? 'on' : ''}` }), ready ? t('ready') : t('notReady'));
  }

  applyTheme(): void {
    const th = this.app.store.settings.theme;
    const dark = th === 'dark' || (th === 'auto' && (isWhatsAppDark() || matchMedia('(prefers-color-scheme: dark)').matches));
    this.root.classList.toggle('dark', dark);
    this.root.setAttribute('dir', isRtl() ? 'rtl' : 'ltr');
  }

  private onStoreChange(field: keyof WwData | '*'): void {
    if (field === 'settings' || field === '*') {
      this.applyTheme();
      this.renderChrome();
    }
    if (!this.isOpen) return;
    const view = this.views.find((v) => v.id === this.current);
    if (field === '*' || view?.fields.includes(field)) this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.pendingRender) return;
    this.pendingRender = true;
    requestAnimationFrame(() => {
      this.pendingRender = false;
      this.renderView();
    });
  }

  private renderChrome(): void {
    clear(this.nav);
    for (const v of this.views)
      this.nav.append(
        h('button', {
          class: v.id === this.current ? 'active' : '',
          title: t(v.label),
          onclick: () => {
            this.current = v.id;
            this.payload = undefined;
            this.renderChrome();
            this.renderView();
          },
        }, icon(v.icon), t(v.label)),
      );
    const off = this.app.store.settings.offline;
    clear(this.offlineBtn);
    this.offlineBtn.title = `${t('offlineMode')}: ${off ? t('enabled') : t('disabled')}`;
    this.offlineBtn.style.color = off ? 'var(--warn)' : '';
    this.offlineBtn.append(icon('wifiOff'));
    this.setReady(this.app.pageReady);
  }

  renderView(): void {
    const view = this.views.find((v) => v.id === this.current) ?? this.views[0];
    const scroll = this.content.scrollTop;
    const ctx: ViewCtx = {
      app: this.app,
      payload: this.payload,
      rerender: () => this.renderView(),
      setTab: (id, payload) => {
        this.current = id;
        this.payload = payload;
        this.renderChrome();
        this.renderView();
      },
    };
    clear(this.content);
    try {
      this.content.append(view.render(ctx));
    } catch (e) {
      this.content.append(h('div', { class: 'banner' }, `${t('error')}: ${e instanceof Error ? e.message : String(e)}`));
    }
    this.content.scrollTop = scroll;
    this.nav.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', this.views[i]?.id === view.id));
  }
}
