import { t, locale } from '../../../shared/i18n';
import type { DeletedMsg } from '../../../shared/types';
import { h, fmtDateTime, downloadBlob } from '../h';
import { btn, confirmBox, emptyState, field, iconBtn, modal, numInput, toast, toggle } from '../components';
import type { App } from '../../app';
import type { View } from '../view';

function mediaElement(m: DeletedMsg): HTMLElement | null {
  if (!m.mediaDataUrl) return null;
  const mime = m.mime ?? '';
  if (mime.startsWith('image/') || m.type === 'image' || m.type === 'sticker') return h('img', { class: 'mediaPrev', src: m.mediaDataUrl });
  if (mime.startsWith('video/') || m.type === 'video') return h('video', { class: 'mediaPrev', src: m.mediaDataUrl, controls: true });
  if (mime.startsWith('audio/') || m.type === 'audio' || m.type === 'ptt') return h('audio', { src: m.mediaDataUrl, controls: true });
  return null;
}

async function restore(app: App, m: DeletedMsg): Promise<void> {
  try {
    if (m.body || m.caption) await app.bridge.call('setInputText', { chatId: m.chatId, text: m.body || m.caption });
    else await app.bridge.call('openChat', { id: m.chatId });
    toast(t('done'), 'ok');
  } catch (e) {
    toast(`${t('error')}: ${e instanceof Error ? e.message : e}`, 'error');
  }
}

export function viewDeleted(app: App, m: DeletedMsg): void {
  const media = mediaElement(m);
  modal(`${m.senderName || m.chatName}`, [
    h('div', { class: 'hint' }, `${m.chatName} • ${fmtDateTime(m.t * 1000, locale())} • ${t('deletedAt')} ${fmtDateTime(m.deletedAt, locale())}`),
    m.body || m.caption ? h('div', { class: 'preview' }, m.body || m.caption) : null,
    media,
    m.lat !== undefined && m.lng !== undefined ? h('div', { class: 'preview' }, `${m.lat}, ${m.lng}`) : null,
    !media && !m.body && !m.caption ? h('div', { class: 'hint' }, `[${m.type}] ${t('mediaNotKept')}`) : null,
  ], (close) => [
    m.mediaDataUrl
      ? btn(t('download'), () => {
          void fetch(m.mediaDataUrl!).then((r) => r.blob()).then((b) => downloadBlob(m.filename || `${m.type}-${m.id.slice(-8)}`, b));
        }, { icon: 'download' })
      : null,
    m.body || m.caption ? btn(t('copy'), () => void navigator.clipboard.writeText(m.body || m.caption).then(() => toast(t('copied'), 'ok')), { icon: 'copy' }) : null,
    btn(t('restore'), () => {
      void restore(app, m);
      close();
    }, { variant: 'primary', icon: 'restore' }),
  ]);
}

export const deletedView: View = {
  id: 'deleted',
  label: 'navDeleted',
  icon: 'deleted',
  fields: ['deleted', 'settings'],
  render({ app }) {
    const list = app.store.data.deleted;
    const cfg = app.store.settings.antiDelete;
    return h(
      'div',
      null,
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('deletedTitle')), list.length ? btn(t('clearAll'), async () => {
        if (await confirmBox(t('confirmDelete'))) app.store.update('deleted', () => []);
      }, { small: true, variant: 'danger' }) : null),
      h('p', { class: 'sub' }, t('deletedHint')),
      h('div', { class: 'card' },
        toggle(t('antiDeleteToggle'), cfg.enabled, (v) => app.store.update('settings', (s) => void (s.antiDelete.enabled = v))),
        // a configuração continua guardada em KB; a tela mostra e recebe MB
        field(t('maxMedia'), numInput(Math.round((cfg.maxMediaKb / 1024) * 10) / 10, (v) => app.store.update('settings', (s) => void (s.antiDelete.maxMediaKb = Math.round(Math.max(0, Math.min(16, v)) * 1024))), { min: 0, max: 16, step: 0.5 })),
      ),
      h('div', { style: 'height:10px' }),
      list.length
        ? h('div', { class: 'list' }, list.slice(0, 300).map((m) =>
            h('div', { class: 'item' },
              m.mediaDataUrl && (m.mime ?? '').startsWith('image/') ? h('img', { src: m.mediaDataUrl, style: 'width:44px;height:44px;object-fit:cover;border-radius:8px' }) : null,
              h('div', { class: 'main' },
                h('div', { class: 'name' }, m.senderName || m.chatName, m.type !== 'chat' ? h('span', { class: 'badge' }, m.type) : null),
                h('div', { class: 'meta' }, m.body || m.caption || (m.mediaDataUrl ? `[${m.type}]` : `[${m.type}] ${t('mediaNotKept')}`)),
                h('div', { class: 'meta' }, `${m.chatName} •${t('deletedAt')} ${fmtDateTime(m.deletedAt, locale())}`),
              ),
              h('div', { class: 'acts' },
                iconBtn('eye', t('view'), () => viewDeleted(app, m)),
                iconBtn('restore', t('restore'), () => void restore(app, m)),
                iconBtn('deleted', t('delete'), () => app.store.update('deleted', (l) => l.filter((x) => x.id !== m.id)), 'danger'),
              ),
            ),
          ))
        : emptyState(),
    );
  },
};
