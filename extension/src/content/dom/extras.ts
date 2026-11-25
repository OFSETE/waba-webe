// Integrações com a página do WhatsApp Web que a referência também tem:
// ícone na barra de ferramentas lateral, lista que não "pula", fixar conversas sem limite e baixar status.

import { t } from '../../shared/i18n';
import { h, downloadBlob } from '../ui/h';
import { logoSvg } from '../ui/icons';
import { PANEL_CSS } from '../ui/styles';
import { toast } from '../ui/components';
import type { App } from '../app';

/**
 * Ícone do WABA WEBE na barra de ferramentas do WhatsApp Web (a coluna de ícones à esquerda),
 * como a referência faz: ela acrescenta o botão ao bloco que contém o primeiro separador `header hr`.
 * Enquanto uma transmissão está enviando, o ícone pisca. Se a barra não existir, fica o botão flutuante.
 */
export class ToolbarButton {
  private host: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private app: App,
    private onClick: () => void,
    private setFabVisible: (v: boolean) => void,
  ) {}

  start(): void {
    new MutationObserver(() => this.schedule()).observe(document.body, { childList: true, subtree: true });
    this.app.store.subscribe((f) => {
      if (f === 'broadcasts' || f === '*') this.blink();
    });
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.ensure();
    }, 500);
  }

  /** O bloco da barra lateral onde ficam os ícones (Conversas, Status, Canais...). */
  private findBar(): Element | null {
    const hr = document.querySelector('header hr');
    if (hr?.parentElement) return hr.parentElement;
    // plano B: a barra lateral com os botões de navegação
    const nav = document.querySelector('header [role="navigation"], [data-navbar-item]')?.closest('header');
    return nav ?? null;
  }

  private ensure(): void {
    if (this.host?.isConnected) return;
    const bar = this.findBar();
    if (!bar) {
      this.setFabVisible(true);
      return;
    }
    this.host = h('div', { id: 'wabawebe-nav', title: 'WABA WEBE', style: 'display:flex;justify-content:center;cursor:pointer' });
    const shadow = this.host.attachShadow({ mode: 'open' });
    shadow.append(
      h('style', null, `${PANEL_CSS}
        .navbtn{all:unset;cursor:pointer;display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;margin:4px 0}
        .navbtn:hover{background:rgba(127,127,127,.15)}
        .navbtn svg{width:26px;height:26px}
        .navbtn.blink svg{animation:wwblink 1s ease-in-out infinite}
        @keyframes wwblink{50%{opacity:.35}}`),
      h('button', { class: 'navbtn', title: 'WABA WEBE', 'aria-label': 'WABA WEBE', html: logoSvg(), onclick: () => this.onClick() }),
    );
    bar.appendChild(this.host);
    this.setFabVisible(false);
    this.blink();
  }

  private blink(): void {
    const btn = this.host?.shadowRoot?.querySelector('.navbtn');
    const sending = this.app.store.data.broadcasts.some((b) => b.status === 'running');
    btn?.classList.toggle('blink', sending);
  }
}

/**
 * "Impedir que a lista de conversas pule": guarda a posição da lista na hora do envio e a devolve
 * 100 ms depois que a mensagem enviada aparece (bootstrap.min.js 0x1b2ef).
 */
export class PreventListJump {
  private lastY: number | null = null;

  constructor(private app: App) {}

  start(): void {
    const remember = () => {
      if (!this.app.store.settings.customizations.preventChatsListJumping) return;
      const pane = document.getElementById('pane-side');
      if (pane) this.lastY = pane.scrollTop;
    };
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLElement | null)?.closest?.('#main footer')) remember();
      },
      true,
    );
    document.addEventListener(
      'mousedown',
      (e) => {
        if ((e.target as HTMLElement | null)?.closest?.('#main footer button, #main footer [role="button"]')) remember();
      },
      true,
    );
  }

  /** Chamado quando uma mensagem minha aparece. */
  onSent(): void {
    if (!this.app.store.settings.customizations.preventChatsListJumping || this.lastY === null) return;
    const y = this.lastY;
    setTimeout(() => {
      const pane = document.getElementById('pane-side');
      if (pane) pane.scrollTop = y;
    }, 100);
  }
}

/** Fixar conversas só neste navegador, sem o limite do WhatsApp (pinnedChats da referência). */
export class LocalPins {
  private applied: string[] = [];

  constructor(private app: App) {}

  start(): void {
    this.app.store.subscribe((f) => {
      if (f === 'settings' || f === '*') void this.apply();
    });
  }

  async apply(): Promise<void> {
    if (!this.app.pageReady) return;
    const ids = this.app.store.settings.pinnedChats;
    if (ids.join(',') === this.applied.join(',')) return;
    await this.app.bridge.call('applyLocalPins', { ids, previous: this.applied }).catch(() => null);
    this.applied = ids.slice();
  }

  toggle(chatId: string): boolean {
    let on = false;
    this.app.store.update('settings', (s) => {
      on = !s.pinnedChats.includes(chatId);
      s.pinnedChats = on ? [...s.pinnedChats, chatId] : s.pinnedChats.filter((x) => x !== chatId);
    });
    return on;
  }
}

/**
 * Botão de baixar status: quando o visualizador de status está aberto (uma mídia grande fora da lista
 * de conversas e da conversa aberta), aparece um botão que baixa a foto ou o vídeo.
 */
export class StatusDownloader {
  private host: HTMLElement;
  private timer: ReturnType<typeof setInterval> | null = null;
  private media: HTMLImageElement | HTMLVideoElement | null = null;

  constructor(private app: App) {
    this.host = h('div', { id: 'wabawebe-status-dl', style: 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483000;display:none' });
    const shadow = this.host.attachShadow({ mode: 'open' });
    shadow.append(h('style', null, PANEL_CSS), h('div', { class: 'root' }, h('button', { class: 'btn primary', onclick: () => void this.download() }, '⬇ ', t('downloadStatus'))));
  }

  start(): void {
    document.body.appendChild(this.host);
    this.timer = setInterval(() => this.scan(), 1000);
  }

  private scan(): void {
    if (!this.app.store.settings.headerButtons.downloadStatus) {
      this.host.style.display = 'none';
      return;
    }
    const candidates = Array.from(document.querySelectorAll<HTMLImageElement | HTMLVideoElement>('video, img')).filter((el) => {
      if (el.closest('#main, #side, #pane-side, #wabawebe-root')) return false;
      const r = el.getBoundingClientRect();
      const src = (el as HTMLVideoElement).currentSrc || el.getAttribute('src') || '';
      return r.width > 240 && r.height > 240 && src && !src.startsWith('data:image/svg');
    });
    this.media = candidates.sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0] ?? null;
    this.host.style.display = this.media ? 'block' : 'none';
  }

  private async download(): Promise<void> {
    const el = this.media;
    if (!el) return;
    const src = (el as HTMLVideoElement).currentSrc || el.getAttribute('src') || '';
    try {
      const blob = await (await fetch(src)).blob();
      const ext = blob.type.includes('video') ? 'mp4' : blob.type.includes('png') ? 'png' : 'jpg';
      downloadBlob(`status-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`, blob);
    } catch (e) {
      toast(`${t('error')}: ${e instanceof Error ? e.message : e}`, 'error');
    }
  }
}
