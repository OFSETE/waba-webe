// Monta o app (estado + motores + painel). Usado pelo content script e pela pré-visualização.

import type { MsgEvent, PrivacySettings } from '../shared/types';
import { t } from '../shared/i18n';
import { callTypeOf, hasMentionAllToken, toggleAll } from '../shared/automation';
import { IncomingPoller } from './engine/incoming';
import { LocalPins, PreventListJump, StatusDownloader, ToolbarButton } from './dom/extras';
import { App, type RuntimeLike } from './app';
import type { Bridge } from './bridge';
import { Store } from './store';
import { AntiDelete } from './engine/antidelete';
import { AutomationRunner } from './engine/automation';
import { BroadcastRunner } from './engine/broadcast';
import { PresenceWatch, Reminders } from './engine/reminders';
import { WebhookQueue } from './engine/webhooks';
import { AiClient } from './engine/ai';
import { Panel } from './ui/panel';
import { homeView } from './ui/views/home';
import { privacyView } from './ui/views/privacy';
import { templatesView } from './ui/views/templates';
import { broadcastsView } from './ui/views/broadcasts';
import { automationsView } from './ui/views/automations';
import { webhooksView } from './ui/views/webhooks';
import { openNewChatDialog, toolsView } from './ui/views/tools';
import { tasksView } from './ui/views/tasks';
import { deletedView } from './ui/views/deleted';
import { watchView } from './ui/views/watch';
import { settingsView } from './ui/views/settings';
import { aiView } from './ui/views/ai';
import { applyPageStyle } from './dom/page-style';
import { HeaderButtons, MessageAiButtons, QuickReplies, QuickReplyBar } from './dom/header';

export interface Booted {
  app: App;
  panel: Panel;
  broadcasts: BroadcastRunner;
  webhooks: WebhookQueue;
  incoming: IncomingPoller;
}

export async function bootApp(bridge: Bridge, runtime: RuntimeLike, opts: { pageDom: boolean; engines?: boolean }): Promise<Booted> {
  const store = new Store();
  await store.init();
  const app = new App(store, bridge, runtime);
  app.ai = new AiClient(app);

  const webhooks = new WebhookQueue(app);
  const broadcasts = new BroadcastRunner(app, webhooks);
  const automations = new AutomationRunner(app, webhooks);
  const antiDelete = new AntiDelete(app);
  const reminders = new Reminders(app);
  const presence = new PresenceWatch(app);
  const incoming = new IncomingPoller(app);
  const listJump = new PreventListJump(app);
  const localPins = new LocalPins(app);
  app.localPins = localPins;
  app.incoming = incoming;
  // estatísticas: mensagens recebidas por tipo (a referência mostra contadores por tipo)
  const countReceived = (type: string) =>
    store.update('stats', (s) => {
      const k = type === 'ptt' ? 'audio' : type;
      s.received = { ...(s.received ?? {}), [k]: (s.received?.[k] ?? 0) + 1 };
    });
  await antiDelete.load();

  const panel = new Panel(app, [
    homeView,
    privacyView,
    templatesView,
    broadcastsView(broadcasts),
    automationsView,
    webhooksView(webhooks),
    aiView,
    toolsView,
    tasksView,
    deletedView,
    watchView,
    settingsView,
  ]);

  // privacidade: CSS na página + patches na página (reaplicados quando mudam)
  let lastPrivacy = '';
  const pushPrivacy = () => {
    const p: PrivacySettings = store.settings.privacy;
    const key = JSON.stringify(p);
    if (key === lastPrivacy || !app.pageReady) return;
    lastPrivacy = key;
    bridge
      .call<string[]>('setPrivacy', p)
      .then((failed) => {
        if (failed?.length) app.ui.toast(`${t('privacyNote')} (${failed.join(', ')})`, 'error');
      })
      .catch(() => (lastPrivacy = ''));
  };
  if (opts.pageDom) applyPageStyle(store.settings);
  store.subscribe((f) => {
    if (f === 'settings' || f === '*') {
      if (opts.pageDom) applyPageStyle(store.settings);
      pushPrivacy();
      void presence.subscribe();
    }
  });

  const onReady = () => {
    app.pageReady = true;
    panel.setReady(true);
    pushPrivacy();
    void presence.subscribe();
    void app.dir.refresh(true);
    void bridge.call<string | null>('activeChat').then((id) => (app.activeChatId = id)).catch(() => null);
    void localPins.apply();
  };
  bridge.on('ready', onReady);
  bridge.on('message', (ev: MsgEvent) => {
    if (ev.fromMe && ev.isGroup && store.settings.mentionAllTokens && hasMentionAllToken(`${ev.body} ${ev.caption}`))
      void bridge.call('mentionAll', { chatId: ev.chatId }).catch(() => null);
    if (ev.fromMe) listJump.onSent();
    else countReceived(ev.type);
    antiDelete.onMessage(ev);
    webhooks.onMessage(ev);
    automations.onMessage(ev);
  });
  bridge.on('revoke', (r) => antiDelete.onRevoke(r));
  bridge.on('call', (c: { isGroup: boolean; isVideo?: boolean; from: string }) => {
    store.update('stats', (s) => {
      const k = callTypeOf(c.isGroup, !!c.isVideo);
      s.calls = { ...(s.calls ?? {}), [k]: (s.calls?.[k] ?? 0) + 1 };
    });
    void automations.onCall(c);
  });
  bridge.on('status', (ev: MsgEvent) => automations.onStatus(ev));
  app.runAutomationNow = (a, chatId) => automations.runNow(a, chatId);
  bridge.on('group', (g) => void automations.onGroup(g));
  bridge.on('presence', (p) => presence.onPresence(p));
  bridge.on('activeChat', (a: { id: string | null }) => (app.activeChatId = a.id));

  // a página pode ter ficado pronta antes do content escutar
  const probe = async () => {
    for (let i = 0; i < 240 && !app.pageReady; i++) {
      const s = await bridge.call<{ ready: boolean }>('status', undefined, 3000).catch(() => null);
      if (s?.ready) {
        onReady();
        break;
      }
      await new Promise((r) => setTimeout(r, 2500));
    }
  };
  void probe();

  if (opts.engines !== false) {
    incoming.start();
    webhooks.start();
    broadcasts.start();
    reminders.start();
  }

  if (opts.pageDom) {
    new HeaderButtons(app).start();
    new QuickReplies(app).start();
    new QuickReplyBar(app).start();
    new MessageAiButtons(app).start();
    new ToolbarButton(app, () => panel.toggle(), (v) => panel.setFabVisible(v)).start();
    listJump.start();
    localPins.start();
    new StatusDownloader(app).start();
    // Atalhos como na referência (bootstrap.min.js 0x17a80, evento keyup):
    // Ctrl+Alt+S nova conversa; só Alt + P/B liga ou desliga todo o grupo; Esc fecha o painel.
    document.addEventListener(
      'keyup',
      (e) => {
        if (e.ctrlKey && e.altKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          openNewChatDialog(app);
          return;
        }
        if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
          const group = ({ KeyP: 'privacy', KeyB: 'headerButtons', KeyC: 'customizations' } as const)[e.code as 'KeyP' | 'KeyB' | 'KeyC'];
          if (!group) return;
          e.preventDefault();
          let on = false;
          store.update('settings', (s) => {
            const next = toggleAll({ ...s[group] } as unknown as Record<string, boolean>);
            on = Object.values(next).every(Boolean);
            (s as unknown as Record<string, unknown>)[group] = next;
          });
          app.ui.toast(on ? t('allOn') : t('allOff'), 'ok');
          return;
        }
        if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && panel.isOpen && !panel.root.querySelector('.overlay')) panel.close();
      },
      true,
    );
  }

  return { app, panel, broadcasts, webhooks, incoming };
}
