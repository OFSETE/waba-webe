import { describe, expect, it } from 'vitest';
import { DEFAULT_PAYLOAD, attachmentFromResponse, originOf, renderPayload, replyFromResponse, retryDelayMs, validatePayloadTemplate } from '../src/shared/webhook';
import { mergeData } from '../src/shared/defaults';
import { exportBackup, parseBackup } from '../src/shared/storage';

describe('payload do webhook', () => {
  it('corpo padrão = objeto inteiro com os tipos certos (como a referência)', () => {
    const json = JSON.parse(renderPayload(DEFAULT_PAYLOAD, { event: 'message_in', m_id: 'abc', m_text: 'linha "1"\nlinha 2', m_timestamp: 1764000000, c_labels: ['VIP', 'Novo'] }));
    expect(json.m_text).toBe('linha "1"\nlinha 2');
    expect(json.m_timestamp).toBe(1764000000);
    expect(json.c_labels).toEqual(['VIP', 'Novo']);
    expect(json.m_gid).toBe('');
  });
  it('nome de campo como valor é trocado em qualquer profundidade', () => {
    const json = JSON.parse(renderPayload('{"quem":{"tel":"m_phone"},"lista":["c_labels"],"fixo":"olá"}', { m_phone: '55119', c_labels: ['A'] }));
    expect(json).toEqual({ quem: { tel: '55119' }, lista: [['A']], fixo: 'olá' });
  });
  it('marcador no meio de um texto', () => {
    expect(JSON.parse(renderPayload('{"t":"Olá {{m_cname}}!"}', { m_cname: 'Ana' })).t).toBe('Olá Ana!');
    expect(JSON.parse(renderPayload('{"t":"Olá {{m_cname}}!"}', {})).t).toBe('Olá !');
  });
  it('valida modelos', () => {
    expect(validatePayloadTemplate(DEFAULT_PAYLOAD).ok).toBe(true);
    expect(validatePayloadTemplate('{"a": ').ok).toBe(false);
  });
  it('tentativas com espera crescente', () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(3)).toBe(120_000);
    expect(retryDelayMs(20)).toBe(3_600_000);
  });
  it('resposta vira mensagem', () => {
    expect(replyFromResponse('{"reply":"Olá!"}', 'application/json')).toBe('Olá!');
    expect(replyFromResponse('Obrigado', 'text/plain')).toBe('Obrigado');
    expect(replyFromResponse('{"ok":true}', 'application/json')).toBeNull();
    expect(replyFromResponse('<html></html>', 'text/html')).toBeNull();
    expect(replyFromResponse('   ')).toBeNull();
    expect(replyFromResponse('{"data":{"msg":"Oi"}}', 'application/json', 'data.msg')).toBe('Oi');
    expect(attachmentFromResponse('{"file":"https://x.com/a.pdf"}', 'file')).toBe('https://x.com/a.pdf');
    expect(attachmentFromResponse('{"file":"ftp://x"}', 'file')).toBeNull();
  });
  it('origem da URL', () => {
    expect(originOf('https://exemplo.com:8443/a?b=1')).toBe('https://exemplo.com:8443');
    expect(originOf('ftp://x')).toBeNull();
    expect(originOf('nada')).toBeNull();
  });
});

describe('backup', () => {
  it('exporta e importa mantendo os dados e completando campos novos', () => {
    const d = mergeData({ templates: [{ id: 't', name: 'x', kind: 'text', text: 'oi', quick: true, createdAt: 1 }] });
    const back = parseBackup(exportBackup(d));
    expect(back.templates[0].text).toBe('oi');
    expect(back.settings.privacy.invisible).toBe(false);
    expect(() => parseBackup('{"app":"outro"}')).toThrow();
  });
});
