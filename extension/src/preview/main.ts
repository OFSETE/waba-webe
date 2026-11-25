// Pré-visualização do painel fora do WhatsApp Web, com dados de exemplo (sem rede, sem conta).
// Usada para conferir a interface e para tirar a captura de tela (main.py --screenshot).

import type { Bridge, EventHandler } from '../content/bridge';
import type { ChatInfo, ContactInfo, LabelInfo, WwData } from '../shared/types';
import { KEYS } from '../shared/storage';
import { newAutomation, newBroadcast, newTemplate, newWebhook, defaultStats } from '../shared/defaults';

/* ---------- chrome.* simulado ---------- */
const mem = new Map<string, unknown>();
const chromeMock = {
  storage: {
    local: {
      get: async (keys: string | string[]) => {
        const out: Record<string, unknown> = {};
        for (const k of Array.isArray(keys) ? keys : [keys]) if (mem.has(k)) out[k] = structuredClone(mem.get(k));
        return out;
      },
      set: async (obj: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) mem.set(k, structuredClone(v));
      },
    },
    onChanged: { addListener: () => undefined },
  },
  runtime: {
    getURL: (p: string) => p,
    getManifest: () => ({ version: 'preview' }),
    sendMessage: async () => ({ ok: true, status: 200, contentType: 'text/plain', body: '' }),
    onMessage: { addListener: () => undefined },
  },
};
(globalThis as unknown as { chrome: unknown }).chrome = chromeMock;

/* ---------- dados de exemplo ---------- */
const params = new URLSearchParams(location.search);
const lang = (['pt_BR', 'en', 'es', 'ar', 'ru', 'tr'] as const).find((l) => l === params.get('lang')) ?? 'pt_BR';
const theme = (params.get('theme') as 'light' | 'dark' | null) ?? 'light';

const chats: ChatInfo[] = [
  { id: '5511987650001@c.us', name: 'Ana Ribeiro', isGroup: false, isBroadcast: false, archived: false, pinned: true, unread: 2, labels: ['1'], t: 1764000000 },
  { id: '5521976540002@c.us', name: 'Bruno Lima', isGroup: false, isBroadcast: false, archived: false, pinned: false, unread: 0, labels: [], t: 1763990000 },
  { id: '120363000000000001@g.us', name: 'Equipe de vendas', isGroup: true, isBroadcast: false, archived: false, pinned: false, unread: 5, labels: ['2'], t: 1763980000 },
  { id: '351912340003@c.us', name: 'Carla Mendes', isGroup: false, isBroadcast: false, archived: false, pinned: false, unread: 0, labels: [], t: 1763970000 },
];
const contacts: ContactInfo[] = chats.filter((c) => !c.isGroup).map((c) => ({ id: c.id, name: c.name, pushname: c.name.split(' ')[0], phone: c.id.split('@')[0], isMyContact: true }));
const labels: LabelInfo[] = [
  { id: '1', name: 'Cliente novo', color: '#14b8a6', count: 1 },
  { id: '2', name: 'Pedido pago', color: '#f59e0b', count: 1 },
];

function seed(): void {
  const tpl1 = { ...newTemplate(), name: 'Boas-vindas', text: '{Olá|Oi} ${contactNameFirst}! Obrigado pelo contato 😊' };
  const tpl2 = { ...newTemplate(), name: 'Chave PIX', kind: 'pix' as const, text: '', pix: { keyType: 'EMAIL' as const, key: 'pagamentos@exemplo.com', name: 'Loja Exemplo', instructions: '' } };
  const tpl3 = { ...newTemplate(), name: 'Horário', text: 'Atendemos de seg. a sex., das 8h às 18h. Hoje é ${date}.' };
  const b = { ...newBroadcast(), name: 'Promoção de novembro', templateIds: [tpl1.id], status: 'running' as const, nextAt: Date.now() + 14_000 };
  b.recipients = Array.from({ length: 40 }, (_, i) => ({ id: `55119876${String(i).padStart(5, '0')}@c.us`, status: i < 26 ? ('sent' as const) : i < 28 ? ('invalid' as const) : ('pending' as const) }));
  b.cursor = 28;
  const b2 = { ...newBroadcast(), name: 'Lembrete de consulta', templateIds: [tpl3.id], status: 'scheduled' as const, nextAt: Date.now() + 86_400_000 };
  const a1 = { ...newAutomation(), name: 'Resposta de saudação', trigger: { type: 'keyword' as const, keywords: 'oi, olá, bom dia', exact: false, attachmentTypes: [] }, runs: 37 };
  a1.actions.templateIds = [tpl1.id];
  const a2 = { ...newAutomation(), name: 'Fora do horário', trigger: { type: 'keyword' as const, keywords: '*', exact: false, attachmentTypes: [] }, runs: 12, enabled: false };
  const w = { ...newWebhook(), name: 'Meu CRM', url: 'https://crm.exemplo.com/hooks/whatsapp' };
  const stats = { ...defaultStats(), broadcastSent: 1284, automationReplies: 342, deletedCaught: 19, webhooksOk: 902, broadcastFailed: 7 };
  for (let i = 6; i >= 0; i--) stats.daily[new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)] = [42, 77, 31, 96, 64, 120, 58][6 - i];
  const data: Partial<WwData> = {
    settings: undefined,
    templates: [tpl1, tpl2, tpl3],
    broadcasts: [b, b2],
    automations: [a1, a2],
    webhooks: [w],
    tasks: [{ id: 'k1', chatId: chats[0].id, chatName: chats[0].name, title: 'Enviar orçamento', description: '', priority: 'high', due: Date.now() + 7_200_000, notify: true, notified: false, done: false, createdAt: Date.now() }],
    deleted: [{ id: 'd1', chatId: chats[1].id, chatName: chats[1].name, sender: chats[1].id, senderName: chats[1].name, type: 'chat', body: 'Mensagem de exemplo que foi apagada', caption: '', t: Math.floor(Date.now() / 1000) - 600, deletedAt: Date.now() - 300_000 }],
    stats,
  };
  for (const [field, key] of Object.entries(KEYS)) {
    const v = (data as Record<string, unknown>)[field];
    if (v !== undefined) mem.set(key, v);
  }
  mem.set(KEYS.settings, { lang, theme, quickReplies: true, headerButtons: { readUnread: true, pin: true, quickLabel: true, saveContact: true, sendTemplate: true, addTask: true } });
}

class MockBridge implements Bridge {
  ready = true;
  private listeners = new Map<string, Set<EventHandler>>();
  async call<T>(method: string): Promise<T> {
    const r: Record<string, unknown> = {
      status: { ready: true, me: '5511900000000@c.us' },
      listChats: chats,
      listContacts: contacts,
      listLabels: labels,
      activeChat: chats[0].id,
      setPrivacy: [],
    };
    return (r[method] ?? null) as T;
  }
  on(event: string, cb: EventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }
  emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}

async function run(): Promise<void> {
  seed();
  const { bootApp } = await import('../content/boot');
  const bridge = new MockBridge();
  const { panel, app, broadcasts, webhooks } = await bootApp(bridge, { send: async <T>() => ({ ok: true, status: 200 }) as T }, { pageDom: false, engines: false });
  bridge.emit('ready', {});
  app.activeChatId = chats[0].id;
  const dom = await import('../content/dom/header');
  new dom.HeaderButtons(app).start();
  new dom.QuickReplyBar(app).start();
  const extras = await import('../content/dom/extras');
  new extras.ToolbarButton(app, () => panel.toggle(), (v) => panel.setFabVisible(v)).start();
  await new Promise((r) => setTimeout(r, 600));
  if (params.get('panel') !== 'closed') panel.open(params.get('tab') ?? 'home');
  // ?open=template|broadcast|automation|webhook|task|newchat abre uma janela de edição
  const open = params.get('open');
  if (open === 'template') (await import('../content/ui/views/templates')).openTemplateEditor(app, app.store.data.templates[0]);
  if (open === 'broadcast') await (await import('../content/ui/views/broadcasts')).openBroadcastEditor(app, broadcasts);
  if (open === 'automation') await (await import('../content/ui/views/automations')).openAutomationEditor(app, app.store.data.automations[0]);
  if (open === 'webhook') (await import('../content/ui/views/webhooks')).openWebhookEditor(app, webhooks, app.store.data.webhooks[0]);
  if (open === 'task') await (await import('../content/ui/views/tasks')).openTaskEditor(app);
  if (open === 'newchat') (await import('../content/ui/views/tools')).openNewChatDialog(app);
  document.body.dataset.ready = '1';
}

void run();
