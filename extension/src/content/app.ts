// Contexto compartilhado do content script: estado, ponte, listas e utilidades de envio.

import type { Automation, ResolvedMessage, Template } from '../shared/types';
import type { VarContext } from '../shared/variables';
import { phoneFromId } from '../shared/numbers';
import type { Bridge } from './bridge';
import { Directory } from './directory';
import { dynamicImageUrl, resolveTemplate } from './resolve';
import { MSG_FETCH_FILE, MSG_WEBHOOK_FETCH } from '../shared/protocol';
import { firstUrl, parseOpenGraph } from '../shared/extras';
import type { AiClient } from './engine/ai';
import type { Store } from './store';

export interface RuntimeLike {
  send<T = any>(msg: unknown): Promise<T>;
}

export interface UiHooks {
  toast(text: string, kind?: 'info' | 'ok' | 'error'): void;
  openPanel(tab?: string, payload?: unknown): void;
  togglePanel(): void;
}

export interface ContactCtx {
  id: string;
  name: string;
  pushname: string;
  phone: string;
  isMyContact: boolean;
  isGroup: boolean;
  groupName: string;
  chatName: string;
  labels: string[];
  archived: boolean;
  pinned: boolean;
  unread: number;
}

export class App {
  dir: Directory;
  ui: UiHooks = {
    toast: (t) => console.info('[WABA WEBE]', t),
    openPanel: () => undefined,
    togglePanel: () => undefined,
  };
  activeChatId: string | null = null;
  pageReady = false;
  /** IA com Gemini (definida no boot). */
  ai!: AiClient;
  /** Fixar conversas sem limite (definido no boot). */
  localPins?: { toggle(chatId: string): boolean };
  /** Webhook de entrada por consulta (definido no boot). */
  incoming?: { runOnce(): Promise<number> };
  /** Liga a tela de automações ao motor (definido no boot). */
  runAutomationNow: (a: Automation, chatId: string) => Promise<void> = async () => undefined;

  constructor(
    public store: Store,
    public bridge: Bridge,
    public runtime: RuntimeLike,
  ) {
    this.dir = new Directory(bridge);
  }

  get offline(): boolean {
    return this.store.settings.offline;
  }

  template(id: string): Template | undefined {
    return this.store.data.templates.find((t) => t.id === id);
  }

  async contactCtx(id: string): Promise<ContactCtx> {
    try {
      return await this.bridge.call<ContactCtx>('contactInfo', { id });
    } catch {
      return {
        id,
        name: '',
        pushname: '',
        phone: phoneFromId(id),
        isMyContact: false,
        isGroup: id.endsWith('@g.us'),
        groupName: '',
        chatName: '',
        labels: [],
        archived: false,
        pinned: false,
        unread: 0,
      };
    }
  }

  /** Variáveis para uma conversa. Em grupos, o "contato" é quem mandou a mensagem (senderId). */
  async varsFor(chatId: string, extra: Partial<VarContext> & { senderId?: string } = {}): Promise<VarContext> {
    const chat = await this.contactCtx(chatId);
    const person = extra.senderId && extra.senderId !== chatId ? await this.contactCtx(extra.senderId) : chat;
    return {
      contactName: person.name || undefined,
      waName: person.pushname || undefined,
      phone: person.phone,
      groupName: chat.isGroup ? chat.groupName || chat.chatName : '',
      ...extra,
    };
  }

  async sendResolved(chatId: string, msg: ResolvedMessage, opts: { quotedMsgId?: string; typingMs?: number; mentionAll?: boolean } = {}): Promise<string> {
    const r = await this.bridge.call<{ id: string }>('sendMessage', { chatId, msg, ...opts }, 180_000);
    return r?.id ?? '';
  }

  async sendTemplate(chatId: string, tpl: Template, ctx: VarContext, opts: { quotedMsgId?: string; typingMs?: number; mentionAll?: boolean } = {}): Promise<string> {
    const msg = resolveTemplate(tpl, ctx);
    if (tpl.kind === 'dynamicImage') {
      // imagem dinâmica: URL montada com variáveis (inclui ${profilePicture}) e baixada na hora
      const profilePicture = /\$\{\s*profilePicture\s*\}/.test(tpl.dynamicImage?.url ?? '') ? await this.bridge.call<string>('profilePicture', { id: chatId }).catch(() => '') : '';
      const url = dynamicImageUrl(tpl, { ...ctx, profilePicture });
      const file = await this.runtime.send<{ ok: boolean; dataUrl: string; mime: string; name: string; size: number; error?: string }>({ type: MSG_FETCH_FILE, url });
      if (!file?.ok) throw new Error(`imagem: ${file?.error ?? 'erro'}`);
      return this.sendResolved(chatId, { kind: 'media', text: msg.text, media: { name: file.name || 'imagem.jpg', mime: file.mime, dataUrl: file.dataUrl, size: file.size } }, opts);
    }
    if (tpl.kind === 'text' && tpl.linkPreview) msg.linkPreview = (await this.buildLinkPreview(msg.text)) ?? undefined;
    return this.sendResolved(chatId, msg, opts);
  }

  /**
   * Prévia de link montada no próprio navegador: lê o título/descrição/imagem da página (Open Graph).
   * Só funciona para sites que você permitiu; sem permissão, a mensagem segue sem prévia.
   */
  async buildLinkPreview(text: string): Promise<ResolvedMessage['linkPreview'] | null> {
    const url = firstUrl(text);
    if (!url) return null;
    try {
      const page = await this.runtime.send<{ ok: boolean; body: string }>({ type: MSG_WEBHOOK_FETCH, url, method: 'GET', headers: {}, body: '' });
      if (!page?.ok) return null;
      const og = parseOpenGraph(page.body, url);
      if (!og.title) return null;
      let thumbnail: string | undefined;
      if (og.image) {
        const img = await this.runtime.send<{ ok: boolean; dataUrl: string }>({ type: MSG_FETCH_FILE, url: og.image }).catch(() => null);
        if (img?.ok && img.dataUrl.length < 400_000) thumbnail = img.dataUrl.replace(/^data:[^,]*,/, '');
      }
      return { title: og.title, description: og.description, canonicalUrl: url, matchedText: url, thumbnail };
    } catch {
      return null;
    }
  }

  /** Notificação do navegador (usa a permissão do próprio WhatsApp Web) + aviso no painel. */
  notify(title: string, body: string): void {
    this.ui.toast(`${title}: ${body}`);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body, tag: `ww-${title}`, silent: false });
      }
    } catch {
      /* ignora */
    }
  }
}
