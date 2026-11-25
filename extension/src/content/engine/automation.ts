// Executa as automações quando chegam mensagens, chamadas ou mudanças em grupos.

import type { Automation, MsgEvent } from '../../shared/types';
import { callTypeOf, cooldownOk, filterBlockReason, matchTrigger, type FilterContext, type TriggerEvent } from '../../shared/automation';
import { pickTemplates } from '../../shared/scheduler';
import { phoneFromId } from '../../shared/numbers';
import { renderText } from '../../shared/variables';

/** "Digitando" sem atraso definido dura 3 s (app.min.js 0x92a9f: delay || 3e3). */
export const TYPING_DEFAULT_MS = 3000;
/** Espera antes de arquivar (app.min.js 0x90ac4: o(1e3)). */
export const ARCHIVE_DELAY_MS = 1000;
/** Espera antes de marcar lida/não lida (bootstrap.min.js 0x1dc08: ee(2e3)). */
export const MARK_DELAY_MS = 2000;
/** Espera antes de reagir à mensagem (bootstrap.min.js 0x1dc08: ee(5e3)). */
export const REACTION_DELAY_MS = 5000;
import type { App } from '../app';
import { webhookDataFromMsg, type WebhookQueue } from './webhooks';

interface RunContext {
  chatId: string;
  /** Pessoa que disparou (remetente, quem ligou, quem entrou/saiu). */
  personId: string;
  msgId?: string;
  text: string;
  msg?: MsgEvent;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class AutomationRunner {
  private lastRun = new Map<string, number>();
  private seen = new Set<string>();

  constructor(
    private app: App,
    private webhooks: WebhookQueue,
  ) {}

  private active(): Automation[] {
    if (this.app.offline) return [];
    return this.app.store.data.automations.filter((a) => a.enabled);
  }

  private async check(a: Automation, ev: TriggerEvent, fctx: FilterContext, run: RunContext): Promise<void> {
    if (!matchTrigger(a.trigger, ev)) return;
    if (filterBlockReason(a.filters, fctx)) return;
    const key = `${a.id}|${run.chatId}`;
    const now = Date.now();
    if (!cooldownOk(this.lastRun.get(key), a.cooldownSec, now)) return;
    this.lastRun.set(key, now);
    await this.execute(a, run);
  }

  /** Status publicado por um contato: gatilho "status" (resposta vai no privado de quem publicou). */
  onStatus(ev: MsgEvent): void {
    const autos = this.active().filter((a) => a.trigger.type === 'status');
    if (!autos.length || this.seen.has(ev.id)) return;
    this.seen.add(ev.id);
    const fctx: FilterContext = { chatId: ev.chatId, isGroup: false, isContact: ev.isContact, chatOpen: false, labels: [], phone: phoneFromId(ev.sender), now: new Date() };
    for (const a of autos) void this.check(a, { type: 'status' }, fctx, { chatId: ev.chatId, personId: ev.sender, msgId: undefined, text: ev.caption || ev.body || '' }).catch(() => null);
  }

  onMessage(ev: MsgEvent): void {
    if (this.seen.has(ev.id)) return;
    this.seen.add(ev.id);
    if (this.seen.size > 5000) this.seen.clear();
    const autos = this.active();
    if (!autos.length) return;
    const text = ev.body || ev.caption || '';
    const tev: TriggerEvent = { type: 'message', fromMe: ev.fromMe, msgType: ev.type, text, ctwaSourceUrl: ev.ctwaSourceUrl };
    const fctx: FilterContext = {
      chatId: ev.chatId,
      isGroup: ev.isGroup,
      isContact: ev.isContact,
      chatOpen: ev.activeChatId === ev.chatId && document.visibilityState === 'visible',
      labels: ev.labels,
      // mensagem minha (gatilho "mensagem enviada"): a pessoa é quem recebeu
      phone: phoneFromId(ev.fromMe ? ev.chatId : ev.sender),
      now: new Date(),
    };
    const personId = ev.fromMe ? (ev.isGroup ? '' : ev.chatId) : ev.sender;
    for (const a of autos) void this.check(a, tev, fctx, { chatId: ev.chatId, personId, msgId: ev.id, text, msg: ev }).catch((e) => console.warn('[WABA WEBE] automação', e));
  }

  /** Executar agora na conversa indicada, ignorando gatilho e filtros (como "disparar manualmente" da referência). */
  async runNow(a: Automation, chatId: string): Promise<void> {
    await this.execute(a, { chatId, personId: chatId.endsWith('@g.us') ? '' : chatId, text: '' });
  }

  async onCall(c: { from: string; isGroup: boolean; isVideo?: boolean }): Promise<void> {
    const autos = this.active();
    if (!autos.length || !c.from) return;
    const info = await this.app.contactCtx(c.from);
    const fctx: FilterContext = {
      chatId: c.from,
      isGroup: false,
      isContact: info.isMyContact,
      chatOpen: this.app.activeChatId === c.from,
      labels: info.labels,
      phone: info.phone,
      now: new Date(),
    };
    for (const a of autos) await this.check(a, { type: 'call', callType: callTypeOf(c.isGroup, !!c.isVideo) }, fctx, { chatId: c.from, personId: c.from, text: '' }).catch(() => null);
  }

  async onGroup(g: { groupId: string; action: string; participants: string[]; myId: string }): Promise<void> {
    const autos = this.active();
    if (!autos.length) return;
    const type = g.action === 'add' || g.action === 'join' ? 'groupJoin' : g.action === 'remove' || g.action === 'leaver' ? 'groupLeave' : null;
    if (!type) return;
    const group = await this.app.contactCtx(g.groupId);
    for (const p of g.participants) {
      if (p === g.myId) continue;
      const info = await this.app.contactCtx(p);
      const fctx: FilterContext = {
        chatId: g.groupId,
        isGroup: false, // o filtro "ignorar grupos" não se aplica a gatilhos de grupo
        isContact: info.isMyContact,
        chatOpen: this.app.activeChatId === g.groupId,
        labels: group.labels,
        phone: info.phone,
        now: new Date(),
      };
      for (const a of autos) await this.check(a, { type }, fctx, { chatId: g.groupId, personId: p, text: '' }).catch(() => null);
    }
  }

  /**
   * Executa as ações na ordem da referência (bootstrap.min.js 0x1cba3 / 0x1dc08):
   * "digitando" dura o atraso (ou 3 s sem atraso) e corre junto com a espera; só o 1º modelo cita
   * a mensagem; bloquear e grupos agem sobre o remetente; arquivar espera 1 s; lida/não lida 2 s.
   */
  async execute(a: Automation, run: RunContext): Promise<void> {
    const act = a.actions;
    const app = this.app;
    const isGroupChat = run.chatId.endsWith('@g.us');
    // destino das respostas: o grupo, ou o privado de quem mandou
    const target = act.replyPrivately && isGroupChat && run.personId ? run.personId : run.chatId;
    const call = (method: string, params: unknown) => app.bridge.call(method, params).catch((e) => console.warn('[WABA WEBE]', method, e));
    const delayMs = Math.max(0, act.delaySec) * 1000;
    if (act.typing && (act.templateIds.length || act.aiReply)) void call('typing', { chatId: target, ms: delayMs || TYPING_DEFAULT_MS });
    if (delayMs) await sleep(delayMs);
    if (app.offline) return;
    const vars = await app.varsFor(run.chatId, { senderId: run.personId, messageContent: run.text });
    let replied = 0;
    if (act.aiReply) {
      // como a opção de agente da referência: responde com IA em vez dos modelos,
      // usando as últimas 20 mensagens da conversa como contexto
      try {
        const text = await app.ai.replyFor(run.chatId, act.aiPrompt ?? '');
        await app.sendResolved(target, { kind: 'text', text }, { quotedMsgId: act.quote && target === run.chatId ? run.msgId : undefined });
        replied++;
      } catch (e) {
        console.warn('[WABA WEBE] IA', e);
        app.ui.toast(`${a.name}: ${e instanceof Error ? e.message : e}`, 'error');
      }
    } else {
      for (const id of pickTemplates(act.templateIds, act.templateMode)) {
        const tpl = app.template(id);
        if (!tpl) continue;
        await app.sendTemplate(target, tpl, vars, { quotedMsgId: act.quote && replied === 0 && target === run.chatId ? run.msgId : undefined });
        replied++;
      }
    }
    if (act.notify?.chatIds.length && act.notify.text.trim()) {
      const text = renderText(act.notify.text, vars);
      for (const id of act.notify.chatIds) await app.sendResolved(id, { kind: 'text', text }).catch(() => null);
    }
    if (act.addLabels.length || act.removeLabels.length) await call('labelChats', { chatIds: [target], add: act.addLabels, remove: act.removeLabels });
    if (act.mark !== 'none') {
      await sleep(MARK_DELAY_MS);
      await call('chatAction', { chatId: target, action: act.mark });
    }
    if (act.star && run.msgId) await call('chatAction', { chatId: run.chatId, action: 'star', msgId: run.msgId });
    for (const gid of act.addToGroups) await call('groupParticipantsChange', { groupId: gid, participants: [run.personId], op: 'add' });
    for (const gid of act.removeFromGroups) await call('groupParticipantsChange', { groupId: gid, participants: [run.personId], op: 'remove' });
    if (act.webhookIds.length) {
      const data = run.msg
        ? webhookDataFromMsg(app, run.msg, 'automation', a.id)
        : { event: 'automation', w_id: a.id, m_phone: phoneFromId(run.personId), m_timestamp: Math.floor(Date.now() / 1000), m_datetime: new Date().toString(), m_gid: isGroupChat ? run.chatId : '' };
      this.webhooks.fire(act.webhookIds, data, target);
    }
    if (act.archive) {
      await sleep(ARCHIVE_DELAY_MS);
      await call('chatAction', { chatId: target, action: 'archive' });
    }
    if (act.block && run.personId && !run.personId.endsWith('@g.us')) await call('chatAction', { chatId: run.personId, action: 'block' });
    if (act.pinChat) await call('chatAction', { chatId: target, action: 'pin' });
    if (act.muteHours) await call('chatAction', { chatId: target, action: 'mute', hours: act.muteHours });
    if (act.unmuteChat) await call('chatAction', { chatId: target, action: 'unmute' });
    if (act.pinMessageHours && run.msgId) await call('chatAction', { chatId: run.chatId, action: 'pinMsg', msgId: run.msgId, hours: act.pinMessageHours });
    if (act.saveContact?.enabled && run.personId && !run.personId.endsWith('@g.us')) {
      // como a referência: prefixo + 1ª palavra do nome do WhatsApp; o resto vira sobrenome
      const words = (vars.waName ?? '').trim().split(/\s+/).filter(Boolean);
      const first = `${act.saveContact.prefix ?? ''}${words[0] ?? phoneFromId(run.personId)}`.trim();
      await call('saveContact', { id: run.personId, first, last: words.slice(1).join(' ') });
    }
    if (act.reaction && run.msgId) {
      await sleep(REACTION_DELAY_MS);
      await call('chatAction', { chatId: run.chatId, action: 'react', msgId: run.msgId, emoji: act.reaction });
    }
    if (act.deleteChat) await call('chatAction', { chatId: target, action: 'delete' });
    app.store.update('automations', (list) => list.map((x) => (x.id === a.id ? { ...x, runs: x.runs + 1 } : x)));
    if (replied) {
      app.store.update('stats', (s) => void (s.automationReplies += replied));
      app.store.bumpDaily(replied);
    }
  }
}
