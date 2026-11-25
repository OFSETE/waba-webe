import { describe, expect, it } from 'vitest';
import { buildReplyRequest, buildTranscribeRequest, buildTranslateRequest, maskKey, modelPath, parseGeminiResponse } from '../src/shared/ai';

describe('IA (Gemini)', () => {
  it('monta a conversa: junta turnos seguidos, começa e termina com o cliente, máx. 20 mensagens', () => {
    const history = [
      { role: 'model' as const, text: 'Olá! Posso ajudar?' },
      { role: 'user' as const, text: 'Oi' },
      { role: 'user' as const, text: 'quanto custa?' },
      { role: 'model' as const, text: 'R$ 10' },
      { role: 'user' as const, text: '  ' },
    ];
    const r = buildReplyRequest(history, { instructions: 'Loja de bolos.', temperature: 0.5 });
    expect(r.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
    expect(r.contents[0].parts[0].text).toBe('Oi\nquanto custa?');
    expect(r.systemInstruction?.parts[0].text).toContain('Loja de bolos.');
    expect(r.generationConfig?.temperature).toBe(0.5);
    const many = Array.from({ length: 40 }, (_, i) => ({ role: (i % 2 ? 'model' : 'user') as 'user' | 'model', text: `m${i}` }));
    const r2 = buildReplyRequest(many, { instructions: '', temperature: 9 });
    expect(r2.contents.map((c) => c.parts[0].text).join(' ')).not.toContain('m19');
    expect(r2.generationConfig?.temperature).toBe(2);
  });

  it('tradução e transcrição', () => {
    expect(buildTranslateRequest('hello', 'português').systemInstruction?.parts[0].text).toContain('português');
    const tr = buildTranscribeRequest('data:audio/ogg; codecs=opus;base64,AAAA');
    expect(tr.contents[0].parts[0].inline_data).toEqual({ mime_type: 'audio/ogg', data: 'AAAA' });
    expect(() => buildTranscribeRequest('nada')).toThrow();
  });

  it('lê a resposta e os erros', () => {
    expect(parseGeminiResponse({ candidates: [{ content: { parts: [{ text: 'Olá ' }, { text: 'mundo' }] } }] })).toEqual({ ok: true, text: 'Olá mundo' });
    expect(parseGeminiResponse({ error: { message: 'API key not valid' } })).toEqual({ ok: false, error: 'API key not valid' });
    expect(parseGeminiResponse({ promptFeedback: { blockReason: 'SAFETY' } }).ok).toBe(false);
    expect(parseGeminiResponse({ candidates: [] }).ok).toBe(false);
  });

  it('endereço do modelo e chave mascarada', () => {
    expect(modelPath('models/gemini-2.5-flash')).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(maskKey('AIzaSyABCDEFGH1234')).toBe('AIza…1234');
    expect(maskKey('')).toBe('');
  });
});
