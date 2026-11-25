import { t, locale, type I18nKey } from '../../../shared/i18n';
import { h, clear } from '../h';
import { toggle } from '../components';
import type { App } from '../../app';
import type { View } from '../view';

export const homeView: View = {
  id: 'home',
  label: 'navHome',
  icon: 'home',
  fields: ['settings', 'stats', 'templates', 'automations', 'tasks'],
  render({ app }) {
    const d = app.store.data;
    const s = d.stats;
    const stat = (v: number, l: string) => h('div', { class: 'stat' }, h('div', { class: 'v' }, v.toLocaleString(locale())), h('div', { class: 'l' }, l));
    const days: { key: string; label: string; v: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(Date.now() - i * 86_400_000);
      const key = dt.toISOString().slice(0, 10);
      days.push({ key, label: dt.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', ''), v: s.daily[key] ?? 0 });
    }
    const max = Math.max(1, ...days.map((x) => x.v));
    return h(
      'div',
      null,
      h('h2', null, t('homeTitle')),
      h('p', { class: 'sub' }, t('homeSubtitle')),
      d.settings.offline ? h('div', { class: 'banner' }, t('offlineOn')) : null,
      h('div', { class: 'card' }, toggle(t('offlineMode'), d.settings.offline, (v) => app.store.update('settings', (st) => void (st.offline = v)), t('offlineHint'))),
      h('h3', null, t('navHome')),
      h(
        'div',
        { class: 'stats' },
        stat(s.broadcastSent, t('statBroadcastSent')),
        stat(s.automationReplies, t('statAutomation')),
        stat(s.deletedCaught, t('statDeleted')),
        stat(s.webhooksOk, t('statWebhooksOk')),
        stat(d.templates.length, t('statTemplates')),
        stat(d.automations.filter((a) => a.enabled).length, t('statActiveAutomations')),
        stat(d.tasks.filter((x) => !x.done).length, t('statPendingTasks')),
        stat(s.broadcastFailed + s.webhooksFailed, `${t('statBroadcastFailed')} / ${t('statWebhooksFailed')}`),
      ),
      h('h3', null, t('last7days')),
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'bars' }, days.map((x) => h('div', { class: 'b', title: `${x.key}: ${x.v}` }, h('span', null, String(x.v)), h('i', { style: `height:${Math.round((x.v / max) * 64)}px` }), x.label))),
      ),
      waStats(app, stat),
      typeStats(t('receivedByType'), s.received ?? {}, (k) => t((`t_${['chat', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'vcard'].includes(k) ? k : 'other'}`) as I18nKey)),
      typeStats(t('callsByType'), s.calls ?? {}, (k) => t(`call_${k}` as I18nKey)),
    );
  },
};

type Counts = Record<'contacts' | 'savedContacts' | 'groups' | 'chats' | 'unreadChats' | 'archived' | 'labels' | 'broadcastLists' | 'channels' | 'calls' | 'products' | 'blocked', number>;
let lastCounts: Counts | null = null;
let lastCountsAt = 0;

/** Números do WhatsApp (contatos, grupos, conversas, canais, etiquetas, chamadas, produtos), como a referência. */
function waStats(app: App, stat: (v: number, l: string) => HTMLElement): HTMLElement {
  const box = h('div', { class: 'stats' });
  const fill = (c: Counts) => {
    clear(box);
    (Object.keys(c) as (keyof Counts)[]).forEach((k) => box.append(stat(c[k], t(`st_${k}` as I18nKey))));
  };
  if (lastCounts) fill(lastCounts);
  else box.append(h('div', { class: 'hint' }, t('loading')));
  if (app.pageReady && Date.now() - lastCountsAt > 60_000) {
    lastCountsAt = Date.now();
    void app.bridge
      .call<Counts>('counts', undefined, 60_000)
      .then((c) => {
        lastCounts = c;
        fill(c);
      })
      .catch(() => null);
  }
  return h('div', null, h('h3', null, t('statsTitle')), box);
}

function typeStats(title: string, counts: Record<string, number>, label: (k: string) => string): HTMLElement | null {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return h('div', null,
    h('h3', null, title),
    h('div', { class: 'card stack' }, entries.map(([k, v]) =>
      h('div', null,
        h('div', { class: 'row', style: 'justify-content:space-between;font-size:12.5px' }, h('span', null, label(k)), h('b', null, v.toLocaleString(locale()))),
        h('div', { class: 'progress' }, h('i', { style: `width:${Math.round((v / max) * 100)}%` })),
      ),
    )),
  );
}
