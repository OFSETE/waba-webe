// Persistência em chrome.storage.local, com cada coleção numa chave própria.

import type { CachedMsg, WwData } from './types';
import { mergeData } from './defaults';

export const KEYS: Record<keyof WwData, string> = {
  settings: 'ww.settings',
  templates: 'ww.templates',
  broadcasts: 'ww.broadcasts',
  automations: 'ww.automations',
  webhooks: 'ww.webhooks',
  queue: 'ww.queue',
  tasks: 'ww.tasks',
  deleted: 'ww.deleted',
  stats: 'ww.stats',
};

export const MSG_CACHE_KEY = 'ww.msgcache';

export async function loadAll(): Promise<WwData> {
  const raw = await chrome.storage.local.get(Object.values(KEYS));
  const partial: Partial<WwData> = {};
  for (const [field, key] of Object.entries(KEYS) as [keyof WwData, string][]) {
    if (raw[key] !== undefined) (partial as Record<string, unknown>)[field] = raw[key];
  }
  return mergeData(partial);
}

export async function saveField<K extends keyof WwData>(field: K, value: WwData[K]): Promise<void> {
  await chrome.storage.local.set({ [KEYS[field]]: value });
}

export async function saveAll(data: WwData): Promise<void> {
  const obj: Record<string, unknown> = {};
  for (const [field, key] of Object.entries(KEYS) as [keyof WwData, string][]) obj[key] = data[field];
  await chrome.storage.local.set(obj);
}

export async function loadMsgCache(): Promise<CachedMsg[]> {
  const raw = await chrome.storage.local.get(MSG_CACHE_KEY);
  const v = raw[MSG_CACHE_KEY];
  return Array.isArray(v) ? (v as CachedMsg[]) : [];
}

export async function saveMsgCache(list: CachedMsg[]): Promise<void> {
  await chrome.storage.local.set({ [MSG_CACHE_KEY]: list });
}

/** Backup completo em JSON (sem o cache de mensagens recentes e SEM a chave de API da IA). */
export function exportBackup(data: WwData): string {
  const safe: WwData = { ...data, settings: { ...data.settings, ai: { ...data.settings.ai, apiKey: '' } } };
  return JSON.stringify({ app: 'waba-webe', format: 1, exportedAt: new Date().toISOString(), data: safe }, null, 2);
}

/** Importa um backup; a chave de API já salva neste navegador é mantida quando o backup não traz uma. */
export function parseBackup(text: string, currentApiKey = ''): WwData {
  const j = JSON.parse(text) as { app?: string; data?: Partial<WwData> };
  if (!j || j.app !== 'waba-webe' || !j.data) throw new Error('invalid_backup');
  const d = mergeData(j.data);
  if (!d.settings.ai.apiKey) d.settings.ai.apiKey = currentApiKey;
  return d;
}
