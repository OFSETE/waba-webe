// Estado da extensão em memória, salvo em chrome.storage.local a cada mudança.

import type { WwData } from '../shared/types';
import { loadAll, saveAll, saveField } from '../shared/storage';
import { setLang } from '../shared/i18n';

type Listener = (field: keyof WwData | '*') => void;

export class Store {
  data!: WwData;
  private listeners = new Set<Listener>();
  private timers = new Map<keyof WwData, ReturnType<typeof setTimeout>>();

  async init(): Promise<void> {
    this.data = await loadAll();
    setLang(this.data.settings.lang);
    chrome.storage.onChanged?.addListener((changes, area) => {
      if (area !== 'local') return;
      // outra aba do WhatsApp Web mudou algo: recarrega
      if (Object.keys(changes).some((k) => k.startsWith('ww.') && k !== 'ww.msgcache') && !this.timers.size) {
        loadAll().then((d) => {
          if (JSON.stringify(d) !== JSON.stringify(this.data)) {
            this.data = d;
            setLang(d.settings.lang);
            this.emit('*');
          }
        });
      }
    });
  }

  get settings() {
    return this.data.settings;
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit(field: keyof WwData | '*'): void {
    this.listeners.forEach((l) => l(field));
  }

  /** Altera um campo e agenda a gravação (agrupada em 250 ms). */
  update<K extends keyof WwData>(field: K, mutate: (value: WwData[K]) => WwData[K] | void): void {
    const res = mutate(this.data[field]);
    if (res !== undefined) this.data[field] = res as WwData[K];
    if (field === 'settings') setLang(this.data.settings.lang);
    this.emit(field);
    const old = this.timers.get(field);
    if (old) clearTimeout(old);
    this.timers.set(
      field,
      setTimeout(() => {
        this.timers.delete(field);
        void saveField(field, this.data[field]);
      }, 250),
    );
  }

  async replaceAll(d: WwData): Promise<void> {
    this.data = d;
    setLang(d.settings.lang);
    await saveAll(d);
    this.emit('*');
  }

  bumpDaily(n = 1): void {
    const key = new Date().toISOString().slice(0, 10);
    this.update('stats', (s) => {
      s.daily[key] = (s.daily[key] ?? 0) + n;
      const keys = Object.keys(s.daily).sort();
      while (keys.length > 60) delete s.daily[keys.shift()!];
    });
  }
}
