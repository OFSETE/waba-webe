import type { Automation, Broadcast, Settings, Stats, Template, Webhook, WwData } from './types';
import { DEFAULT_PAYLOAD } from './webhook';
import { defaultAiSettings } from './ai';
import { DEFAULT_INTERVAL_FROM, DEFAULT_INTERVAL_TO } from './scheduler';

export function uid(prefix = ''): string {
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${r}`;
}

export function defaultSettings(): Settings {
  return {
    lang: 'pt_BR',
    theme: 'auto',
    privacy: {
      blurNames: false,
      blurPhotos: false,
      blurRecent: false,
      blurConversation: false,
      blurComposer: false,
      invisible: false,
      hideTyping: false,
      hideRecording: false,
      noReadReceipts: false,
      viewStatusHidden: false,
      listenAudioHidden: false,
      disableCalls: false,
    },
    // a referência guarda toda mídia recebida em memória, sem limite; aqui o limite por arquivo é 16 MB
    antiDelete: { enabled: false, maxMediaKb: 16384 },
    offline: false,
    quickReplies: false,
    // como a referência (bootstrap.min.js 0x1200): toda opção começa desligada
    headerButtons: {
      readUnread: false,
      pin: false,
      quickLabel: false,
      saveContact: false,
      sendTemplate: false,
      addTask: false,
      like: false,
      chatInfo: false,
      aiSuggest: false,
      translate: false,
      transcribe: false,
      downloadStatus: false,
      runAutomation: false,
      newChat: false,
    },
    background: null,
    watch: { chatIds: [], online: true, typing: true },
    mentionAllTokens: true,
    ai: defaultAiSettings(),
    customizations: { preventChatsListJumping: false, notifyOnlineActivities: false, notifyTypingRecordingActivities: false },
    pinnedChats: [],
    incoming: { enabled: false, url: '', headers: [], intervalSec: 30, ackUrl: '', lastRunAt: 0, lastError: '', received: 0 },
    termsAccepted: false,
  };
}

export function defaultStats(): Stats {
  return {
    broadcastSent: 0,
    broadcastFailed: 0,
    automationReplies: 0,
    webhooksOk: 0,
    webhooksFailed: 0,
    deletedCaught: 0,
    received: {},
    calls: {},
    daily: {},
  };
}

export function emptyData(): WwData {
  return {
    settings: defaultSettings(),
    templates: [],
    broadcasts: [],
    automations: [],
    webhooks: [],
    queue: [],
    tasks: [],
    deleted: [],
    stats: defaultStats(),
  };
}

export function newTemplate(): Template {
  return { id: uid('t_'), name: '', kind: 'text', text: '', quick: true, createdAt: Date.now() };
}

export function newBroadcast(): Broadcast {
  return {
    id: uid('b_'),
    name: '',
    templateIds: [],
    templateMode: 'all',
    targets: {
      contacts: { mode: 'none', ids: [], source: 'saved' },
      groups: { mode: 'none', ids: [], members: false, mention: false },
      labels: { mode: 'none', ids: [] },
      lists: { mode: 'none', ids: [], members: true },
      countries: { mode: 'none', ids: [] },
      sheet: { rows: [], numberFormat: 'international', ddi: '55' },
      pasted: '',
      validate: true,
    },
    intervalMin: DEFAULT_INTERVAL_FROM,
    intervalMax: DEFAULT_INTERVAL_TO,
    schedule: {
      startAt: null,
      workingHours: { enabled: false, start: '09:00', end: '17:00', days: [] },
      repeat: { kind: 'none', hours: 24, times: 3 },
    },
    post: { labelIds: [], archive: false, block: false, webhookIds: [] },
    status: 'draft',
    recipients: [],
    cursor: 0,
    runs: 0,
    nextAt: null,
    createdAt: Date.now(),
  };
}

export function newAutomation(): Automation {
  return {
    id: uid('a_'),
    name: '',
    enabled: true,
    trigger: { type: 'keyword', keywords: '', exact: false, attachmentTypes: [], callTypes: [], facebookAdId: '' },
    filters: {
      ignoreGroups: false,
      ignoreContacts: false,
      ignoreNonContacts: false,
      skipIfChatOpen: false,
      days: [],
      hours: { enabled: false, start: '08:00', end: '18:00' },
      labelIds: [],
      countries: [],
      chatIds: [],
    },
    actions: {
      templateIds: [],
      templateMode: 'all',
      delaySec: 0,
      typing: false,
      quote: false,
      addLabels: [],
      removeLabels: [],
      mark: 'none',
      archive: false,
      block: false,
      addToGroups: [],
      removeFromGroups: [],
      star: false,
      webhookIds: [],
      replyPrivately: false,
      aiReply: false,
      aiPrompt: '',
      reaction: '',
      pinChat: false,
      muteHours: 0,
      deleteChat: false,
      saveContact: { enabled: false, prefix: '' },
      notify: { chatIds: [], text: '' },
      pinMessageHours: 0,
      unmuteChat: false,
    },
    cooldownSec: 0,
    runs: 0,
    createdAt: Date.now(),
  };
}

export function newWebhook(): Webhook {
  return {
    id: uid('w_'),
    name: '',
    enabled: true,
    url: '',
    method: 'POST',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    payload: DEFAULT_PAYLOAD,
    onIncoming: false,
    onOutgoing: false,
    replyFromResponse: false,
    replyPath: 'reply',
    attachmentPath: '',
    createdAt: Date.now(),
  };
}

/** Mescla dados importados/antigos com os padrões (campos novos ganham valor padrão). */
export function mergeData(raw: Partial<WwData> | undefined | null): WwData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const s = (raw.settings ?? {}) as Partial<Settings>;
  return {
    settings: {
      ...base.settings,
      ...s,
      privacy: { ...base.settings.privacy, ...(s.privacy ?? {}) },
      antiDelete: { ...base.settings.antiDelete, ...(s.antiDelete ?? {}) },
      headerButtons: { ...base.settings.headerButtons, ...(s.headerButtons ?? {}) },
      watch: { ...base.settings.watch, ...(s.watch ?? {}) },
      ai: { ...base.settings.ai, ...(s.ai ?? {}) },
      customizations: { ...base.settings.customizations, ...(s.customizations ?? {}) },
      incoming: { ...base.settings.incoming, ...(s.incoming ?? {}) },
      pinnedChats: Array.isArray(s.pinnedChats) ? s.pinnedChats : [],
    },
    templates: Array.isArray(raw.templates) ? raw.templates : [],
    broadcasts: Array.isArray(raw.broadcasts) ? raw.broadcasts : [],
    automations: Array.isArray(raw.automations) ? raw.automations : [],
    webhooks: Array.isArray(raw.webhooks) ? raw.webhooks : [],
    queue: Array.isArray(raw.queue) ? raw.queue : [],
    // prioridade antiga "medium" passou a ser "normal" (as 4 prioridades da referência)
    tasks: Array.isArray(raw.tasks) ? raw.tasks.map((x) => ((x.priority as string) === 'medium' ? { ...x, priority: 'normal' as const } : x)) : [],
    deleted: Array.isArray(raw.deleted) ? raw.deleted : [],
    stats: { ...base.stats, ...(raw.stats ?? {}) },
  };
}
