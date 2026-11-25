// Content script em web.whatsapp.com: injeta os scripts da página e abre o painel.

import { MSG_OPEN_PANEL } from '../shared/protocol';
import { PageBridge, injectPageScripts } from './bridge';
import { bootApp } from './boot';

declare global {
  interface Window {
    __wabawebeLoaded?: boolean;
  }
}

async function main(): Promise<void> {
  if (window.__wabawebeLoaded) return;
  window.__wabawebeLoaded = true;

  const bridge = new PageBridge();
  const runtime = {
    send: <T>(msg: unknown) => chrome.runtime.sendMessage(msg) as Promise<T>,
  };
  const { panel } = await bootApp(bridge, runtime, { pageDom: true });

  chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
    if (msg?.type === MSG_OPEN_PANEL) panel.open();
    return false;
  });

  await injectPageScripts(['wa-config.js', 'vendor/wppconnect-wa.js', 'page.js']);
}

void main();
