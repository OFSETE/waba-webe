// Regras puras das automações: gatilhos e filtros (testáveis sem navegador).

import type { Automation, AutomationFilters, TriggerType } from './types';
import { COUNTRY_DIAL, dialCodeOf } from './numbers';
import { minutesOf } from './scheduler';

/**
 * Minúsculas e sem espaços nas pontas — exatamente a regra da referência
 * (bootstrap.min.js 0x1cba3: `text.trim().toLowerCase()`; acentos contam).
 */
export function normalizeText(s: string): string {
  return (s ?? '').trim().toLowerCase();
}

export function splitKeywords(keywords: string): string[] {
  return (keywords ?? '')
    .split(',')
    .map((k) => normalizeText(k))
    .filter(Boolean);
}

/**
 * Palavras-chave separadas por vírgula. "*" casa com qualquer mensagem.
 * exact = a mensagem inteira precisa ser igual a uma palavra-chave;
 * senão basta conter a palavra-chave (sem diferenciar maiúsculas/acentos).
 */
export function matchKeywords(message: string, keywords: string, exact: boolean): boolean {
  const list = splitKeywords(keywords);
  if (!list.length) return false;
  const text = normalizeText(message);
  for (const k of list) {
    if (k === '*') return true;
    if (exact ? text === k : text.includes(k)) return true;
  }
  return false;
}

export const ATTACHMENT_TYPES = ['image', 'video', 'audio', 'ptt', 'document', 'sticker', 'vcard'] as const;

/** Tipos de chamada da referência: personal|group + _audio|_video (app.min.js, evento call.incoming_call). */
export const CALL_TYPES = ['personal_audio', 'personal_video', 'group_audio', 'group_video'] as const;

export function callTypeOf(isGroup: boolean, isVideo: boolean): string {
  return `${isGroup ? 'group' : 'personal'}_${isVideo ? 'video' : 'audio'}`;
}

export interface TriggerEvent {
  type: 'message' | 'call' | 'groupJoin' | 'groupLeave' | 'status';
  fromMe?: boolean;
  msgType?: string;
  text?: string;
  /** Para chamadas: personal_audio, personal_video, group_audio, group_video. */
  callType?: string;
  /** Link do anúncio de origem (clique para conversar). */
  ctwaSourceUrl?: string;
}

export function matchTrigger(trigger: Automation['trigger'], ev: TriggerEvent): boolean {
  const t: TriggerType = trigger.type;
  if (ev.type === 'call') {
    if (t !== 'call') return false;
    const wanted = trigger.callTypes ?? [];
    return !wanted.length || !ev.callType || wanted.includes(ev.callType);
  }
  if (ev.type === 'groupJoin') return t === 'groupJoin';
  if (ev.type === 'groupLeave') return t === 'groupLeave';
  // status publicado por um contato (a referência responde no privado de quem publicou)
  if (ev.type === 'status') return t === 'status';
  const msgType = ev.msgType ?? 'chat';
  // "compose" da referência: palavra-chave numa mensagem que EU enviei
  if (t === 'outgoing') return !!ev.fromMe && !!(ev.text ?? '') && matchKeywords(ev.text ?? '', trigger.keywords, trigger.exact);
  if (ev.fromMe) return false;
  if (t === 'order') return msgType === 'order';
  // anúncio do Facebook: link de origem com "fb.me" contendo o ID escolhido (bootstrap.min.js 0x1d0fb)
  if (t === 'facebookAd') {
    const src = ev.ctwaSourceUrl ?? '';
    return src.includes('fb.me') && src.includes((trigger.facebookAdId ?? '').trim());
  }
  switch (t) {
    case 'keyword': {
      const text = ev.text ?? '';
      if (!text && !splitKeywords(trigger.keywords).includes('*')) return false;
      return matchKeywords(text, trigger.keywords, trigger.exact);
    }
    case 'attachment': {
      if (!(ATTACHMENT_TYPES as readonly string[]).includes(msgType)) return false;
      const wanted = trigger.attachmentTypes ?? [];
      if (!wanted.length) return true;
      const kind = msgType === 'ptt' ? 'audio' : msgType;
      return wanted.includes(kind) || wanted.includes(msgType);
    }
    case 'location':
      return msgType === 'location' || msgType === 'live_location';
    default:
      return false;
  }
}

export interface FilterContext {
  chatId: string;
  isGroup: boolean;
  isContact: boolean;
  chatOpen: boolean;
  labels: string[];
  /** Número do remetente (só dígitos) para o filtro de países. */
  phone: string;
  now: Date;
}

export function withinHours(now: Date, start: string, end: string): boolean {
  const m = now.getHours() * 60 + now.getMinutes();
  const s = minutesOf(start);
  const e = minutesOf(end);
  if (s === e) return true;
  return s < e ? m >= s && m < e : m >= s || m < e; // atravessa a meia-noite
}

/** Motivo pelo qual o filtro bloqueou, ou null quando passa. */
export function filterBlockReason(f: AutomationFilters, ctx: FilterContext): string | null {
  if (f.ignoreGroups && ctx.isGroup) return 'group';
  if (!ctx.isGroup) {
    if (f.ignoreContacts && ctx.isContact) return 'contact';
    if (f.ignoreNonContacts && !ctx.isContact) return 'nonContact';
  }
  if (f.skipIfChatOpen && ctx.chatOpen) return 'chatOpen';
  if (f.days.length && !f.days.includes(ctx.now.getDay())) return 'day';
  if (f.hours.enabled && !withinHours(ctx.now, f.hours.start, f.hours.end)) return 'hours';
  if (f.chatIds.length && !f.chatIds.includes(ctx.chatId)) return 'chat';
  if (f.labelIds.length && !f.labelIds.some((l) => ctx.labels.includes(l))) return 'label';
  if (f.countries.length) {
    const code = dialCodeOf(ctx.phone);
    const allowed = f.countries.map((iso) => COUNTRY_DIAL[iso]).filter(Boolean);
    if (!code || !allowed.includes(code)) return 'country';
  }
  return null;
}

export function passesFilters(f: AutomationFilters, ctx: FilterContext): boolean {
  return filterBlockReason(f, ctx) === null;
}

/** Palavras que, numa mensagem minha em grupo, marcam todos os membros (app.min.js 0x93663). */
export const MENTION_ALL_TOKENS = ['@everyone', '@all', '@here', '@الجميع', '@الكل', '@todos', '@tous', '@כולם', '@herkes'];

export function hasMentionAllToken(text: string): boolean {
  const t = (text ?? '').toLowerCase();
  return MENTION_ALL_TOKENS.some((k) => t.includes(k.toLowerCase()));
}

/**
 * Liga/desliga um grupo inteiro de opções (bootstrap.min.js `e.toggleAll`): se todas estão ligadas,
 * desliga todas; senão, liga todas.
 */
export function toggleAll<T extends Record<string, boolean>>(group: T): T {
  const allOn = Object.values(group).every(Boolean);
  const out = { ...group };
  for (const k of Object.keys(out) as (keyof T)[]) out[k] = !allOn as T[keyof T];
  return out;
}

/** Respeita o intervalo mínimo entre execuções na mesma conversa. */
export function cooldownOk(lastRunAt: number | undefined, cooldownSec: number, now: number): boolean {
  if (!cooldownSec || !lastRunAt) return true;
  return now - lastRunAt >= cooldownSec * 1000;
}
