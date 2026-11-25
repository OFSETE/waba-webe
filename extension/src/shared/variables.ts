// Variáveis de modelo (${...}) e spintax ({a|b|c}).

export interface VarContext {
  /** Nome salvo na agenda. */
  contactName?: string;
  /** Nome público do WhatsApp (pushname). */
  waName?: string;
  /** Número (somente dígitos). */
  phone?: string;
  groupName?: string;
  /** Texto da mensagem recebida (automações). */
  messageContent?: string;
  /** Colunas da planilha: ${1} é a 1ª coluna, ${2} a 2ª, ... */
  columns?: string[];
  now?: Date;
  locale?: string;
}

export const VARIABLE_NAMES = [
  'contactName',
  'contactNameFirst',
  'contactNameLast',
  'waName',
  'waNameFirst',
  'waNameLast',
  'phone',
  'groupName',
  'date',
  'time',
  'messageContent',
] as const;

export function firstName(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? '';
}

/**
 * "Sobrenome" = a 2ª palavra do nome, como na referência (app.min.js 0x903a3: `name.split(" ")[1]`).
 * Ex.: "Maria Clara Souza" → "Clara".
 */
export function lastName(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts[1] ?? '';
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDate(d: Date, locale = 'pt-BR'): string {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  if (locale.toLowerCase().startsWith('en')) return `${mm}/${dd}/${yyyy}`;
  return `${dd}/${mm}/${yyyy}`;
}

/** Hora com segundos (a referência usa toLocaleTimeString(): "09:05:07"). */
export function formatTime(d: Date, locale = 'pt-BR'): string {
  const hh = d.getHours();
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  if (locale.toLowerCase().startsWith('en')) return `${((hh + 11) % 12) + 1}:${mm}:${ss} ${hh < 12 ? 'AM' : 'PM'}`;
  return `${pad2(hh)}:${mm}:${ss}`;
}

/** Valor de uma variável; undefined = variável desconhecida (fica como está). */
export function variableValue(name: string, ctx: VarContext): string | undefined {
  const now = ctx.now ?? new Date();
  if (/^\d+$/.test(name)) {
    const idx = Number(name) - 1;
    if (idx < 0) return undefined;
    return (ctx.columns?.[idx] ?? '').toString().trim();
  }
  switch (name) {
    case 'contactName':
      return ctx.contactName || ctx.waName || '';
    case 'contactNameFirst':
      return firstName(ctx.contactName || ctx.waName);
    case 'contactNameLast':
      return lastName(ctx.contactName || ctx.waName);
    case 'waName':
      return ctx.waName || '';
    case 'waNameFirst':
      return firstName(ctx.waName);
    case 'waNameLast':
      return lastName(ctx.waName);
    case 'phone':
      return ctx.phone ?? '';
    case 'groupName':
      return ctx.groupName ?? '';
    case 'date':
      return formatDate(now, ctx.locale);
    case 'time':
      return formatTime(now, ctx.locale);
    case 'messageContent':
      return ctx.messageContent ?? '';
    default:
      return undefined;
  }
}

const VAR_RE = /\$\{\s*([A-Za-z0-9_]+)\s*\}/g;

export function replaceVariables(text: string, ctx: VarContext): string {
  return text.replace(VAR_RE, (whole, name: string) => {
    const v = variableValue(name, ctx);
    return v === undefined ? whole : v;
  });
}

export type Rng = () => number;

/**
 * Resolve spintax {a|b|c}, inclusive aninhado ({oi|{olá|e aí}}).
 * Como na referência (app.min.js 0x903a3, regex /{([^{}]+?)}/), qualquer par de chaves com
 * conteúdo é resolvido: "{x}" vira "x". Variáveis ${...} nunca são tocadas.
 */
export function spin(text: string, rng: Rng = Math.random): string {
  // Protege as variáveis para não confundir as chaves delas com spintax.
  const saved: string[] = [];
  let work = text.replace(VAR_RE, (m) => {
    saved.push(m);
    return `\u0000${saved.length - 1}\u0000`;
  });
  const inner = /\{([^{}]+?)\}/;
  let guard = 0;
  while (inner.test(work) && guard++ < 10000) {
    work = work.replace(inner, (_m, body: string) => {
      const options = body.split('|');
      const pick = Math.min(options.length - 1, Math.floor(rng() * options.length));
      return options[pick];
    });
  }
  return work.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => saved[Number(i)]);
}

/** Spintax primeiro, depois variáveis (o conteúdo das variáveis nunca vira spintax). */
export function renderText(text: string, ctx: VarContext, rng: Rng = Math.random): string {
  // a referência apara espaços nas pontas do texto final
  return replaceVariables(spin(text, rng), ctx).trim();
}
