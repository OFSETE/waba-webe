// Executa as transmissões: monta destinatários, respeita intervalos/horários e faz as ações pós-envio.

import type { Broadcast, BroadcastTargets, Recipient, TargetSelection } from '../../shared/types';
import { COUNTRY_DIAL, dialCodeOf, parsePastedNumbers, phoneFromId, rowsToRecipients, toUserId } from '../../shared/numbers';
import { BETWEEN_TEMPLATES_MS, decide, nextRepeatStart, pickTemplates, randomDelayMs } from '../../shared/scheduler';
import type { App } from '../app';
import type { WebhookQueue } from './webhooks';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function select<T extends { id: string }>(all: T[], sel: TargetSelection): T[] {
  switch (sel.mode) {
    case 'all':
      return all;
    case 'allExcept':
      return all.filter((x) => !sel.ids.includes(x.id));
    case 'only':
      return all.filter((x) => sel.ids.includes(x.id));
    default:
      return [];
  }
}

export class BroadcastRunner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;

  constructor(
    private app: App,
    private webhooks: WebhookQueue,
  ) {}

  start(): void {
    if (!this.timer) this.timer = setInterval(() => void this.tick(), 2000);
  }

  private get(id: string): Broadcast | undefined {
    return this.app.store.data.broadcasts.find((b) => b.id === id);
  }

  private patch(id: string, change: Partial<Broadcast> | ((b: Broadcast) => Partial<Broadcast>)): void {
    this.app.store.update('broadcasts', (list) => list.map((b) => (b.id === id ? { ...b, ...(typeof change === 'function' ? change(b) : change) } : b)));
  }

  /** Lista final de destinatários, sem repetidos e sem o próprio número. */
  async buildRecipients(tg: BroadcastTargets): Promise<Recipient[]> {
    const app = this.app;
    await app.dir.refresh(true);
    const out = new Map<string, Recipient>();
    const add = (id: string, columns?: string[]) => {
      if (id && !out.has(id)) out.set(id, { id, columns, status: 'pending' });
    };
    const me = await app.bridge.call<{ me: string }>('status').then((s) => s.me).catch(() => '');

    // origem dos contatos (opções da referência): salvos, salvos que já conversaram, não salvos que já conversaram
    const saved = new Set(app.dir.contacts.filter((c) => c.isMyContact).map((c) => c.id));
    const source = tg.contacts.source ?? 'saved';
    const users: { id: string }[] =
      source === 'saved'
        ? app.dir.contacts.filter((c) => c.isMyContact)
        : app.dir.chats.filter((c) => !c.isGroup && !c.isBroadcast && (source === 'chatted' ? saved.has(c.id) : !saved.has(c.id)));
    for (const c of select(users, tg.contacts)) add(c.id);

    for (const g of select(app.dir.groups, tg.groups)) {
      if (!tg.groups.members) add(g.id);
      else {
        const parts = await app.bridge.call<{ id: string }[]>('groupParticipants', { id: g.id }).catch(() => []);
        for (const p of parts) add(p.id);
      }
    }

    if (tg.labels.mode !== 'none') {
      const labelIds = select(app.dir.labels, tg.labels).map((l) => l.id);
      for (const c of app.dir.chats) if (c.labels.some((l) => labelIds.includes(l))) add(c.id);
    }

    for (const l of select(app.dir.broadcastLists, tg.lists)) {
      if (!tg.lists.members) add(l.id);
      else {
        const ids = await app.bridge.call<string[]>('broadcastMembers', { id: l.id }).catch(() => []);
        for (const id of ids) add(id);
      }
    }

    if (tg.countries.mode !== 'none') {
      const isos = Object.keys(COUNTRY_DIAL);
      const chosen = select(
        isos.map((id) => ({ id })),
        tg.countries,
      ).map((x) => COUNTRY_DIAL[x.id]);
      const codes = new Set(chosen);
      const people = new Map<string, string>();
      for (const c of app.dir.contacts) if (c.phone) people.set(c.id, c.phone);
      for (const c of app.dir.chats) if (!c.isGroup && !c.isBroadcast && c.id.endsWith('@c.us')) people.set(c.id, phoneFromId(c.id));
      for (const [id, phone] of people) {
        const code = dialCodeOf(phone);
        if (code && codes.has(code)) add(id);
      }
    }

    if (tg.sheet.rows.length) {
      const { recipients } = rowsToRecipients(tg.sheet.rows, { format: tg.sheet.numberFormat, ddi: tg.sheet.ddi });
      for (const r of recipients) add(toUserId(r.phone), r.columns);
    }

    for (const n of parsePastedNumbers(tg.pasted)) add(toUserId(n), [n]);

    out.delete(me);
    out.delete('status@broadcast');
    return Array.from(out.values());
  }

  async launch(id: string): Promise<number> {
    const b = this.get(id);
    if (!b) return 0;
    const recipients = await this.buildRecipients(b.targets);
    const startAt = b.schedule.startAt && b.schedule.startAt > Date.now() ? b.schedule.startAt : null;
    // a referência espera o intervalo aleatório ANTES de cada envio, inclusive o primeiro
    const firstAt = (startAt ?? Date.now()) + randomDelayMs(b.intervalMin, b.intervalMax);
    this.patch(id, {
      recipients,
      cursor: 0,
      nextAt: firstAt,
      runs: 1,
      status: recipients.length ? (startAt ? 'scheduled' : 'running') : 'draft',
      startedAt: startAt ?? Date.now(),
      finishedAt: undefined,
      lastError: undefined,
    });
    return recipients.length;
  }

  pause(id: string): void {
    this.patch(id, { status: 'paused' });
  }

  resume(id: string): void {
    this.patch(id, (b) => ({ status: b.schedule.startAt && b.schedule.startAt > Date.now() && b.cursor === 0 ? 'scheduled' : 'running', nextAt: null }));
  }

  stop(id: string): void {
    this.patch(id, { status: 'stopped', nextAt: null, finishedAt: Date.now() });
  }

  async tick(): Promise<void> {
    if (this.busy || this.app.offline || !this.app.pageReady) return;
    const list = this.app.store.data.broadcasts.filter((b) => b.status === 'running' || b.status === 'scheduled');
    if (!list.length) return;
    this.busy = true;
    try {
      for (const b of list) {
        const d = decide(b, new Date());
        if (d.action === 'wait') {
          if (b.nextAt !== d.until) this.patch(b.id, { nextAt: d.until });
          continue;
        }
        if (d.action === 'finish') {
          this.finish(b);
          continue;
        }
        if (b.status === 'scheduled') this.patch(b.id, { status: 'running' });
        await this.sendOne(b.id, d.index);
        break; // um envio por vez em todas as transmissões
      }
    } finally {
      this.busy = false;
    }
  }

  private finish(b: Broadcast): void {
    const next = nextRepeatStart(b.startedAt ?? Date.now(), b.schedule, b.runs);
    if (next) {
      this.patch(b.id, {
        status: 'scheduled',
        recipients: b.recipients.map((r) => ({ ...r, status: 'pending', error: undefined })),
        cursor: 0,
        runs: b.runs + 1,
        startedAt: next,
        nextAt: next + randomDelayMs(b.intervalMin, b.intervalMax),
        schedule: { ...b.schedule, startAt: next },
      });
    } else {
      this.patch(b.id, { status: 'done', nextAt: null, finishedAt: Date.now() });
    }
  }

  private async sendOne(id: string, index: number): Promise<void> {
    const b = this.get(id);
    if (!b) return;
    const rec = b.recipients[index];
    const app = this.app;
    let target = rec.id;
    let status: Recipient['status'] = 'sent';
    let error: string | undefined;
    try {
      if (b.targets.validate && target.endsWith('@c.us')) {
        const q = await app.bridge.call<{ exists: boolean; id: string }>('queryExists', { phone: phoneFromId(target) });
        if (!q.exists) status = 'invalid';
        else target = q.id || target;
      }
      if (status === 'sent') {
        const ids = pickTemplates(b.templateIds, b.templateMode);
        const vars = await app.varsFor(target, { columns: rec.columns });
        let n = 0;
        for (const tid of ids) {
          const tpl = app.template(tid);
          if (!tpl) continue;
          if (n++) await sleep(BETWEEN_TEMPLATES_MS);
          const mentionAll = !!b.targets.groups.mention && target.endsWith('@g.us');
          await app.sendTemplate(target, tpl, vars, { mentionAll });
        }
        if (!n) throw new Error('no_template');
        await this.afterSend(b, target);
      }
    } catch (e) {
      status = 'failed';
      error = e instanceof Error ? e.message : String(e);
    }
    this.patch(id, (cur) => {
      const recipients = cur.recipients.slice();
      recipients[index] = { ...recipients[index], status, error };
      return {
        recipients,
        cursor: index + 1,
        nextAt: Date.now() + randomDelayMs(cur.intervalMin, cur.intervalMax),
        lastError: error ?? cur.lastError,
      };
    });
    if (status === 'sent') {
      app.store.update('stats', (s) => void (s.broadcastSent += 1));
      app.store.bumpDaily();
    } else if (status === 'failed') app.store.update('stats', (s) => void (s.broadcastFailed += 1));
  }

  private async afterSend(b: Broadcast, chatId: string): Promise<void> {
    const call = (m: string, p: unknown) => this.app.bridge.call(m, p).catch(() => null);
    if (b.post.labelIds.length) await call('labelChats', { chatIds: [chatId], add: b.post.labelIds, remove: [] });
    if (b.post.webhookIds.length)
      this.webhooks.fire(b.post.webhookIds, {
        event: 'broadcast',
        w_id: b.id,
        m_phone: phoneFromId(chatId),
        m_gid: chatId.endsWith('@g.us') ? chatId : '',
        m_timestamp: Math.floor(Date.now() / 1000),
        m_datetime: new Date().toLocaleString(),
      });
    if (b.post.archive) await call('chatAction', { chatId, action: 'archive' });
    if (b.post.block && chatId.endsWith('@c.us')) await call('chatAction', { chatId, action: 'block' });
  }
}
