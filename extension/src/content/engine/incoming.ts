// "Webhook de entrada" sem servidor nosso: a extensão busca, de tempos em tempos, numa URL SUA
// as mensagens que outro sistema quer mandar, envia pelo WhatsApp Web e (opcional) avisa o resultado.
// (A referência fazia isso por um servidor dela; aqui é você quem hospeda a fila.)

import { MSG_FETCH_FILE, MSG_WEBHOOK_FETCH, type WebhookFetchResult } from '../../shared/protocol';
import { incomingTarget, parseIncoming } from '../../shared/extras';
import type { App } from '../app';

export const INCOMING_MIN_INTERVAL_SEC = 10;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class IncomingPoller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;

  constructor(private app: App) {}

  start(): void {
    const loop = async () => {
      const cfg = this.app.store.settings.incoming;
      const every = Math.max(INCOMING_MIN_INTERVAL_SEC, cfg.intervalSec || 30) * 1000;
      if (cfg.enabled && cfg.url && !this.app.offline && this.app.pageReady && Date.now() - cfg.lastRunAt >= every - 500) await this.runOnce().catch(() => null);
      this.timer = setTimeout(loop, 5000);
    };
    if (!this.timer) this.timer = setTimeout(loop, 5000);
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {};
    for (const x of this.app.store.settings.incoming.headers) if (x.key.trim()) h[x.key.trim()] = x.value;
    return h;
  }

  /** Busca uma vez e envia o que vier. Devolve quantas mensagens foram enviadas. */
  async runOnce(): Promise<number> {
    if (this.busy) return 0;
    this.busy = true;
    const cfg = this.app.store.settings.incoming;
    let sent = 0;
    let error = '';
    try {
      const res = await this.app.runtime.send<WebhookFetchResult>({ type: MSG_WEBHOOK_FETCH, url: cfg.url, method: 'GET', headers: this.headers(), body: '' });
      if (!res?.ok) throw new Error(res?.error || `HTTP ${res?.status}`);
      const items = parseIncoming(JSON.parse(res.body || '[]'));
      const results: { id: string; to: string; ok: boolean; error?: string }[] = [];
      for (const it of items) {
        const target = incomingTarget(it.to);
        if (!target) {
          results.push({ id: it.id, to: it.to, ok: false, error: 'invalid_number' });
          continue;
        }
        try {
          let chatId = target;
          if (target.endsWith('@c.us')) {
            const q = await this.app.bridge.call<{ exists: boolean; id: string }>('queryExists', { phone: target.split('@')[0] });
            if (!q.exists) throw new Error('not_on_whatsapp');
            chatId = q.id || target;
          }
          if (it.fileUrl) {
            const f = await this.app.runtime.send<{ ok: boolean; dataUrl: string; mime: string; name: string; size: number; error?: string }>({ type: MSG_FETCH_FILE, url: it.fileUrl });
            if (!f?.ok) throw new Error(f?.error || 'file');
            await this.app.sendResolved(chatId, { kind: 'media', text: it.text, media: { name: it.filename || f.name, mime: f.mime, dataUrl: f.dataUrl, size: f.size } });
          } else await this.app.sendResolved(chatId, { kind: 'text', text: it.text });
          results.push({ id: it.id, to: it.to, ok: true });
          sent++;
          await sleep(1500);
        } catch (e) {
          results.push({ id: it.id, to: it.to, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
      if (cfg.ackUrl && results.length)
        await this.app.runtime
          .send({ type: MSG_WEBHOOK_FETCH, url: cfg.ackUrl, method: 'POST', headers: { 'Content-Type': 'application/json', ...this.headers() }, body: JSON.stringify({ results }) })
          .catch(() => null);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      this.busy = false;
      this.app.store.update('settings', (s) => {
        s.incoming.lastRunAt = Date.now();
        s.incoming.lastError = error;
        s.incoming.received += sent;
      });
    }
    return sent;
  }
}
