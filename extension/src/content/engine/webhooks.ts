// Fila de webhooks de saída: monta o corpo, entrega pelo background e tenta de novo quando falha.

import type { MsgEvent, QueueItem, Webhook } from '../../shared/types';
import { MSG_FETCH_FILE, MSG_HAS_PERMISSION, MSG_REQUEST_PERMISSION, MSG_WEBHOOK_FETCH, type WebhookFetchResult } from '../../shared/protocol';
import { MAX_WEBHOOK_ATTEMPTS, attachmentFromResponse, originOf, renderPayload, replyFromResponse, retryDelayMs, type WebhookData } from '../../shared/webhook';
import { uid } from '../../shared/defaults';
import { phoneFromId } from '../../shared/numbers';
import type { App } from '../app';

/** Campos como a referência os monta (app.min.js 0x90ac4). */
export function webhookDataFromMsg(app: App, ev: MsgEvent, event: string, workflowId = ''): WebhookData {
  const content = ev.body || ev.caption || '';
  const person = ev.fromMe ? ev.chatId : ev.sender;
  return {
    event,
    m_id: ev.id,
    m_type: ev.type,
    m_datetime: new Date(ev.t * 1000).toString(),
    m_timestamp: ev.t,
    m_user: person.endsWith('@lid') ? person : '',
    m_phone: phoneFromId(person) || phoneFromId(ev.chatId),
    m_content: ev.type === 'chat' ? content : `[${ev.type}] ${content}`.trim(),
    m_text: content,
    m_cname: ev.senderName || '',
    m_uname: ev.pushname || '',
    m_gname: ev.isGroup ? ev.chatName : '',
    m_gid: ev.isGroup ? ev.chatId : '',
    m_platform: ev.platform ?? '',
    w_id: workflowId,
    c_labels: ev.labels.map((l) => app.dir.labelName(l)),
    c_image: '',
    c_location: ev.lat !== undefined && ev.lng !== undefined ? { lat: ev.lat, lng: ev.lng } : '',
  };
}

export class WebhookQueue {
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;

  constructor(private app: App) {}

  start(): void {
    if (!this.timer) this.timer = setInterval(() => void this.process(), 15_000);
  }

  private hook(id: string): Webhook | undefined {
    return this.app.store.data.webhooks.find((w) => w.id === id);
  }

  enqueue(hook: Webhook, data: WebhookData, chatId?: string): void {
    const headers: Record<string, string> = {};
    for (const h of hook.headers) if (h.key.trim()) headers[h.key.trim()] = h.value;
    const item: QueueItem = {
      id: uid('q_'),
      webhookId: hook.id,
      url: hook.url,
      method: hook.method,
      headers,
      body: renderPayload(hook.payload, data),
      attempts: 0,
      nextAt: Date.now(),
      chatId,
      createdAt: Date.now(),
    };
    this.app.store.update('queue', (q) => {
      q.push(item);
      while (q.length > 2000) q.shift();
    });
  }

  /** Dispara os webhooks indicados (ativos). */
  fire(ids: string[], data: WebhookData, chatId?: string): void {
    if (this.app.offline) return;
    for (const id of ids) {
      const h = this.hook(id);
      if (h?.enabled && h.url) this.enqueue(h, data, chatId);
    }
    void this.process();
  }

  /** Mensagem nova: dispara os webhooks marcados para "toda mensagem recebida/enviada". */
  onMessage(ev: MsgEvent): void {
    if (this.app.offline) return;
    const hooks = this.app.store.data.webhooks.filter((w) => w.enabled && w.url && (ev.fromMe ? w.onOutgoing : w.onIncoming));
    if (!hooks.length) return;
    for (const h of hooks) this.enqueue(h, webhookDataFromMsg(this.app, ev, ev.fromMe ? 'message_out' : 'message_in'), ev.fromMe ? undefined : ev.chatId);
    void this.process();
  }

  async deliver(item: Pick<QueueItem, 'url' | 'method' | 'headers' | 'body'>): Promise<WebhookFetchResult> {
    return this.app.runtime.send<WebhookFetchResult>({ type: MSG_WEBHOOK_FETCH, url: item.url, method: item.method, headers: item.headers, body: item.body });
  }

  async process(force = false): Promise<void> {
    if (this.busy || (this.app.offline && !force)) return;
    this.busy = true;
    try {
      const now = Date.now();
      const due = this.app.store.data.queue.filter((q) => force || q.nextAt <= now).slice(0, 20);
      for (const item of due) {
        let res: WebhookFetchResult;
        try {
          res = await this.deliver(item);
        } catch (e) {
          res = { ok: false, status: 0, contentType: '', body: '', error: String(e) };
        }
        const hook = this.hook(item.webhookId);
        if (res.ok) {
          this.app.store.update('queue', (q) => q.filter((x) => x.id !== item.id));
          this.app.store.update('stats', (s) => void (s.webhooksOk += 1));
          if (hook?.replyFromResponse && item.chatId && !this.app.offline) await this.replyWith(hook, item.chatId, res).catch(() => null);
        } else {
          const attempts = item.attempts + 1;
          const error = res.error || `HTTP ${res.status}`;
          if (attempts >= MAX_WEBHOOK_ATTEMPTS) {
            this.app.store.update('queue', (q) => q.filter((x) => x.id !== item.id));
            this.app.store.update('stats', (s) => void (s.webhooksFailed += 1));
          } else {
            this.app.store.update('queue', (q) =>
              q.map((x) => (x.id === item.id ? { ...x, attempts, lastError: error, nextAt: Date.now() + retryDelayMs(attempts) } : x)),
            );
          }
        }
      }
    } finally {
      this.busy = false;
    }
  }

  /**
   * Resposta do webhook vira mensagem (bootstrap.min.js 0x1b884): texto no caminho replyPath e,
   * se houver, um arquivo cuja URL está em attachmentPath (enviado com o texto como legenda).
   */
  private async replyWith(hook: Webhook, chatId: string, res: WebhookFetchResult): Promise<void> {
    const text = replyFromResponse(res.body, res.contentType, hook.replyPath ?? '');
    const fileUrl = attachmentFromResponse(res.body, hook.attachmentPath ?? '');
    if (fileUrl) {
      const file = await this.app.runtime.send<{ ok: boolean; dataUrl: string; mime: string; name: string; size: number }>({ type: MSG_FETCH_FILE, url: fileUrl });
      if (file?.ok) {
        await this.app.sendResolved(chatId, { kind: 'media', text: text ?? '', media: { name: file.name, mime: file.mime, dataUrl: file.dataUrl, size: file.size } });
        return;
      }
    }
    if (text) await this.app.sendResolved(chatId, { kind: 'text', text });
  }

  async hasPermission(url: string): Promise<boolean> {
    const origin = originOf(url);
    if (!origin) return false;
    return this.app.runtime.send<boolean>({ type: MSG_HAS_PERMISSION, origin }).catch(() => false);
  }

  async requestPermission(url: string): Promise<void> {
    const origin = originOf(url);
    if (origin) await this.app.runtime.send({ type: MSG_REQUEST_PERMISSION, origin });
  }
}
