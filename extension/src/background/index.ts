// Service worker: abre/foca o WhatsApp Web, recarrega a aba ao instalar e faz os fetch dos webhooks.

import { GEMINI_ORIGIN, defaultAiSettings, modelPath, parseGeminiResponse, type AiSettings, type GeminiRequest } from '../shared/ai';
import {
  MSG_AI_GENERATE,
  MSG_AI_MODELS,
  MSG_FETCH_FILE,
  MSG_HAS_PERMISSION,
  MSG_OPEN_PANEL,
  MSG_REQUEST_PERMISSION,
  MSG_WEBHOOK_FETCH,
  type WebhookFetchRequest,
  type WebhookFetchResult,
} from '../shared/protocol';

const WA_URL = 'https://web.whatsapp.com/';
const WA_MATCH = '*://web.whatsapp.com/*';
const FETCH_TIMEOUT_MS = 20_000;
const MAX_BODY_CHARS = 65_536;

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== 'install' && details.reason !== 'update') return;
  const tabs = await chrome.tabs.query({ url: WA_MATCH });
  for (const tab of tabs) if (tab.id !== undefined) chrome.tabs.reload(tab.id);
});

async function sendOpenPanel(tabId: number, tries = 10): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: MSG_OPEN_PANEL });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 700));
    }
  }
}

chrome.action.onClicked.addListener(async (current) => {
  let tabs = await chrome.tabs.query({ url: WA_MATCH, windowId: current.windowId });
  if (!tabs.length) tabs = await chrome.tabs.query({ url: WA_MATCH });
  const tab = tabs[0];
  if (tab?.id !== undefined) {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
    await sendOpenPanel(tab.id);
    return;
  }
  const created = await chrome.tabs.create({ url: WA_URL });
  if (created.id !== undefined) {
    const id = created.id;
    const listener = (tabId: number, info: { status?: string }) => {
      if (tabId === id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        void sendOpenPanel(id, 20);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  }
});

function originPattern(origin: string): string {
  return `${origin}/*`;
}

async function hasPermission(origin: string): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [originPattern(origin)] });
  } catch {
    return false;
  }
}

async function doFetch(req: WebhookFetchRequest): Promise<WebhookFetchResult> {
  let origin: string;
  try {
    const u = new URL(req.url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad_protocol');
    origin = u.origin;
  } catch {
    return { ok: false, status: 0, contentType: '', body: '', error: 'invalid_url' };
  }
  if (!(await hasPermission(origin))) return { ok: false, status: 0, contentType: '', body: '', error: 'no_permission' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const method = req.method.toUpperCase();
    const res = await fetch(req.url, {
      method,
      headers: req.headers,
      body: method === 'GET' ? undefined : req.body,
      signal: ctrl.signal,
      credentials: 'omit',
      redirect: 'follow',
    });
    const text = (await res.text()).slice(0, MAX_BODY_CHARS);
    return { ok: res.ok, status: res.status, contentType: res.headers.get('content-type') ?? '', body: text };
  } catch (e) {
    return { ok: false, status: 0, contentType: '', body: '', error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- IA (Google Gemini, chave do próprio usuário) ---------------- */

async function aiSettings(): Promise<AiSettings> {
  const raw = await chrome.storage.local.get('ww.settings');
  const s = (raw['ww.settings'] ?? {}) as { ai?: Partial<AiSettings> };
  return { ...defaultAiSettings(), ...(s.ai ?? {}) };
}

async function geminiFetch(url: string, init: RequestInit, key: string): Promise<{ ok: boolean; json: unknown; status: number }> {
  if (!(await hasPermission(GEMINI_ORIGIN))) throw new Error('no_permission');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, ...(init.headers ?? {}) },
      credentials: 'omit',
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

async function aiGenerate(request: GeminiRequest): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const ai = await aiSettings();
    if (!ai.apiKey.trim()) return { ok: false, error: 'no_key' };
    const r = await geminiFetch(modelPath(ai.model), { method: 'POST', body: JSON.stringify(request) }, ai.apiKey.trim());
    const parsed = parseGeminiResponse(r.json);
    return parsed.ok ? { ok: true, text: parsed.text } : { ok: false, error: parsed.error || `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function aiModels(): Promise<{ ok: boolean; models?: string[]; error?: string }> {
  try {
    const ai = await aiSettings();
    if (!ai.apiKey.trim()) return { ok: false, error: 'no_key' };
    const r = await geminiFetch(`${GEMINI_ORIGIN}/v1beta/models?pageSize=200`, { method: 'GET' }, ai.apiKey.trim());
    const j = r.json as { models?: { name: string; supportedGenerationMethods?: string[] }[]; error?: { message?: string } };
    if (!r.ok) return { ok: false, error: j?.error?.message || `HTTP ${r.status}` };
    const models = (j.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((n) => n.startsWith('gemini'));
    return { ok: true, models };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const MAX_FILE_BYTES = 16 * 1024 * 1024;

/** Baixa o arquivo indicado pela resposta de um webhook (mesma regra de permissão por domínio). */
async function fetchFile(url: string): Promise<{ ok: boolean; dataUrl: string; mime: string; name: string; size: number; error?: string }> {
  const fail = (error: string) => ({ ok: false, dataUrl: '', mime: '', name: '', size: 0, error });
  let u: URL;
  try {
    u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return fail('bad_protocol');
  } catch {
    return fail('invalid_url');
  }
  if (!(await hasPermission(u.origin))) return fail('no_permission');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS * 3);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit' });
    if (!res.ok) return fail(`HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_FILE_BYTES) return fail('too_big');
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const mime = (res.headers.get('content-type') ?? 'application/octet-stream').split(';')[0].trim();
    const name = decodeURIComponent(u.pathname.split('/').pop() || 'arquivo');
    return { ok: true, dataUrl: `data:${mime};base64,${btoa(bin)}`, mime, name, size: buf.byteLength };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((msg: { type?: string; origin?: string } & Partial<WebhookFetchRequest>, _sender, sendResponse) => {
  if (msg?.type === MSG_WEBHOOK_FETCH) {
    doFetch(msg as WebhookFetchRequest).then(sendResponse);
    return true;
  }
  if (msg?.type === MSG_AI_GENERATE) {
    aiGenerate((msg as unknown as { request: GeminiRequest }).request).then(sendResponse);
    return true;
  }
  if (msg?.type === MSG_AI_MODELS) {
    aiModels().then(sendResponse);
    return true;
  }
  if (msg?.type === MSG_FETCH_FILE && typeof (msg as { url?: string }).url === 'string') {
    fetchFile((msg as { url: string }).url).then(sendResponse);
    return true;
  }
  if (msg?.type === MSG_HAS_PERMISSION && msg.origin) {
    hasPermission(msg.origin).then(sendResponse);
    return true;
  }
  if (msg?.type === MSG_REQUEST_PERMISSION && msg.origin) {
    // chrome.permissions.request precisa de um clique numa página da extensão: abre uma janelinha.
    const url = chrome.runtime.getURL(`grant.html?origin=${encodeURIComponent(msg.origin)}`);
    chrome.windows.create({ url, type: 'popup', width: 460, height: 340 }).then(() => sendResponse(true));
    return true;
  }
  return false;
});
