// Agendador das transmissões: intervalos, horário de funcionamento e repetição.

import type { Broadcast, BroadcastSchedule } from './types';

/** "08:30" → 510. Valores inválidos viram 0. */
export function minutesOf(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? '').trim());
  if (!m) return 0;
  const h = Math.min(23, Number(m[1]));
  const min = Math.min(59, Number(m[2]));
  return h * 60 + min;
}

/** Intervalo padrão entre mensagens (bootstrap.min.js 0xefc9: intervalFrom 15, intervalTo 30). */
export const DEFAULT_INTERVAL_FROM = 15;
export const DEFAULT_INTERVAL_TO = 30;
/** Pausa entre modelos quando todos são enviados à mesma pessoa (0x11f80: ee(2e3)). */
export const BETWEEN_TEMPLATES_MS = 2000;
/** Verificação das transmissões agendadas (0x1336e: setTimeout(n, 3e4)). */
export const SCHEDULE_CHECK_MS = 30_000;

/**
 * Atraso aleatório em segundos inteiros entre de/até, inclusive — fórmula da referência
 * (bootstrap.min.js 0x11f80): 1000 × (⌊random × (até − de + 1)⌋ + de), com de ≥ 0 e até ≥ de.
 */
export function randomDelayMs(minSec: number, maxSec: number, rng: () => number = Math.random): number {
  const from = Math.max(0, Math.trunc(Number(minSec)) || 0);
  const to = Math.max(from, Math.trunc(Number(maxSec)) || from);
  return 1000 * (Math.floor(rng() * (to - from + 1)) + from);
}

/** Regra de validação da referência (0xf776): de > 0, até > 0 e de < até. */
export function validInterval(from: number, to: number): boolean {
  return from > 0 && to > 0 && from < to;
}

/** Está dentro do horário (e do dia da semana) de funcionamento? */
export function isOpen(now: Date, wh: BroadcastSchedule['workingHours']): boolean {
  if (!wh.enabled) return true;
  const day = now.getDay();
  const m = now.getHours() * 60 + now.getMinutes();
  const s = minutesOf(wh.start);
  const e = minutesOf(wh.end);
  const days = wh.days.length ? wh.days : [0, 1, 2, 3, 4, 5, 6];
  if (s === e) return days.includes(day);
  if (s < e) return days.includes(day) && m >= s && m < e;
  // janela atravessa a meia-noite: depois do início conta como o dia atual,
  // antes do fim conta como continuação do dia anterior
  if (m >= s) return days.includes(day);
  if (m < e) return days.includes((day + 6) % 7);
  return false;
}

/** Próximo instante (ms) em que a janela de funcionamento abre; o próprio now se já está aberta. */
export function nextOpenTime(now: Date, wh: BroadcastSchedule['workingHours']): number {
  if (isOpen(now, wh)) return now.getTime();
  // procura minuto a minuto até 8 dias à frente (barato: no máximo ~11520 passos)
  const t = new Date(now.getTime());
  t.setSeconds(0, 0);
  for (let i = 0; i < 8 * 24 * 60; i++) {
    t.setTime(t.getTime() + 60_000);
    if (isOpen(t, wh)) return t.getTime();
  }
  return now.getTime();
}

/** Próximo início de uma transmissão repetida, a partir do início anterior. */
export function nextRepeatStart(prevStart: number, schedule: BroadcastSchedule, runsDone: number): number | null {
  const r = schedule.repeat;
  if (r.kind === 'none') return null;
  if (r.times > 0 && runsDone >= r.times) return null;
  const hour = 3_600_000;
  switch (r.kind) {
    case 'daily':
      return prevStart + 24 * hour;
    case 'weekly':
      return prevStart + 7 * 24 * hour;
    case 'monthly':
      // a referência usa 30 dias (2592e6 ms) para "meses" (bootstrap.min.js 0x108ab)
      return prevStart + 30 * 24 * hour;
    case 'everyHours':
      return prevStart + Math.max(1, r.hours) * hour;
    default:
      return null;
  }
}

export type SchedulerDecision =
  | { action: 'wait'; until: number }
  | { action: 'send'; index: number }
  | { action: 'finish' };

/**
 * Decide o próximo passo de uma transmissão em execução.
 * Pura: recebe o estado e a hora; não envia nada.
 */
export function decide(b: Pick<Broadcast, 'status' | 'recipients' | 'cursor' | 'nextAt' | 'schedule'>, now: Date): SchedulerDecision {
  const t = now.getTime();
  if (b.nextAt && b.nextAt > t) return { action: 'wait', until: b.nextAt };
  if (b.schedule.startAt && b.schedule.startAt > t && b.cursor === 0) return { action: 'wait', until: b.schedule.startAt };
  let i = b.cursor;
  while (i < b.recipients.length && b.recipients[i].status !== 'pending') i++;
  if (i >= b.recipients.length) return { action: 'finish' };
  const open = nextOpenTime(now, b.schedule.workingHours);
  if (open > t) return { action: 'wait', until: open };
  return { action: 'send', index: i };
}

/** Escolhe quais modelos mandar: todos, ou um aleatório. */
export function pickTemplates<T>(ids: T[], mode: 'all' | 'random', rng: () => number = Math.random): T[] {
  if (!ids.length) return [];
  if (mode === 'all') return ids.slice();
  return [ids[Math.min(ids.length - 1, Math.floor(rng() * ids.length))]];
}

export function progressOf(b: Pick<Broadcast, 'recipients'>): { total: number; done: number; sent: number; failed: number; percent: number } {
  const total = b.recipients.length;
  let sent = 0;
  let failed = 0;
  for (const r of b.recipients) {
    if (r.status === 'sent') sent++;
    else if (r.status === 'failed' || r.status === 'invalid') failed++;
  }
  const done = b.recipients.filter((r) => r.status !== 'pending').length;
  return { total, done, sent, failed, percent: total ? Math.round((done / total) * 100) : 0 };
}
