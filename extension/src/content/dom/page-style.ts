// CSS aplicado à página do WhatsApp Web: desfoques de privacidade e imagem de fundo da conversa.
// Os seletores seguem a estrutura atual do WhatsApp Web e podem precisar de ajuste após atualizações.

import type { Settings } from '../../shared/types';

const BLUR = 'filter: blur(6px) !important; transition: filter .15s ease !important;';
const REVEAL = 'filter: none !important;';

export const BLUR_RULES: Record<string, string> = {
  blurNames: `
    html.ww-blur-names #pane-side span[title], html.ww-blur-names #main header span[dir="auto"], html.ww-blur-names #main header span[title],
    html.ww-blur-names #main [data-pre-plain-text] ~ div span[dir="auto"][aria-label] { ${BLUR} }
    html.ww-blur-names #pane-side span[title]:hover, html.ww-blur-names #main header span:hover { ${REVEAL} }`,
  blurPhotos: `
    html.ww-blur-photos #pane-side img, html.ww-blur-photos #main header img, html.ww-blur-photos #side header img { ${BLUR} }
    html.ww-blur-photos #pane-side img:hover, html.ww-blur-photos #main header img:hover, html.ww-blur-photos #side header img:hover { ${REVEAL} }`,
  blurRecent: `
    html.ww-blur-recent #pane-side [role="gridcell"] span[dir="ltr"], html.ww-blur-recent #pane-side [role="row"] div + div span[dir="ltr"] { ${BLUR} }
    html.ww-blur-recent #pane-side [role="row"]:hover span[dir="ltr"] { ${REVEAL} }`,
  blurConversation: `
    html.ww-blur-conv #main .message-in, html.ww-blur-conv #main .message-out { ${BLUR} }
    html.ww-blur-conv #main .message-in:hover, html.ww-blur-conv #main .message-out:hover { ${REVEAL} }`,
  blurComposer: `
    html.ww-blur-composer #main footer [contenteditable="true"] { ${BLUR} }
    html.ww-blur-composer #main footer [contenteditable="true"]:hover, html.ww-blur-composer #main footer [contenteditable="true"]:focus { ${REVEAL} }`,
};

const CLASS_OF: Record<string, string> = {
  blurNames: 'ww-blur-names',
  blurPhotos: 'ww-blur-photos',
  blurRecent: 'ww-blur-recent',
  blurConversation: 'ww-blur-conv',
  blurComposer: 'ww-blur-composer',
};

let styleEl: HTMLStyleElement | null = null;
let bgEl: HTMLStyleElement | null = null;

export function applyPageStyle(s: Settings): void {
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'wabawebe-privacy';
    styleEl.textContent = Object.values(BLUR_RULES).join('\n');
    document.head.appendChild(styleEl);
  }
  const html = document.documentElement;
  for (const [key, cls] of Object.entries(CLASS_OF)) html.classList.toggle(cls, !!(s.privacy as unknown as Record<string, boolean>)[key]);

  if (!bgEl) {
    bgEl = document.createElement('style');
    bgEl.id = 'wabawebe-background';
    document.head.appendChild(bgEl);
  }
  if (s.background?.dataUrl) {
    const dim = Math.max(0, Math.min(90, s.background.dim)) / 100;
    bgEl.textContent = `
      #main [data-asset-chat-background-dark], #main [data-asset-chat-background-light] { opacity: 0 !important; }
      #main .copyable-area, #main [role="application"] {
        background-image: linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), url("${s.background.dataUrl}") !important;
        background-size: cover !important; background-position: center !important;
      }`;
  } else bgEl.textContent = '';
}
