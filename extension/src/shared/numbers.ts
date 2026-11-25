// Números de telefone, códigos de país (DDI) e leitura de planilhas CSV.

/** Códigos de discagem internacional por país (ISO 3166-1 alfa-2 → DDI). */
export const COUNTRY_DIAL: Record<string, string> = {
  AF: '93', AL: '355', DZ: '213', AD: '376', AO: '244', AR: '54', AM: '374', AW: '297', AU: '61',
  AT: '43', AZ: '994', BS: '1', BH: '973', BD: '880', BY: '375', BE: '32', BZ: '501', BJ: '229',
  BT: '975', BO: '591', BA: '387', BW: '267', BR: '55', BN: '673', BG: '359', BF: '226', BI: '257',
  KH: '855', CM: '237', CA: '1', CV: '238', CF: '236', TD: '235', CL: '56', CN: '86', CO: '57',
  KM: '269', CG: '242', CD: '243', CR: '506', CI: '225', HR: '385', CU: '53', CW: '599', CY: '357',
  CZ: '420', DK: '45', DJ: '253', DO: '1', EC: '593', EG: '20', SV: '503', GQ: '240', ER: '291',
  EE: '372', SZ: '268', ET: '251', FJ: '679', FI: '358', FR: '33', GF: '594', PF: '689', GA: '241',
  GM: '220', GE: '995', DE: '49', GH: '233', GI: '350', GR: '30', GL: '299', GP: '590', GT: '502',
  GN: '224', GW: '245', GY: '592', HT: '509', HN: '504', HK: '852', HU: '36', IS: '354', IN: '91',
  ID: '62', IR: '98', IQ: '964', IE: '353', IL: '972', IT: '39', JM: '1', JP: '81', JO: '962',
  KZ: '7', KE: '254', KW: '965', KG: '996', LA: '856', LV: '371', LB: '961', LS: '266', LR: '231',
  LY: '218', LI: '423', LT: '370', LU: '352', MO: '853', MG: '261', MW: '265', MY: '60', MV: '960',
  ML: '223', MT: '356', MQ: '596', MR: '222', MU: '230', MX: '52', MD: '373', MC: '377', MN: '976',
  ME: '382', MA: '212', MZ: '258', MM: '95', NA: '264', NP: '977', NL: '31', NC: '687', NZ: '64',
  NI: '505', NE: '227', NG: '234', MK: '389', NO: '47', OM: '968', PK: '92', PS: '970', PA: '507',
  PG: '675', PY: '595', PE: '51', PH: '63', PL: '48', PT: '351', PR: '1', QA: '974', RE: '262',
  RO: '40', RU: '7', RW: '250', SA: '966', SN: '221', RS: '381', SC: '248', SL: '232', SG: '65',
  SK: '421', SI: '386', SO: '252', ZA: '27', KR: '82', SS: '211', ES: '34', LK: '94', SD: '249',
  SR: '597', SE: '46', CH: '41', SY: '963', TW: '886', TJ: '992', TZ: '255', TH: '66', TL: '670',
  TG: '228', TT: '1', TN: '216', TR: '90', TM: '993', UG: '256', UA: '380', AE: '971', GB: '44',
  US: '1', UY: '598', UZ: '998', VE: '58', VN: '84', YE: '967', ZM: '260', ZW: '263',
};

const DIAL_CODES: string[] = Array.from(new Set(Object.values(COUNTRY_DIAL))).sort(
  (a, b) => b.length - a.length,
);

/** DDI de um número internacional (só dígitos), pelo prefixo mais longo conhecido. */
export function dialCodeOf(digits: string): string | null {
  const d = onlyDigits(digits);
  for (const code of DIAL_CODES) if (d.startsWith(code)) return code;
  return null;
}

export function onlyDigits(s: string): string {
  return (s ?? '').toString().replace(/\D+/g, '');
}

export interface NormalizeOptions {
  /** 'international' = já vem com DDI; 'local' = prefixar o DDI informado. */
  format: 'international' | 'local';
  ddi?: string;
}

/**
 * Normaliza um número para o formato internacional só com dígitos.
 * - remove tudo que não é dígito ("+", espaços, traços, parênteses);
 * - remove o prefixo de saída internacional "00" e zeros à esquerda;
 * - no formato local, prefixa o DDI (se ainda não estiver lá);
 * - devolve null quando o resultado não tem de 8 a 15 dígitos (E.164).
 */
export function normalizePhone(raw: string, opts: NormalizeOptions = { format: 'international' }): string | null {
  let d = onlyDigits(raw);
  if (!d) return null;
  d = d.replace(/^0+/, '');
  if (opts.format === 'local') {
    const ddi = onlyDigits(opts.ddi ?? '');
    if (ddi && !(d.startsWith(ddi) && d.length > 11)) d = ddi + d;
  }
  if (d.length < 8 || d.length > 15) return null;
  return d;
}

export function toUserId(phoneDigits: string): string {
  return `${phoneDigits}@c.us`;
}

export function phoneFromId(id: string): string {
  const at = id.indexOf('@');
  const user = at >= 0 ? id.slice(0, at) : id;
  return id.endsWith('@c.us') || at < 0 ? onlyDigits(user) : '';
}

/** Extrai números de um texto colado (um por linha, vírgula ou ponto e vírgula). */
export function parsePastedNumbers(text: string, opts?: NormalizeOptions): string[] {
  const out: string[] = [];
  for (const piece of (text ?? '').split(/[\n,;\t]+/)) {
    const n = normalizePhone(piece, opts);
    if (n) out.push(n);
  }
  return Array.from(new Set(out));
}

/** Lê CSV (separador detectado: vírgula, ponto e vírgula ou tab; aspas duplas RFC 4180). */
export function parseCsv(text: string): string[][] {
  const src = (text ?? '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const counts: [string, number][] = [',', ';', '\t'].map((c) => [c, firstLine.split(c).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  const sep = counts[0][1] > 0 ? counts[0][0] : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface SheetRecipient {
  phone: string;
  columns: string[];
}

/**
 * Converte linhas de planilha em destinatários: 1ª coluna = número.
 * Linhas cuja 1ª coluna não vira número válido (ex.: cabeçalho) são ignoradas.
 * Números repetidos ficam só na primeira ocorrência.
 */
export function rowsToRecipients(rows: string[][], opts: NormalizeOptions): { recipients: SheetRecipient[]; invalid: number } {
  const seen = new Set<string>();
  const recipients: SheetRecipient[] = [];
  let invalid = 0;
  for (const r of rows) {
    const cells = r.map((c) => (c ?? '').toString());
    const phone = normalizePhone(cells[0] ?? '', opts);
    if (!phone) {
      invalid++;
      continue;
    }
    if (seen.has(phone)) continue;
    seen.add(phone);
    recipients.push({ phone, columns: [phone, ...cells.slice(1)] });
  }
  return { recipients, invalid };
}

/** Emoji da bandeira de um código ISO de país. */
export function flagOf(iso: string): string {
  return iso
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}
