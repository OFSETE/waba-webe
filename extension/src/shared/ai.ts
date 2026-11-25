// Inteligência artificial com o Google Gemini (opcional; só funciona com a SUA chave de API).
// Funções puras para montar pedidos e ler respostas — o envio fica no background.

export const GEMINI_ORIGIN = 'https://generativelanguage.googleapis.com';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
/** A referência manda as últimas 20 mensagens de texto da conversa como contexto (app.min.js, evento newMsg). */
export const AI_HISTORY_MESSAGES = 20;

export interface AiSettings {
  apiKey: string;
  model: string;
  /** Instruções gerais (quem é você, o que vende, tom de voz...). */
  instructions: string;
  /** Idioma para onde "Traduzir" leva as mensagens (ex.: português do Brasil). */
  translateTo: string;
  temperature: number;
}

export function defaultAiSettings(): AiSettings {
  return {
    apiKey: '',
    model: DEFAULT_GEMINI_MODEL,
    instructions: '',
    translateTo: 'português do Brasil',
    temperature: 0.7,
  };
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export interface GeminiRequest {
  systemInstruction?: { parts: GeminiPart[] };
  contents: { role: 'user' | 'model'; parts: GeminiPart[] }[];
  generationConfig?: { temperature?: number; maxOutputTokens?: number };
}

export function modelPath(model: string): string {
  const m = (model || DEFAULT_GEMINI_MODEL).trim().replace(/^models\//, '');
  return `${GEMINI_ORIGIN}/v1beta/models/${encodeURIComponent(m)}:generateContent`;
}

/**
 * Pedido para responder numa conversa: as últimas mensagens viram turnos user/model
 * (turnos seguidos do mesmo papel são juntados) e a conversa sempre termina com o cliente.
 */
export function buildReplyRequest(history: ChatTurn[], ai: Pick<AiSettings, 'instructions' | 'temperature'>, extraPrompt = ''): GeminiRequest {
  const turns: { role: 'user' | 'model'; parts: GeminiPart[] }[] = [];
  for (const h of history.slice(-AI_HISTORY_MESSAGES)) {
    const text = (h.text ?? '').trim();
    if (!text) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === h.role) last.parts[0].text = `${last.parts[0].text}\n${text}`;
    else turns.push({ role: h.role, parts: [{ text }] });
  }
  while (turns.length && turns[0].role === 'model') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') turns.push({ role: 'user', parts: [{ text: '(continue a conversa)' }] });
  const system = [
    'Você responde mensagens de WhatsApp em nome do usuário. Responda de forma curta, natural e no idioma de quem escreveu.',
    'Não invente preços, prazos ou dados que não estejam nas instruções. Responda só com o texto da mensagem, sem aspas.',
    ai.instructions.trim(),
    extraPrompt.trim(),
  ]
    .filter(Boolean)
    .join('\n\n');
  return { systemInstruction: { parts: [{ text: system }] }, contents: turns, generationConfig: { temperature: clampTemp(ai.temperature), maxOutputTokens: 1024 } };
}

export function buildTranslateRequest(text: string, target: string): GeminiRequest {
  return {
    systemInstruction: { parts: [{ text: `Traduza o texto do usuário para ${target || 'português do Brasil'}. Responda somente com a tradução, mantendo emojis e quebras de linha.` }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  };
}

/** Transcrição de áudio: o arquivo vai junto, em base64 (dataUrl "data:audio/ogg;base64,..."). */
export function buildTranscribeRequest(dataUrl: string): GeminiRequest {
  const m = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('bad_audio');
  const mime = m[1].split(';')[0];
  return {
    systemInstruction: { parts: [{ text: 'Transcreva o áudio exatamente como foi falado, no idioma original. Responda só com a transcrição.' }] },
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: m[2] } }, { text: 'Transcreva este áudio.' }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 4096 },
  };
}

function clampTemp(t: number): number {
  const n = Number(t);
  return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : 0.7;
}

/** Texto da primeira resposta do Gemini, ou o motivo do erro. */
export function parseGeminiResponse(json: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const j = json as {
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  if (j?.error) return { ok: false, error: j.error.message || 'gemini_error' };
  if (j?.promptFeedback?.blockReason) return { ok: false, error: `blocked: ${j.promptFeedback.blockReason}` };
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!text) return { ok: false, error: j?.candidates?.[0]?.finishReason ? `empty: ${j.candidates[0].finishReason}` : 'empty' };
  return { ok: true, text };
}

/** Esconde a chave para mostrar na tela: "AIza…k9Xw". */
export function maskKey(key: string): string {
  const k = (key ?? '').trim();
  if (k.length <= 8) return k ? '••••' : '';
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}
