// Regras puras de recursos extras da referência (testáveis sem navegador).

/** "Vence em breve" = nas próximas 24 h (bootstrap.min.js `taskDueStatus`: t − n ≤ 864e5). */
export const DUE_SOON_MS = 86_400_000;

export function taskDueStatus(due: number | null | undefined, now = Date.now()): '' | 'overdue' | 'dueSoon' {
  if (!due || !Number.isFinite(due)) return '';
  if (due < now) return 'overdue';
  return due - now <= DUE_SOON_MS ? 'dueSoon' : '';
}

/* ---------------- webhooks de entrada (sem servidor: a extensão busca numa URL sua) ---------------- */

export interface IncomingMessage {
  /** id opcional, devolvido no aviso de entrega */
  id: string;
  /** número (só dígitos) ou id do WhatsApp (…@c.us / …@g.us) */
  to: string;
  text: string;
  fileUrl: string;
  filename: string;
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v).trim();
}

/**
 * Aceita uma lista ou {"messages": [...]} com, em cada item:
 * phone | number | to | chatId  —  message | text | body | caption  —  file | fileUrl | file_url | media_url  —  filename  —  id
 */
export function parseIncoming(json: unknown): IncomingMessage[] {
  const list = Array.isArray(json) ? json : Array.isArray((json as { messages?: unknown })?.messages) ? (json as { messages: unknown[] }).messages : [];
  const out: IncomingMessage[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const to = str(r.chatId ?? r.to ?? r.phone ?? r.number);
    const text = str(r.message ?? r.text ?? r.body ?? r.caption);
    const rawFile = str(r.file ?? r.fileUrl ?? r.file_url ?? r.media_url ?? r.mediaUrl);
    const fileUrl = /^https?:\/\//i.test(rawFile) ? rawFile : '';
    if (!to || (!text && !fileUrl)) continue;
    out.push({ id: str(r.id), to, text, fileUrl, filename: str(r.filename) });
  }
  return out.slice(0, 200);
}

/** Destino do WhatsApp a partir do campo "para": id completo ou número (só dígitos, com DDI). */
export function incomingTarget(to: string): string | null {
  const t = to.trim();
  if (/@(c\.us|g\.us|lid|broadcast)$/.test(t)) return t;
  const d = t.replace(/\D+/g, '').replace(/^0+/, '');
  return d.length >= 8 && d.length <= 15 ? `${d}@c.us` : null;
}

/* ---------------- risco da transmissão (estimado; a referência mostra um medidor) ---------------- */

/**
 * 0 = baixo, 1 = médio, 2 = alto, 3 = muito alto. Sobe com o número de destinatários e com
 * intervalos curtos; números colados/planilha sem conferência pesam mais.
 */
export function broadcastRisk(recipients: number, intervalMin: number, intervalMax: number, validate: boolean): 0 | 1 | 2 | 3 {
  const avg = (Math.max(0, intervalMin) + Math.max(0, intervalMax)) / 2;
  let score = 0;
  if (recipients > 50) score++;
  if (recipients > 250) score++;
  if (recipients > 1000) score++;
  if (avg < 10) score++;
  if (avg < 5) score++;
  if (!validate) score++;
  return Math.min(3, Math.floor(score / 1.5)) as 0 | 1 | 2 | 3;
}

/* ---------------- prévia de link montada localmente ---------------- */

export function firstUrl(text: string): string | null {
  const m = /\bhttps?:\/\/[^\s<>"']+/i.exec(text ?? '');
  return m ? m[0].replace(/[.,;:!?)\]]+$/, '') : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)));
}

/** Título, descrição e imagem de uma página (tags Open Graph, senão <title>/description). */
export function parseOpenGraph(html: string, pageUrl: string): { title: string; description: string; image: string } {
  const meta = (prop: string): string => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
    const tag = re.exec(html)?.[0] ?? '';
    return decodeEntities(/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? '').trim();
  };
  const title = meta('og:title') || decodeEntities(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? '').trim();
  const description = meta('og:description') || meta('description');
  let image = meta('og:image') || meta('twitter:image');
  if (image) {
    try {
      image = new URL(image, pageUrl).href;
    } catch {
      image = '';
    }
  }
  return { title: title.slice(0, 300), description: description.slice(0, 500), image };
}

/* ---------------- exportação em TXT ---------------- */

/** Uma linha por registro, colunas separadas por tabulação, com cabeçalho. */
export function toTxt(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const clean = (v: unknown) => (v === null || v === undefined ? '' : String(v)).replace(/[\t\r\n]+/g, ' ');
  return [cols.join('\t'), ...rows.map((r) => cols.map((c) => clean(r[c])).join('\t'))].join('\r\n');
}

/* ---------------- backup seletivo ---------------- */

export const BACKUP_PARTS = ['settings', 'templates', 'broadcasts', 'automations', 'webhooks', 'tasks', 'deleted', 'stats'] as const;
export type BackupPart = (typeof BACKUP_PARTS)[number];
