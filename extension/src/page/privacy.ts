// Recursos de privacidade aplicados no contexto da página.
// Cada recurso troca uma função interna do WhatsApp Web por outra que não envia o sinal,
// guardando a original para desfazer quando o recurso é desligado.

import type { PrivacySettings } from '../shared/types';

declare const WPP: any;

interface Saved {
  obj: any;
  key: string;
  fn: unknown;
}

const originals = new Map<string, Saved>();

/** wa-js 4 chama o carregador de módulos de `loader` (na versão 3 era `webpack`). */
function loader(): any {
  return WPP.loader ?? WPP.webpack;
}
let presenceTimer: ReturnType<typeof setInterval> | null = null;
let callingDisabled = false;

/** Chaves de configuração (AB props) do WhatsApp Web que ligam as chamadas no navegador. */
export const WEB_CALLING_PROPS = [
  'enable_web_calling',
  'enable_web_group_calling',
  'web_voip_call_tab_new_call',
  'enable_wds_calling_dropdown',
  'enable_web_calling_nux',
  'enable_web_calling_beta_upsell',
];

/** Intervalo em que o modo invisível reafirma "indisponível" (ms). */
export const PRESENCE_REASSERT_MS = 5000;

function assign(obj: any, key: string, value: unknown): void {
  try {
    obj[key] = value;
    if (obj[key] === value) return;
  } catch {
    /* propriedade somente leitura: tenta definir */
  }
  Object.defineProperty(obj, key, { configurable: true, writable: true, value });
}

function metaRequire(name: string): any {
  try {
    const req = (window as any).require;
    return typeof req === 'function' ? req(name) : null;
  } catch {
    return null;
  }
}

function findModuleWith(fnName: string, preferred?: string): any {
  if (preferred) {
    const m = metaRequire(preferred);
    if (m && typeof m[fnName] === 'function') return m;
  }
  try {
    return loader().search((m: any) => m && typeof m[fnName] === 'function');
  } catch {
    return null;
  }
}

function patch(name: string, obj: any, key: string, make: (orig: (...a: any[]) => any) => (...a: any[]) => any): boolean {
  if (!obj || typeof obj[key] !== 'function') return false;
  if (!originals.has(name)) originals.set(name, { obj, key, fn: obj[key] });
  const saved = originals.get(name)!;
  assign(obj, key, make(saved.fn as (...a: any[]) => any));
  return true;
}

function unpatch(name: string): void {
  const s = originals.get(name);
  if (!s) return;
  assign(s.obj, s.key, s.fn);
  originals.delete(name);
}

const resolved = () => Promise.resolve();

function setInvisible(on: boolean): boolean {
  const mod = findModuleWith('sendPresenceAvailable', 'WAWebChatPresence');
  if (on) {
    const ok = patch('presence', mod, 'sendPresenceAvailable', () => resolved);
    const goAway = () => {
      try {
        if (mod && typeof mod.sendPresenceUnavailable === 'function') mod.sendPresenceUnavailable();
        else WPP.conn.markAvailable(false);
      } catch {
        /* ignora */
      }
    };
    goAway();
    if (!presenceTimer) presenceTimer = setInterval(goAway, PRESENCE_REASSERT_MS);
    return ok;
  }
  // desligado: só desfaz se tinha sido ligado (não mexe no WhatsApp à toa)
  if (!presenceTimer && !originals.has('presence')) return true;
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = null;
  unpatch('presence');
  try {
    WPP.conn.markAvailable(true);
  } catch {
    /* ignora */
  }
  return true;
}

function chatStateModule(): any {
  return findModuleWith('sendChatStateComposing', 'WAWebChatStateBridge');
}

function toggle(name: string, on: boolean, obj: any, key: string, replacement: (...a: any[]) => any): boolean {
  if (on) return patch(name, obj, key, () => replacement);
  unpatch(name);
  return true;
}

function statusModelProto(): any {
  try {
    const m = WPP.whatsapp?.StatusV3Model;
    if (m?.prototype?.sendReadStatus) return m.prototype;
  } catch {
    /* ignora */
  }
  const mod = loader().search((m: any) => m?.default?.prototype?.sendReadStatus);
  return mod?.default?.prototype ?? null;
}

function setCalls(disable: boolean): boolean {
  callingDisabled = disable;
  if (!disable) {
    // desligado: devolve as funções originais (se tinham sido trocadas) e não toca em mais nada
    unpatch('abprops');
    unpatch('calling');
    return true;
  }
  let ok = false;
  const ab = findModuleWith('getABPropConfigValue', 'WAWebABProps');
  if (ab && !originals.has('abprops')) {
    ok = patch('abprops', ab, 'getABPropConfigValue', (orig) =>
      function (this: unknown, ...args: any[]) {
        if (callingDisabled && WEB_CALLING_PROPS.includes(args[0])) return false;
        return orig.apply(this, args);
      },
    );
  } else if (ab) ok = true;
  const calling = loader().search((m: any) => typeof m?.isCallingEnabled === 'function');
  if (calling && !originals.has('calling')) {
    patch('calling', calling, 'isCallingEnabled', (orig) =>
      function (this: unknown, ...args: any[]) {
        return callingDisabled ? false : orig.apply(this, args);
      },
    );
  }
  return ok;
}

/** Aplica as opções; devolve quais recursos não puderam ser ligados nesta versão do WhatsApp Web. */
export function applyPrivacy(p: PrivacySettings): string[] {
  const failed: string[] = [];
  const check = (feature: string, ok: boolean, wanted: boolean) => {
    if (wanted && !ok) failed.push(feature);
  };
  // Cada recurso só procura e troca funções do WhatsApp quando está LIGADO; desligado, apenas
  // devolve a original se ela tinha sido trocada. Assim, com tudo desligado, nada do WhatsApp é tocado.
  check('invisible', setInvisible(p.invisible), p.invisible);
  const lazy = (name: string, on: boolean, find: () => any, key: string) => (on ? toggle(name, true, find(), key, resolved) : toggle(name, false, null, key, resolved));
  check('hideTyping', lazy('typing', p.hideTyping, chatStateModule, 'sendChatStateComposing'), p.hideTyping);
  check('hideRecording', lazy('recording', p.hideRecording, chatStateModule, 'sendChatStateRecording'), p.hideRecording);
  check('noReadReceipts', lazy('seen', p.noReadReceipts, () => findModuleWith('sendConversationSeen'), 'sendConversationSeen'), p.noReadReceipts);
  check('viewStatusHidden', lazy('status', p.viewStatusHidden, statusModelProto, 'sendReadStatus'), p.viewStatusHidden);
  check('listenAudioHidden', lazy('played', p.listenAudioHidden, () => findModuleWith('markPlayed'), 'markPlayed'), p.listenAudioHidden);
  check('disableCalls', setCalls(p.disableCalls), p.disableCalls);
  return failed;
}
