// Corpo dos webhooks. Duas formas de marcar campos, ambas aceitas:
//  1) como na referência (app.min.js 0x8e970, função que percorre o JSON): um valor de texto que é
//     exatamente o nome de um campo ("m_phone") é trocado pelo valor real, mantendo o tipo
//     (número, lista...);
//  2) {{m_phone}} dentro de qualquer texto.

export const WEBHOOK_FIELDS = [
  'm_id',
  'm_type',
  'm_datetime',
  'm_timestamp',
  'm_user',
  'm_phone',
  'm_content',
  'm_text',
  'm_cname',
  'm_uname',
  'm_gname',
  'm_gid',
  'm_platform',
  'w_id',
  'c_labels',
  'c_image',
  'c_location',
] as const;

export type WebhookField = (typeof WEBHOOK_FIELDS)[number];
export type WebhookValue = string | number | string[] | Record<string, unknown> | null;
export type WebhookData = Partial<Record<WebhookField | 'event', WebhookValue>>;

const KNOWN = new Set<string>([...WEBHOOK_FIELDS, 'event']);

/**
 * Corpo padrão: o objeto inteiro de dados, como a referência envia quando o corpo não é
 * personalizado (app.min.js 0x90ac4).
 */
export const DEFAULT_PAYLOAD = `{
  "event": "event",
  "m_id": "m_id",
  "m_type": "m_type",
  "m_datetime": "m_datetime",
  "m_timestamp": "m_timestamp",
  "m_user": "m_user",
  "m_phone": "m_phone",
  "m_content": "m_content",
  "m_text": "m_text",
  "m_cname": "m_cname",
  "m_uname": "m_uname",
  "m_gname": "m_gname",
  "m_gid": "m_gid",
  "m_platform": "m_platform",
  "w_id": "w_id",
  "c_labels": "c_labels",
  "c_image": "c_image",
  "c_location": "c_location"
}`;

function jsonEscape(s: string): string {
  return JSON.stringify(s).slice(1, -1);
}

function emptyOf(key: string): WebhookValue {
  if (key === 'm_timestamp') return 0;
  if (key === 'c_labels') return [];
  return '';
}

/** Forma 2: {{campo}} dentro do texto (valor escapado para JSON; números crus fora de aspas). */
export function renderPlaceholders(template: string, data: WebhookData): string {
  return template.replace(/(")?\{\{\s*([a-z_]+)\s*\}\}(")?/g, (_whole, q1: string | undefined, key: string, q2: string | undefined) => {
    let raw = (data as Record<string, unknown>)[key];
    if (raw === undefined || raw === null) raw = emptyOf(key);
    if (Array.isArray(raw)) raw = raw.join(', ');
    else if (typeof raw === 'object') raw = JSON.stringify(raw);
    if (typeof raw === 'number' && !q1 && !q2) return String(raw);
    return `${q1 ?? ''}${jsonEscape(String(raw))}${q2 ?? ''}`;
  });
}

/** Forma 1: troca valores que são nomes de campo pelo valor real (mantendo o tipo). */
export function substituteFieldNames(node: unknown, data: WebhookData): unknown {
  if (typeof node === 'string') {
    if (!KNOWN.has(node)) return node;
    const v = (data as Record<string, unknown>)[node];
    return v === undefined || v === null ? emptyOf(node) : v;
  }
  if (Array.isArray(node)) return node.map((x) => substituteFieldNames(x, data));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = substituteFieldNames(v, data);
    return out;
  }
  return node;
}

export function renderPayload(template: string, data: WebhookData): string {
  const text = renderPlaceholders(template, data);
  try {
    return JSON.stringify(substituteFieldNames(JSON.parse(text), data));
  } catch {
    return text;
  }
}

export function validatePayloadTemplate(template: string): { ok: true } | { ok: false; error: string } {
  try {
    JSON.parse(renderPlaceholders(template, { event: 'test', m_id: 'x', m_timestamp: 1, c_labels: ['a'] }));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Atraso para a próxima tentativa: 30 s, 1 min, 2 min, 4 min... até 1 h. (A referência não repete.) */
export function retryDelayMs(attempts: number): number {
  return Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempts - 1));
}

export const MAX_WEBHOOK_ATTEMPTS = 6;

/** Valor num caminho "a.b.0.c" de um objeto (a referência lê contentParam/attachmentParam assim). */
export function getPath(obj: unknown, path: string): unknown {
  if (!path.trim()) return undefined;
  let cur: unknown = obj;
  for (const part of path.split('.').map((p) => p.trim()).filter(Boolean)) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Texto de resposta a partir do corpo devolvido pelo webhook: o campo no caminho indicado
 * (padrão "reply", depois "message"/"text") de um JSON, ou o texto puro (até 4096 caracteres).
 */
export function replyFromResponse(body: string, contentType = '', path = ''): string | null {
  const trimmed = (body ?? '').trim();
  if (!trimmed) return null;
  if (contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const j = JSON.parse(trimmed) as unknown;
      const keys = path.trim() ? [path.trim()] : ['reply', 'message', 'text'];
      for (const k of keys) {
        const v = getPath(j, k);
        if ((typeof v === 'string' || typeof v === 'number') && String(v).trim()) return String(v).trim().slice(0, 4096);
      }
      return null;
    } catch {
      return null;
    }
  }
  if (contentType.includes('html')) return null;
  return trimmed.slice(0, 4096);
}

/** URL de anexo no caminho indicado do JSON devolvido. */
export function attachmentFromResponse(body: string, path = ''): string | null {
  if (!path.trim()) return null;
  try {
    const v = getPath(JSON.parse(body), path);
    return typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** Origem (https://exemplo.com) de uma URL de webhook, ou null se inválida. */
export function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.origin;
  } catch {
    return null;
  }
}
