// Nomes dos eventos da ponte content ↔ página e das mensagens com o background.

export const EV_REQ = 'wabawebe:req';
export const EV_RES = 'wabawebe:res';
export const EV_EVT = 'wabawebe:evt';

export interface BridgeRequest {
  id: string;
  method: string;
  params?: unknown;
}

export interface BridgeResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface BridgeEvent {
  event: string;
  data: unknown;
}

/* Mensagens entre content e background (chrome.runtime). */
export const MSG_OPEN_PANEL = 'WW_OPEN_PANEL';
export const MSG_WEBHOOK_FETCH = 'WW_WEBHOOK_FETCH';
export const MSG_HAS_PERMISSION = 'WW_HAS_PERMISSION';
export const MSG_REQUEST_PERMISSION = 'WW_REQUEST_PERMISSION';
export const MSG_FETCH_FILE = 'WW_FETCH_FILE';
export const MSG_AI_GENERATE = 'WW_AI_GENERATE';
export const MSG_AI_MODELS = 'WW_AI_MODELS';

export interface WebhookFetchRequest {
  type: typeof MSG_WEBHOOK_FETCH;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

export interface WebhookFetchResult {
  ok: boolean;
  status: number;
  contentType: string;
  body: string;
  error?: string;
}
