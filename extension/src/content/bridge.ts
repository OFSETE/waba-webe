// Ponte do content script para a página (wa-js), com ids de requisição e Promises.

import { EV_EVT, EV_REQ, EV_RES, type BridgeEvent, type BridgeResponse } from '../shared/protocol';

export type EventHandler = (data: any) => void;

export interface Bridge {
  readonly ready: boolean;
  call<T = any>(method: string, params?: unknown, timeoutMs?: number): Promise<T>;
  on(event: string, cb: EventHandler): () => void;
}

export class PageBridge implements Bridge {
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private listeners = new Map<string, Set<EventHandler>>();
  private seq = 0;
  ready = false;

  constructor() {
    document.addEventListener(EV_RES, (e) => {
      let res: BridgeResponse;
      try {
        res = JSON.parse(String((e as CustomEvent).detail));
      } catch {
        return;
      }
      const p = this.pending.get(res.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(res.id);
      if (res.ok) p.resolve(res.result);
      else p.reject(new Error(res.error || 'error'));
    });
    document.addEventListener(EV_EVT, (e) => {
      let ev: BridgeEvent;
      try {
        ev = JSON.parse(String((e as CustomEvent).detail));
      } catch {
        return;
      }
      if (ev.event === 'ready') this.ready = true;
      this.listeners.get(ev.event)?.forEach((cb) => {
        try {
          cb(ev.data);
        } catch (err) {
          console.warn('[WABA WEBE]', ev.event, err);
        }
      });
    });
  }

  call<T = any>(method: string, params?: unknown, timeoutMs = 60_000): Promise<T> {
    const id = `r${Date.now().toString(36)}${(this.seq++).toString(36)}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('timeout'));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      document.dispatchEvent(new CustomEvent(EV_REQ, { detail: JSON.stringify({ id, method, params }) }));
    });
  }

  on(event: string, cb: EventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }
}

/** Injeta, em ordem, os scripts que rodam no contexto da página. */
export async function injectPageScripts(files: string[]): Promise<void> {
  for (const f of files) {
    await new Promise<void>((resolve) => {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL(f);
      s.async = false;
      s.onload = () => {
        s.remove();
        resolve();
      };
      s.onerror = () => {
        console.warn('[WABA WEBE] não foi possível carregar', f);
        resolve();
      };
      (document.head || document.documentElement).appendChild(s);
    });
  }
}
