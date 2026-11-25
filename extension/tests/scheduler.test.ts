import { describe, expect, it } from 'vitest';
import { BETWEEN_TEMPLATES_MS, DEFAULT_INTERVAL_FROM, DEFAULT_INTERVAL_TO, decide, isOpen, minutesOf, nextOpenTime, nextRepeatStart, pickTemplates, progressOf, randomDelayMs, validInterval } from '../src/shared/scheduler';
import { newBroadcast } from '../src/shared/defaults';
import type { Recipient } from '../src/shared/types';

const wh = (start: string, end: string, days: number[] = []) => ({ enabled: true, start, end, days });

describe('intervalo aleatório', () => {
  it('segundos inteiros de/até, inclusive: 1000 × (⌊r × (até − de + 1)⌋ + de)', () => {
    expect(randomDelayMs(15, 30, () => 0)).toBe(15000);
    expect(randomDelayMs(15, 30, () => 0.9999)).toBe(30000);
    expect(randomDelayMs(15, 30, () => 0.5)).toBe(23000);
    expect(randomDelayMs(10, 5, () => 0.5)).toBe(10000); // até < de vira de
    expect(randomDelayMs(-3, 0, () => 0.5)).toBe(0);
  });
  it('validação e padrões da referência', () => {
    expect(validInterval(15, 30)).toBe(true);
    expect(validInterval(30, 30)).toBe(false);
    expect(validInterval(0, 5)).toBe(false);
    expect([DEFAULT_INTERVAL_FROM, DEFAULT_INTERVAL_TO, BETWEEN_TEMPLATES_MS]).toEqual([15, 30, 2000]);
  });
  it('converte hh:mm', () => {
    expect(minutesOf('08:30')).toBe(510);
    expect(minutesOf('lixo')).toBe(0);
  });
});

describe('horário de funcionamento', () => {
  const wed10 = new Date(2026, 10, 25, 10, 0); // quarta 10:00
  it('desligado = sempre aberto', () => {
    expect(isOpen(wed10, { ...wh('11:00', '12:00'), enabled: false })).toBe(true);
  });
  it('janela e dias', () => {
    expect(isOpen(wed10, wh('08:00', '18:00', [1, 2, 3, 4, 5]))).toBe(true);
    expect(isOpen(wed10, wh('08:00', '18:00', [0, 6]))).toBe(false);
    expect(isOpen(wed10, wh('11:00', '18:00'))).toBe(false);
  });
  it('janela noturna usa o dia em que começou', () => {
    const tue23 = new Date(2026, 10, 24, 23, 0);
    const wed01 = new Date(2026, 10, 25, 1, 0);
    expect(isOpen(tue23, wh('22:00', '02:00', [2]))).toBe(true);
    expect(isOpen(wed01, wh('22:00', '02:00', [2]))).toBe(true);
    expect(isOpen(wed01, wh('22:00', '02:00', [3]))).toBe(false);
  });
  it('próxima abertura', () => {
    expect(nextOpenTime(wed10, wh('11:00', '18:00'))).toBe(new Date(2026, 10, 25, 11, 0).getTime());
    // sexta 19h, só dias úteis 8-18 → segunda 8h
    const fri19 = new Date(2026, 10, 27, 19, 0);
    expect(nextOpenTime(fri19, wh('08:00', '18:00', [1, 2, 3, 4, 5]))).toBe(new Date(2026, 10, 30, 8, 0).getTime());
  });
});

describe('repetição', () => {
  const sched = (kind: 'none' | 'daily' | 'weekly' | 'monthly' | 'everyHours', times = 0, hours = 6) => ({ ...newBroadcast().schedule, repeat: { kind, times, hours } });
  it('calcula o próximo início', () => {
    expect(nextRepeatStart(0, sched('none'), 1)).toBeNull();
    expect(nextRepeatStart(0, sched('daily'), 1)).toBe(86_400_000);
    expect(nextRepeatStart(0, sched('weekly'), 1)).toBe(7 * 86_400_000);
    expect(nextRepeatStart(0, sched('monthly'), 1)).toBe(2_592_000_000);
    expect(nextRepeatStart(0, sched('everyHours', 0, 6), 1)).toBe(6 * 3_600_000);
  });
  it('para depois de N vezes', () => {
    expect(nextRepeatStart(0, sched('daily', 3), 2)).toBe(86_400_000);
    expect(nextRepeatStart(0, sched('daily', 3), 3)).toBeNull();
  });
});

describe('decisão do agendador', () => {
  const rec = (status: Recipient['status']): Recipient => ({ id: 'x@c.us', status });
  const now = new Date(2026, 10, 25, 10, 0);
  const b = (over: Partial<ReturnType<typeof newBroadcast>> = {}) => ({ ...newBroadcast(), status: 'running' as const, ...over });

  it('espera o intervalo entre mensagens', () => {
    expect(decide(b({ recipients: [rec('pending')], nextAt: now.getTime() + 5000 }), now)).toEqual({ action: 'wait', until: now.getTime() + 5000 });
  });
  it('espera o horário agendado', () => {
    const start = now.getTime() + 60_000;
    const x = b({ recipients: [rec('pending')] });
    x.schedule.startAt = start;
    expect(decide(x, now)).toEqual({ action: 'wait', until: start });
  });
  it('envia ao próximo pendente, pulando os já feitos', () => {
    expect(decide(b({ recipients: [rec('sent'), rec('invalid'), rec('pending')], cursor: 0 }), now)).toEqual({ action: 'send', index: 2 });
  });
  it('termina quando não há pendentes', () => {
    expect(decide(b({ recipients: [rec('sent')], cursor: 1 }), now)).toEqual({ action: 'finish' });
  });
  it('fora do horário de funcionamento espera a abertura', () => {
    const x = b({ recipients: [rec('pending')] });
    x.schedule.workingHours = wh('11:00', '12:00');
    expect(decide(x, now)).toEqual({ action: 'wait', until: new Date(2026, 10, 25, 11, 0).getTime() });
  });
  it('escolha de modelos e progresso', () => {
    expect(pickTemplates(['a', 'b', 'c'], 'all')).toEqual(['a', 'b', 'c']);
    expect(pickTemplates(['a', 'b', 'c'], 'random', () => 0.7)).toEqual(['c']);
    expect(pickTemplates([], 'random')).toEqual([]);
    expect(progressOf({ recipients: [rec('sent'), rec('failed'), rec('pending'), rec('invalid')] })).toEqual({ total: 4, done: 3, sent: 1, failed: 2, percent: 75 });
  });
});
