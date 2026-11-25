// Botões extras no cabeçalho da conversa aberta e respostas rápidas no campo de mensagem.

import { t } from '../../shared/i18n';
import { h, clear } from '../ui/h';
import { icon, type IconName } from '../ui/icons';
import { PANEL_CSS } from '../ui/styles';
import { popupMenu, toast } from '../ui/components';
import { isWhatsAppDark } from '../ui/panel';
import { openNewChatDialog, openSaveContactDialog } from '../ui/views/tools';
import { openTaskEditor } from '../ui/views/tasks';
import { sendTemplateToActive } from '../ui/views/templates';
import { templateSummary, resolveTemplate } from '../resolve';
import { COUNTRY_DIAL, dialCodeOf, flagOf } from '../../shared/numbers';
import { countryName } from '../ui/pickers';
import type { App } from '../app';

export class HeaderButtons {
  private host: HTMLElement | null = null;
  private bar: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private app: App) {}

  start(): void {
    this.observer = new MutationObserver(() => this.schedule());
    const main = document.getElementById('app') ?? document.body;
    this.observer.observe(main, { childList: true, subtree: true });
    this.app.store.subscribe((f) => {
      if (f === 'settings' || f === '*') {
        this.ensure();
        this.render();
      }
    });
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.ensure();
    }, 400);
  }

  private anyEnabled(): boolean {
    const hb = this.app.store.settings.headerButtons;
    return hb.readUnread || hb.pin || hb.quickLabel || hb.saveContact || hb.sendTemplate || hb.addTask || hb.like || hb.chatInfo || hb.aiSuggest || hb.newChat || hb.runAutomation;
  }

  private ensure(): void {
    // nada ligado: não coloca nada dentro do WhatsApp
    if (!this.anyEnabled()) {
      this.host?.remove();
      this.host = null;
      this.bar = null;
      return;
    }
    const header = document.querySelector('#main header');
    if (!header) return;
    if (this.host && header.contains(this.host)) return;
    this.host = h('div', { id: 'wabawebe-header', style: 'display:flex;align-items:center;margin:0 4px;flex-shrink:0' });
    const shadow = this.host.attachShadow({ mode: 'open' });
    shadow.append(h('style', null, PANEL_CSS));
    this.bar = h('div', { class: 'hbar' });
    shadow.append(this.bar);
    // fica antes dos botões nativos (último bloco do cabeçalho)
    const last = header.lastElementChild;
    if (last) header.insertBefore(this.host, last);
    else header.appendChild(this.host);
    this.render();
  }

  private chatId(): string | null {
    return this.app.activeChatId;
  }

  private render(): void {
    if (!this.bar) return;
    clear(this.bar);
    this.bar.classList.toggle('dark', isWhatsAppDark());
    const hb = this.app.store.settings.headerButtons;
    const add = (on: boolean, ic: IconName, title: string, fn: (e: MouseEvent) => void) => {
      if (on) this.bar!.append(h('button', { title, onclick: fn }, icon(ic, 19)));
    };
    const call = (method: string, params: unknown) =>
      this.app.bridge.call(method, params).then(() => toast(t('done'), 'ok')).catch((e) => toast(`${t('error')}: ${e instanceof Error ? e.message : e}`, 'error'));
    add(hb.readUnread, 'readToggle', `${t('hbMarkRead')} / ${t('hbMarkUnread')}`, () => {
      const id = this.chatId();
      if (id) void call('chatAction', { chatId: id, action: 'toggleRead' });
    });
    add(hb.pin, 'pin', t('hbPin'), () => {
      // como a referência (toggleActiveChatPin): fixa só neste navegador, sem o limite de 3 do WhatsApp
      const id = this.chatId();
      if (!id || !this.app.localPins) return;
      const on = this.app.localPins.toggle(id);
      toast(on ? t('pinnedLocal') : t('unpinnedLocal'), 'ok');
    });
    add(hb.newChat, 'chat', t('newChat'), () => openNewChatDialog(this.app));
    add(hb.runAutomation, 'automations', t('runNow'), (e) => {
      const id = this.chatId();
      if (!id) return;
      popupMenu(e.clientX - 200, e.clientY + 12, this.app.store.data.automations.map((a) => ({
        label: a.name,
        sub: a.enabled ? t('enabled') : t('disabled'),
        onClick: () => void this.app.runAutomationNow(a, id).then(() => toast(t('done'), 'ok')).catch((err) => toast(String(err), 'error')),
      })), t('empty'));
    });
    add(hb.quickLabel, 'label', t('hbLabel'), async (e) => {
      const id = this.chatId();
      if (!id) return;
      await this.app.dir.refresh(true).catch(() => null);
      const info = await this.app.contactCtx(id);
      popupMenu(e.clientX, e.clientY + 12, this.app.dir.labels.map((l) => {
        const has = info.labels.includes(l.id);
        return { label: `${has ? '✓ ' : ''}${l.name}`, onClick: () => void call('labelChats', { chatIds: [id], add: has ? [] : [l.id], remove: has ? [l.id] : [] }) };
      }), t('noLabels'));
    });
    add(hb.saveContact, 'userPlus', t('hbSave'), () => {
      this.app.ui.openPanel();
      void openSaveContactDialog(this.app, this.chatId() ?? undefined);
    });
    add(hb.sendTemplate, 'templates', t('hbTemplate'), (e) => {
      popupMenu(e.clientX, e.clientY + 12, this.app.store.data.templates.map((tpl) => ({ label: tpl.name, sub: templateSummary(tpl), onClick: () => void sendTemplateToActive(this.app, tpl) })), t('needTemplates'));
    });
    add(hb.addTask, 'tasks', t('hbTask'), () => {
      this.app.ui.openPanel('tasks');
      void openTaskEditor(this.app, undefined, this.chatId() ?? undefined);
    });
    add(hb.like, 'like', t('hbLike'), () => {
      const id = this.chatId();
      if (id) void call('chatAction', { chatId: id, action: 'like' });
    });
    add(hb.chatInfo, 'info', t('hbChatInfo'), async (e) => {
      const id = this.chatId();
      if (!id) return;
      await this.app.dir.refresh().catch(() => null);
      const info = await this.app.contactCtx(id);
      const code = dialCodeOf(info.phone);
      const isos = code ? Object.entries(COUNTRY_DIAL).filter(([, d]) => d === code).map(([iso]) => iso) : [];
      const entries = [
        { label: `${t('chatInfoNumber')}: ${info.phone ? `+${info.phone}` : '—'}`, onClick: () => void navigator.clipboard.writeText(info.phone) },
        { label: `${t('chatInfoCountry')}: ${isos.length ? isos.map((i) => `${flagOf(i)} ${countryName(i)}`).join(' / ') : '—'}`, onClick: () => undefined },
        { label: `${t('chatInfoSaved')}: ${info.isMyContact ? t('yes') : t('no')}`, sub: info.name || info.pushname, onClick: () => undefined },
        { label: `${t('chatInfoLabels')}: ${info.labels.map((l) => this.app.dir.labelName(l)).join(', ') || '—'}`, onClick: () => undefined },
      ];
      popupMenu(e.clientX - 200, e.clientY + 12, entries);
    });
    add(hb.aiSuggest, 'bolt', t('aiSuggest'), async () => {
      const id = this.chatId();
      if (!id) return;
      toast(t('aiWorking'));
      try {
        const text = await this.app.ai.replyFor(id);
        await this.app.bridge.call('setInputText', { text });
        toast(t('aiSuggested'), 'ok');
      } catch (err) {
        toast(`${t('error')}: ${err instanceof Error ? err.message : err}`, 'error');
      }
    });
  }
}

/**
 * Botões "Traduzir" e "Transcrever" que aparecem ao passar o mouse numa mensagem (como os da
 * referência, bootstrap.min.js 0x17df5). O resultado aparece embaixo da própria mensagem.
 */
export class MessageAiButtons {
  private host: HTMLElement;
  private bar: HTMLElement;
  private current: HTMLElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private app: App) {
    this.host = h('div', { id: 'wabawebe-msgai', style: 'position:fixed;z-index:2147482998;display:none' });
    const shadow = this.host.attachShadow({ mode: 'open' });
    shadow.append(h('style', null, PANEL_CSS));
    this.bar = h('div', { class: 'root' });
    shadow.append(this.bar);
    this.host.addEventListener('mouseenter', () => this.hideTimer && clearTimeout(this.hideTimer));
    this.host.addEventListener('mouseleave', () => this.scheduleHide());
  }

  start(): void {
    document.body.appendChild(this.host);
    document.addEventListener('mouseover', (e) => this.onOver(e), true);
  }

  private scheduleHide(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.host.style.display = 'none';
      this.current = null;
    }, 600);
  }

  private onOver(e: MouseEvent): void {
    const hb = this.app.store.settings.headerButtons;
    const restoreOn = this.app.store.settings.antiDelete.enabled && this.app.store.data.deleted.length > 0;
    if (!hb.translate && !hb.transcribe && !restoreOn) return;
    const target = e.target as HTMLElement | null;
    const row = target?.closest?.('#main [data-id]') as HTMLElement | null;
    if (!row) return;
    if (row === this.current) {
      if (this.hideTimer) clearTimeout(this.hideTimer);
      return;
    }
    const id = row.getAttribute('data-id') ?? '';
    if (!id || !/@(c\.us|g\.us|lid)/.test(id)) return;
    this.current = row;
    if (this.hideTimer) clearTimeout(this.hideTimer);
    row.addEventListener('mouseleave', () => this.scheduleHide(), { once: true });
    const isAudio = !!row.querySelector('audio, [data-icon*="audio"], [data-icon*="ptt"], [aria-label*="áudio" i], [aria-label*="voice" i]');
    clear(this.bar);
    const box = h('div', { class: 'hbar', style: 'background:var(--bg);border:1px solid var(--line);border-radius:99px;box-shadow:var(--shadow);padding:2px' });
    const run = (label: string, fn: () => Promise<string>) =>
      h('button', {
        title: label,
        style: 'width:auto;padding:0 10px;border-radius:99px;font:600 12px system-ui;color:var(--fg)',
        onclick: async () => {
          toast(t('aiWorking'));
          try {
            this.showResult(row, await fn());
          } catch (err) {
            toast(`${t('error')}: ${err instanceof Error ? err.message : err}`, 'error');
          }
        },
      }, label);
    if (hb.translate) box.append(run(t('aiTranslate'), async () => {
      const info = await this.app.bridge.call<{ text: string } | null>('messageInfo', { id });
      if (!info?.text) throw new Error(t('empty'));
      return this.app.ai.translate(info.text);
    }));
    if (hb.transcribe && isAudio) box.append(run(t('aiTranscribe'), () => this.app.ai.transcribe(id)));
    // mensagem apagada que foi guardada: "Restaurar" mostra o conteúdo ali mesmo (e baixa a mídia),
    // como o botão de restaurar da referência
    const deleted = restoreOn ? this.app.store.data.deleted.find((d) => d.id === id) : undefined;
    if (deleted)
      box.append(
        h('button', {
          title: t('restoreHere'),
          style: 'width:auto;padding:0 10px;border-radius:99px;font:600 12px system-ui;color:var(--fg)',
          onclick: () => {
            this.showResult(row, deleted.body || deleted.caption || `[${deleted.type}]`);
            if (deleted.mediaDataUrl) {
              const a = document.createElement('a');
              a.href = deleted.mediaDataUrl;
              a.download = deleted.filename || `${deleted.type}-${deleted.id.slice(-8)}`;
              document.body.appendChild(a);
              a.click();
              a.remove();
            }
          },
        }, t('restoreHere')),
      );
    if (!box.children.length) return;
    this.bar.append(box);
    const r = row.getBoundingClientRect();
    this.host.style.left = `${Math.max(8, Math.min(r.right - 180, innerWidth - 200))}px`;
    this.host.style.top = `${Math.max(8, r.top - 14)}px`;
    this.host.style.display = 'block';
  }

  private showResult(row: HTMLElement, text: string): void {
    row.querySelector('.wabawebe-ai-result')?.remove();
    const bubble = row.querySelector('.message-in, .message-out, [class*="message-"]') ?? row;
    const div = document.createElement('div');
    div.className = 'wabawebe-ai-result';
    div.style.cssText = 'font-size:12.5px;line-height:1.4;padding:6px 10px 8px;margin-top:6px;border-top:1px solid rgba(0,0,0,.12);white-space:pre-wrap;opacity:.9';
    div.textContent = `✨ ${text}`;
    bubble.appendChild(div);
  }
}

/**
 * Barra de respostas rápidas acima do campo de mensagem (como a referência, bootstrap.min.js 0x9bcf):
 * um botão por modelo marcado como resposta rápida; o que não cabe vai para "Mais", com busca.
 * Clicar envia o modelo na conversa aberta; o botão fica destacado por 2 s.
 */
export class QuickReplyBar {
  private host: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private resize: ResizeObserver | null = null;

  constructor(private app: App) {}

  start(): void {
    new MutationObserver(() => this.schedule()).observe(document.getElementById('app') ?? document.body, { childList: true, subtree: true });
    this.app.store.subscribe((f) => {
      if (f === 'settings' || f === 'templates' || f === '*') {
        this.host?.remove();
        this.host = null;
        this.schedule();
      }
    });
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.ensure();
    }, 400);
  }

  private ensure(): void {
    const footer = document.querySelector('#main footer');
    const items = this.app.store.data.templates.filter((x) => x.quick);
    if (!footer || !this.app.store.settings.quickReplies || !items.length) {
      if (this.host && !footer?.contains(this.host)) this.host = null;
      if (!this.app.store.settings.quickReplies || !items.length) this.host?.remove();
      return;
    }
    if (this.host && footer.contains(this.host)) return;
    this.host = h('div', { id: 'wabawebe-quickbar', style: 'display:block;width:100%' });
    const shadow = this.host.attachShadow({ mode: 'open' });
    shadow.append(h('style', null, PANEL_CSS));
    const root = h('div', { class: `root ${isWhatsAppDark() ? 'dark' : ''}` });
    const bar = h('div', { class: 'qbar' });
    const moreList = h('div', { class: 'qmore-items' });
    const search = h('input', { type: 'search', placeholder: t('search') }) as HTMLInputElement;
    const menu = h('div', { class: 'qmore-menu' }, h('div', { style: 'padding:6px' }, search), moreList);
    const moreBtn = h('button', { class: 'qpill qmore-btn', type: 'button' }, t('showMore'), ' ▾');
    const moreWrap = h('div', { class: 'qmore' }, moreBtn, menu);
    moreBtn.addEventListener('click', () => {
      menu.classList.toggle('open');
      if (menu.classList.contains('open')) setTimeout(() => search.focus(), 0);
    });
    const filter = () => {
      const q = search.value.trim().toLowerCase();
      moreList.querySelectorAll<HTMLElement>('.qpill').forEach((p) => (p.style.display = !q || (p.textContent ?? '').toLowerCase().includes(q) ? '' : 'none'));
    };
    search.addEventListener('input', filter);
    const pills = items.map((tpl) => {
      const p = h('button', { class: 'qpill', type: 'button', title: templateSummary(tpl) }, tpl.name);
      p.addEventListener('click', () => {
        p.classList.add('active');
        setTimeout(() => p.classList.remove('active'), 2000);
        menu.classList.remove('open');
        void sendTemplateToActive(this.app, tpl);
      });
      return p;
    });
    bar.append(...pills, moreWrap);
    root.append(bar);
    shadow.append(root);
    footer.prepend(this.host);

    // distribui: o que cabe fica na barra, o resto vai para "Mais"
    const layout = () => {
      pills.forEach((p) => bar.insertBefore(p, moreWrap));
      moreWrap.style.display = '';
      const avail = bar.clientWidth - moreBtn.getBoundingClientRect().width - 16;
      let used = 0;
      for (const p of pills) {
        const w = p.getBoundingClientRect().width + 6;
        if (used + w <= avail) used += w;
        else moreList.appendChild(p);
      }
      moreWrap.style.display = moreList.children.length ? '' : 'none';
      filter();
    };
    this.resize?.disconnect();
    this.resize = new ResizeObserver(() => layout());
    this.resize.observe(bar);
    layout();
  }
}

/** Respostas rápidas: digitar "/" no início do campo de mensagem abre a lista de modelos. */
export class QuickReplies {
  private close: (() => void) | null = null;

  constructor(private app: App) {}

  start(): void {
    document.addEventListener('keyup', (e) => this.onKey(e), true);
  }

  private composer(target: EventTarget | null): HTMLElement | null {
    const el = target as HTMLElement | null;
    if (!el?.closest) return null;
    return el.closest('#main footer [contenteditable="true"]');
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.app.store.settings.quickReplies) return;
    const box = this.composer(e.target);
    if (!box) return;
    const text = (box.innerText || '').replace(/\n$/, '');
    if (!text.startsWith('/') || text.includes('\n')) {
      this.close?.();
      this.close = null;
      return;
    }
    if (e.key === 'Escape') {
      this.close?.();
      this.close = null;
      return;
    }
    const q = text.slice(1).toLowerCase();
    const list = this.app.store.data.templates.filter((x) => x.quick && (!q || x.name.toLowerCase().includes(q))).slice(0, 12);
    this.close?.();
    const r = box.getBoundingClientRect();
    this.close = popupMenu(r.left, r.top - Math.min(320, 40 + list.length * 46), list.map((tpl) => ({
      label: tpl.name,
      sub: templateSummary(tpl),
      onClick: () => void this.use(tpl.id),
    })), t('noTemplates'));
  }

  async use(templateId: string): Promise<void> {
    this.close = null;
    const tpl = this.app.template(templateId);
    const chatId = this.app.activeChatId;
    if (!tpl || !chatId) return;
    const vars = await this.app.varsFor(chatId);
    try {
      if (tpl.kind === 'text') await this.app.bridge.call('setInputText', { text: resolveTemplate(tpl, vars).text });
      else {
        await this.app.bridge.call('setInputText', { text: '' });
        await this.app.sendTemplate(chatId, tpl, vars);
      }
    } catch (err) {
      toast(`${t('error')}: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }
}
