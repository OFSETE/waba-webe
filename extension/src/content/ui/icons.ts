// Ícones SVG próprios (traço de 1.8 px, 24×24).

const wrap = (inner: string) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  home: wrap('<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>'),
  privacy: wrap('<path d="M12 3.5 5 6.5v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9v-5z"/><circle cx="12" cy="11" r="2.2"/><path d="M12 13.2v2.6"/>'),
  templates: wrap('<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>'),
  broadcasts: wrap('<path d="M4 10v4h3l6 4V6L7 10z"/><path d="M16.5 9a4 4 0 0 1 0 6"/><path d="M19 6.5a7.5 7.5 0 0 1 0 11"/>'),
  automations: wrap('<path d="M13 3 6 13.5h5L10 21l7.5-11H12.5z"/>'),
  webhooks: wrap('<circle cx="7" cy="16.5" r="2.5"/><circle cx="17" cy="16.5" r="2.5"/><circle cx="12" cy="6.5" r="2.5"/><path d="M10.8 8.7 8.2 14.3M13.2 8.7l2.6 5.6M9.5 16.5h5"/>'),
  tools: wrap('<path d="M14.5 5.5a4 4 0 0 0 4.9 4.9L11 18.8a2 2 0 0 1-2.8-2.8L16.6 7.6"/><path d="M5 4.5 8 7.5"/><path d="m4 8 4-4"/>'),
  tasks: wrap('<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><path d="m8.5 12 2.4 2.4 4.6-5"/>'),
  deleted: wrap('<path d="M5 7h14"/><path d="M9.5 7V4.8h5V7"/><path d="M7 7l.8 12.2h8.4L17 7"/><path d="M10.5 10.5v5.5M13.5 10.5v5.5"/>'),
  watch: wrap('<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10.2 20.5a2 2 0 0 0 3.6 0"/>'),
  settings: wrap('<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>'),
  close: wrap('<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>'),
  plus: wrap('<path d="M12 5.5v13M5.5 12h13"/>'),
  play: wrap('<path d="M8 5.5v13l10-6.5z"/>'),
  pause: wrap('<path d="M8.5 6v12M15.5 6v12"/>'),
  stop: wrap('<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>'),
  edit: wrap('<path d="M5 19l1-4L15.5 5.5a2 2 0 0 1 2.9 2.9L9 18z"/><path d="M14 7l3 3"/>'),
  copy: wrap('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>'),
  send: wrap('<path d="M4 12 20 4.5 15 20l-3.5-6.5z"/><path d="M11.5 13.5 20 4.5"/>'),
  label: wrap('<path d="M4 12.5V5h7.5l8.5 8.5-7.5 7.5z"/><circle cx="8" cy="9" r="1.3"/>'),
  pin: wrap('<path d="M9 4.5h6l-1 5 3 3H7l3-3z"/><path d="M12 12.5v7"/>'),
  userPlus: wrap('<circle cx="10" cy="8.5" r="3.5"/><path d="M3.5 19.5a6.5 6.5 0 0 1 13 0"/><path d="M18.5 8v6M15.5 11h6"/>'),
  readToggle: wrap('<path d="M4 12.5 8 16.5l7-8"/><path d="m11 16.5 1 0 7-8"/>'),
  chat: wrap('<path d="M5 18.5 6 15a7 7 0 1 1 3 3z"/>'),
  clock: wrap('<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>'),
  download: wrap('<path d="M12 4.5v10M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>'),
  upload: wrap('<path d="M12 15V5M7.5 9.5 12 5l4.5 4.5"/><path d="M5 19.5h14"/>'),
  moon: wrap('<path d="M18.5 14.5A7 7 0 0 1 9.5 5.5a7 7 0 1 0 9 9z"/>'),
  eye: wrap('<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/>'),
  restore: wrap('<path d="M5 12a7 7 0 1 0 2-5"/><path d="M5 4.5V8h3.5"/>'),
  link: wrap('<path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1-1"/>'),
  wifiOff: wrap('<path d="M4 4.5 20 19.5"/><path d="M8.5 15.5a5 5 0 0 1 6.5-.5M5.5 12a9 9 0 0 1 5-2.5M15.5 9.8a9 9 0 0 1 3 2.2"/><circle cx="12" cy="19" r=".8"/>'),
  like: wrap('<path d="M7.5 10.5v9h-3v-9z"/><path d="M7.5 10.5 11 4.5a2 2 0 0 1 2.5 2.3L13 10h5a2 2 0 0 1 2 2.3l-1.1 5.5a2 2 0 0 1-2 1.7H7.5"/>'),
  info: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".7"/>'),
  bolt: wrap('<path d="M13 3 6 13.5h5L10 21l7.5-11H12.5z"/>'),
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, size = 20): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = 'ico';
  s.innerHTML = ICONS[name].replace(/width="20" height="20"/, `width="${size}" height="${size}"`);
  return s;
}

/** Marca "WW" (cada cópia com um id de degradê próprio, senão uma apaga a cor da outra). */
let logoSeq = 0;
export function logoSvg(): string {
  const id = `wwg${++logoSeq}`;
  return `<svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#0e7490"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="16" fill="url(#${id})"/><path d="M10 20l5.5 24L22 26l6.5 18L34 20M30 20l5.5 24L42 26l6.5 18L54 20" fill="none" stroke="#fff" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}