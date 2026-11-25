// Anti-apagar: guarda o conteúdo das mensagens recebidas e, quando o remetente apaga, move para "Removidas".

import type { CachedMsg, MsgEvent } from '../../shared/types';
import { loadMsgCache, saveMsgCache } from '../../shared/storage';
import { t } from '../../shared/i18n';
import type { App } from '../app';

export const CACHE_MAX_ENTRIES = 3000;
export const CACHE_MAX_MEDIA_BYTES = 40 * 1024 * 1024;
/** Limites da referência para "Removidas" (bootstrap.min.js 0x1b392): 500 itens e 50 MB (52428800). */
export const DELETED_MAX = 500;
export const DELETED_MAX_BYTES = 52_428_800;

/** Corta os mais antigos (10% por vez) até caber em 500 itens e 50 MB, como a referência. */
export function trimDeleted<T>(list: T[]): T[] {
  let out = list.length > DELETED_MAX ? list.slice(0, DELETED_MAX) : list;
  while (out.length > 1 && JSON.stringify(out).length > DELETED_MAX_BYTES) out = out.slice(0, out.length - Math.ceil(out.length / 10));
  return out;
}
const MEDIA_TYPES = ['image', 'video', 'audio', 'ptt', 'document', 'sticker'];

export class AntiDelete {
  private cache = new Map<string, CachedMsg>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private app: App) {}

  async load(): Promise<void> {
    for (const m of await loadMsgCache()) this.cache.set(m.id, m);
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.trim();
      void saveMsgCache(Array.from(this.cache.values()));
    }, 2000);
  }

  private trim(): void {
    while (this.cache.size > CACHE_MAX_ENTRIES) this.cache.delete(this.cache.keys().next().value as string);
    let bytes = 0;
    const list = Array.from(this.cache.values()).reverse(); // mais novas primeiro
    for (const m of list) {
      if (!m.mediaDataUrl) continue;
      bytes += m.mediaDataUrl.length;
      if (bytes > CACHE_MAX_MEDIA_BYTES) delete m.mediaDataUrl;
    }
  }

  onMessage(ev: MsgEvent): void {
    const cfg = this.app.store.settings.antiDelete;
    if (!cfg.enabled || ev.fromMe) return;
    const entry: CachedMsg = {
      id: ev.id,
      chatId: ev.chatId,
      chatName: ev.chatName,
      sender: ev.sender,
      senderName: ev.senderName || ev.pushname,
      type: ev.type,
      body: ev.body,
      caption: ev.caption,
      mime: ev.mime,
      filename: ev.filename,
      lat: ev.lat,
      lng: ev.lng,
      t: ev.t,
    };
    this.cache.set(ev.id, entry);
    const maxBytes = Math.max(0, cfg.maxMediaKb) * 1024;
    if (MEDIA_TYPES.includes(ev.type) && maxBytes > 0 && (!ev.size || ev.size <= maxBytes)) {
      this.app.bridge
        .call<string | null>('cacheMedia', { id: ev.id, maxBytes }, 120_000)
        .then((dataUrl) => {
          if (dataUrl && this.cache.has(ev.id)) {
            this.cache.get(ev.id)!.mediaDataUrl = dataUrl;
            this.scheduleSave();
          }
        })
        .catch(() => null);
    }
    this.scheduleSave();
  }

  onRevoke(r: { id: string; chatId: string }): void {
    const m = this.cache.get(r.id);
    if (!m) return;
    this.cache.delete(r.id);
    this.scheduleSave();
    if (this.app.store.data.deleted.some((d) => d.id === m.id)) return;
    this.app.store.update('deleted', (list) => trimDeleted([{ ...m, deletedAt: Date.now() }, ...list.filter((d) => d.id !== m.id)]));
    this.app.store.update('stats', (s) => void (s.deletedCaught += 1));
    const preview = (m.body || m.caption || `[${m.type}]`).slice(0, 80);
    this.app.ui.toast(`${t('deletedTitle')}: ${m.senderName || m.chatName} — ${preview}`);
  }
}
