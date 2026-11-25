// Lembretes de tarefas e avisos de online/digitando de contatos escolhidos.

import { t } from '../../shared/i18n';
import type { App } from '../app';

export class Reminders {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private app: App) {}

  start(): void {
    if (!this.timer) this.timer = setInterval(() => this.check(), 30_000);
    this.check();
  }

  check(): void {
    const now = Date.now();
    const due = this.app.store.data.tasks.filter((x) => !x.done && x.notify && !x.notified && x.due && x.due <= now);
    if (!due.length) return;
    for (const task of due) this.app.notify(`${t('reminder')} — ${task.chatName || ''}`.trim(), task.title);
    const ids = new Set(due.map((d) => d.id));
    this.app.store.update('tasks', (list) => list.map((x) => (ids.has(x.id) ? { ...x, notified: true } : x)));
  }
}

export class PresenceWatch {
  private online = new Map<string, boolean>();
  private lastState = new Map<string, string>();
  private subscribed = '';

  constructor(private app: App) {}

  async subscribe(): Promise<void> {
    const ids = this.app.store.settings.watch.chatIds.filter((id) => id.endsWith('@c.us') || id.endsWith('@lid'));
    const key = ids.join(',');
    if (key === this.subscribed || !this.app.pageReady) return;
    this.subscribed = key;
    await this.app.bridge.call('subscribePresence', { ids }).catch(() => null);
  }

  onPresence(p: { id: string; isOnline: boolean; state: string; name: string }): void {
    const w = this.app.store.settings.watch;
    const cz = this.app.store.settings.customizations;
    const watched = w.chatIds.includes(p.id);
    // personalizações da referência: avisar de QUALQUER conversa conhecida (online/offline, digitando/gravando)
    const anyOnline = cz.notifyOnlineActivities && !p.id.endsWith('@g.us');
    const anyTyping = cz.notifyTypingRecordingActivities && !p.id.endsWith('@g.us');
    if (!watched && !anyOnline && !anyTyping) return;
    const name = p.name || this.app.dir.nameOf(p.id);
    const was = this.online.get(p.id) ?? false;
    this.online.set(p.id, p.isOnline);
    if (((watched && w.online) || anyOnline) && p.isOnline && !was) this.app.notify(t('navWatch'), t('isOnline', { name }));
    if (anyOnline && !p.isOnline && was) this.app.notify(t('navWatch'), t('isOffline', { name }));
    const prev = this.lastState.get(p.id);
    this.lastState.set(p.id, p.state);
    if (((watched && w.typing) || anyTyping) && p.state !== prev) {
      if (p.state === 'composing' || p.state === 'typing') this.app.notify(t('navWatch'), t('isTyping', { name }));
      else if (p.state === 'recording') this.app.notify(t('navWatch'), t('isRecording', { name }));
    }
  }
}
