import { t } from '../../../shared/i18n';
import { h, clear } from '../h';
import { picker, toggle } from '../components';
import type { View } from '../view';

export const watchView: View = {
  id: 'watch',
  label: 'navWatch',
  icon: 'watch',
  fields: [],
  render({ app }) {
    const w = app.store.settings.watch;
    const area = h('div', null, t('loading'));
    void app.dir.refresh().then(() => {
      clear(area);
      const items = app.dir.chats
        .filter((c) => !c.isGroup && !c.isBroadcast)
        .map((c) => ({ id: c.id, label: c.name || c.id.split('@')[0], sub: c.id.endsWith('@c.us') ? `+${c.id.split('@')[0]}` : '' }));
      area.append(picker(items, w.chatIds, (ids) => app.store.update('settings', (s) => void (s.watch.chatIds = ids))));
    });
    return h(
      'div',
      null,
      h('h2', null, t('watchTitle')),
      h('p', { class: 'sub' }, t('watchHint')),
      h('div', { class: 'card' },
        toggle(t('watchOnline'), w.online, (v) => app.store.update('settings', (s) => void (s.watch.online = v))),
        toggle(t('watchTyping'), w.typing, (v) => app.store.update('settings', (s) => void (s.watch.typing = v))),
      ),
      h('div', { style: 'height:10px' }),
      area,
    );
  },
};
