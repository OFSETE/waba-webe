import { describe, expect, it } from 'vitest';
import { broadcastRisk, firstUrl, incomingTarget, parseIncoming, parseOpenGraph, taskDueStatus, toTxt } from '../src/shared/extras';

describe('tarefas', () => {
  it('atrasada, vence em 24 h ou nada (regra da referência)', () => {
    const now = 1_000_000_000;
    expect(taskDueStatus(now - 1, now)).toBe('overdue');
    expect(taskDueStatus(now + 86_400_000, now)).toBe('dueSoon');
    expect(taskDueStatus(now + 86_400_001, now)).toBe('');
    expect(taskDueStatus(null, now)).toBe('');
  });
});

describe('webhook de entrada', () => {
  it('aceita lista ou {messages} com vários nomes de campo', () => {
    const a = parseIncoming([{ phone: '55 11 98765-4321', message: 'Oi' }, { to: '120@g.us', file_url: 'https://x.com/a.pdf' }, { phone: '', text: 'x' }, 5]);
    expect(a).toEqual([
      { id: '', to: '55 11 98765-4321', text: 'Oi', fileUrl: '', filename: '' },
      { id: '', to: '120@g.us', text: '', fileUrl: 'https://x.com/a.pdf', filename: '' },
    ]);
    expect(parseIncoming({ messages: [{ chatId: '5511@c.us', body: 'b', id: 7 }] })[0]).toEqual({ id: '7', to: '5511@c.us', text: 'b', fileUrl: '', filename: '' });
    expect(parseIncoming({ nada: 1 })).toEqual([]);
    expect(parseIncoming([{ phone: '1', file: 'ftp://x' }])).toEqual([]);
  });
  it('destino', () => {
    expect(incomingTarget('+55 (11) 98765-4321')).toBe('5511987654321@c.us');
    expect(incomingTarget('120363@g.us')).toBe('120363@g.us');
    expect(incomingTarget('123')).toBeNull();
  });
});

describe('risco da transmissão', () => {
  it('sobe com volume e intervalos curtos', () => {
    expect(broadcastRisk(20, 15, 30, true)).toBe(0);
    expect(broadcastRisk(5000, 2, 4, false)).toBe(3);
    expect(broadcastRisk(300, 15, 30, true)).toBe(1);
  });
});

describe('prévia de link', () => {
  it('acha o link e lê Open Graph', () => {
    expect(firstUrl('veja https://exemplo.com/a?b=1, ok')).toBe('https://exemplo.com/a?b=1');
    expect(firstUrl('sem link')).toBeNull();
    const html = '<html><head><title>T &amp; T</title><meta property="og:description" content="Desc"><meta property="og:image" content="/img.png"></head></html>';
    expect(parseOpenGraph(html, 'https://exemplo.com/p')).toEqual({ title: 'T & T', description: 'Desc', image: 'https://exemplo.com/img.png' });
  });
});

describe('TXT', () => {
  it('tabulado com cabeçalho', () => {
    expect(toTxt([{ a: 1, b: 'x\ny' }])).toBe('a\tb\r\n1\tx y');
  });
});
