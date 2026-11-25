import { describe, expect, it } from 'vitest';
import { callTypeOf, cooldownOk, filterBlockReason, hasMentionAllToken, toggleAll, matchKeywords, matchTrigger, normalizeText, withinHours, type FilterContext } from '../src/shared/automation';
import { newAutomation } from '../src/shared/defaults';

describe('palavras-chave', () => {
  it('ignora maiúsculas e espaços nas pontas, mas não acentos (regra da referência)', () => {
    expect(normalizeText('  ÓLÁ Mundo ')).toBe('ólá mundo');
    expect(matchKeywords('Olá, tudo bem?', 'olá, oi', false)).toBe(true);
    expect(matchKeywords('Ola, tudo bem?', 'olá', false)).toBe(false);
  });
  it('contém x exata', () => {
    expect(matchKeywords('qual o preço?', 'preço', false)).toBe(true);
    expect(matchKeywords('qual o preço?', 'preço', true)).toBe(false);
    expect(matchKeywords('Preço', 'preço', true)).toBe(true);
  });
  it('* casa com qualquer mensagem', () => {
    expect(matchKeywords('qualquer coisa', '*', false)).toBe(true);
    expect(matchKeywords('qualquer coisa', 'oi, *', true)).toBe(true);
  });
  it('lista vazia não casa', () => {
    expect(matchKeywords('oi', ' , ', false)).toBe(false);
  });
});

describe('gatilhos', () => {
  const tr = (type: string, extra: Record<string, unknown> = {}) => ({ ...newAutomation().trigger, type, ...extra }) as ReturnType<typeof newAutomation>['trigger'];
  it('palavra-chave só em mensagens recebidas', () => {
    expect(matchTrigger(tr('keyword', { keywords: 'oi' }), { type: 'message', text: 'oi!', msgType: 'chat' })).toBe(true);
    expect(matchTrigger(tr('keyword', { keywords: 'oi' }), { type: 'message', text: 'oi!', fromMe: true })).toBe(false);
  });
  it('anexo com filtro de tipo (ptt conta como áudio)', () => {
    expect(matchTrigger(tr('attachment'), { type: 'message', msgType: 'image' })).toBe(true);
    expect(matchTrigger(tr('attachment', { attachmentTypes: ['audio'] }), { type: 'message', msgType: 'ptt' })).toBe(true);
    expect(matchTrigger(tr('attachment', { attachmentTypes: ['audio'] }), { type: 'message', msgType: 'image' })).toBe(false);
    expect(matchTrigger(tr('attachment'), { type: 'message', msgType: 'chat' })).toBe(false);
  });
  it('localização, chamada e grupo', () => {
    expect(matchTrigger(tr('location'), { type: 'message', msgType: 'location' })).toBe(true);
    expect(matchTrigger(tr('call'), { type: 'call' })).toBe(true);
    expect(matchTrigger(tr('call', { callTypes: ['personal_video'] }), { type: 'call', callType: callTypeOf(false, true) })).toBe(true);
    expect(matchTrigger(tr('call', { callTypes: ['personal_video'] }), { type: 'call', callType: callTypeOf(true, false) })).toBe(false);
    expect(matchTrigger(tr('keyword', { keywords: '*' }), { type: 'call' })).toBe(false);
    expect(matchTrigger(tr('groupJoin'), { type: 'groupJoin' })).toBe(true);
    expect(matchTrigger(tr('groupLeave'), { type: 'groupJoin' })).toBe(false);
  });
});

describe('filtros', () => {
  const base = (): FilterContext => ({
    chatId: '5511987654321@c.us',
    isGroup: false,
    isContact: true,
    chatOpen: false,
    labels: ['1'],
    phone: '5511987654321',
    now: new Date(2026, 10, 25, 10, 0), // quarta-feira, 10:00
  });
  const f = () => newAutomation().filters;

  it('ignorar grupos / contatos / não contatos', () => {
    expect(filterBlockReason({ ...f(), ignoreGroups: true }, { ...base(), isGroup: true })).toBe('group');
    expect(filterBlockReason({ ...f(), ignoreGroups: false, ignoreContacts: true }, base())).toBe('contact');
    expect(filterBlockReason({ ...f(), ignoreNonContacts: true }, { ...base(), isContact: false })).toBe('nonContact');
    expect(filterBlockReason(f(), base())).toBeNull();
  });
  it('conversa aberta', () => {
    expect(filterBlockReason({ ...f(), skipIfChatOpen: true }, { ...base(), chatOpen: true })).toBe('chatOpen');
  });
  it('dias e horário', () => {
    expect(filterBlockReason({ ...f(), days: [0, 6] }, base())).toBe('day');
    expect(filterBlockReason({ ...f(), days: [3] }, base())).toBeNull();
    expect(filterBlockReason({ ...f(), hours: { enabled: true, start: '11:00', end: '18:00' } }, base())).toBe('hours');
    expect(filterBlockReason({ ...f(), hours: { enabled: true, start: '08:00', end: '18:00' } }, base())).toBeNull();
  });
  it('horário que atravessa a meia-noite', () => {
    expect(withinHours(new Date(2026, 0, 1, 23, 30), '22:00', '06:00')).toBe(true);
    expect(withinHours(new Date(2026, 0, 1, 5, 59), '22:00', '06:00')).toBe(true);
    expect(withinHours(new Date(2026, 0, 1, 12, 0), '22:00', '06:00')).toBe(false);
  });
  it('etiquetas, países e conversas específicas', () => {
    expect(filterBlockReason({ ...f(), labelIds: ['2'] }, base())).toBe('label');
    expect(filterBlockReason({ ...f(), labelIds: ['1', '2'] }, base())).toBeNull();
    expect(filterBlockReason({ ...f(), countries: ['PT'] }, base())).toBe('country');
    expect(filterBlockReason({ ...f(), countries: ['BR'] }, base())).toBeNull();
    expect(filterBlockReason({ ...f(), chatIds: ['x@c.us'] }, base())).toBe('chat');
  });
  it('gatilhos extras da referência: mensagem minha, status e pedido', () => {
    const base = newAutomation().trigger;
    const out = { ...base, type: 'outgoing' as const, keywords: 'pix' };
    expect(matchTrigger(out, { type: 'message', fromMe: true, text: 'Segue o PIX' })).toBe(true);
    expect(matchTrigger(out, { type: 'message', fromMe: false, text: 'Segue o PIX' })).toBe(false);
    expect(matchTrigger({ ...base, type: 'status' as const }, { type: 'status' })).toBe(true);
    expect(matchTrigger({ ...base, type: 'status' as const }, { type: 'message', text: 'oi' })).toBe(false);
    expect(matchTrigger({ ...base, type: 'order' as const }, { type: 'message', msgType: 'order' })).toBe(true);
    expect(matchTrigger({ ...base, type: 'keyword' as const, keywords: '*' }, { type: 'message', fromMe: true, text: 'x' })).toBe(false);
  });
  it('gatilho de anúncio do Facebook', () => {
    const fb = { ...newAutomation().trigger, type: 'facebookAd' as const, facebookAdId: '12345' };
    expect(matchTrigger(fb, { type: 'message', ctwaSourceUrl: 'https://fb.me/12345abc' })).toBe(true);
    expect(matchTrigger(fb, { type: 'message', ctwaSourceUrl: 'https://fb.me/999' })).toBe(false);
    expect(matchTrigger({ ...fb, facebookAdId: '' }, { type: 'message', ctwaSourceUrl: 'https://fb.me/999' })).toBe(true);
    expect(matchTrigger(fb, { type: 'message' })).toBe(false);
  });
  it('liga/desliga o grupo inteiro (Alt+P / Alt+B)', () => {
    expect(toggleAll({ a: true, b: false })).toEqual({ a: true, b: true });
    expect(toggleAll({ a: true, b: true })).toEqual({ a: false, b: false });
  });
  it('palavras de menção a todos', () => {
    expect(hasMentionAllToken('Bom dia @TODOS')).toBe(true);
    expect(hasMentionAllToken('fale com @ana')).toBe(false);
  });
  it('intervalo mínimo por conversa', () => {
    expect(cooldownOk(undefined, 60, 1000)).toBe(true);
    expect(cooldownOk(1000, 60, 30_000)).toBe(false);
    expect(cooldownOk(1000, 60, 61_000)).toBe(true);
    expect(cooldownOk(1000, 0, 1001)).toBe(true);
  });
});
