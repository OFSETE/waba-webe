import { t, locale, type I18nKey } from '../../../shared/i18n';
import type { HeaderButtons } from '../../../shared/types';
import { COUNTRY_DIAL, dialCodeOf, normalizePhone, parsePastedNumbers, toUserId } from '../../../shared/numbers';
import { countryItems } from '../pickers';
import { h, clear } from '../h';
import { btn, field, modal, picker, segmented, selectBox, textArea, textInput, toast, toggle } from '../components';
import { exportRows } from '../sheet';
import type { App } from '../../app';
import type { View } from '../view';

async function openNumber(app: App, raw: string): Promise<void> {
  const phone = normalizePhone(raw);
  if (!phone) return toast(t('invalidNumber'), 'error');
  try {
    const q = await app.bridge.call<{ exists: boolean; id: string }>('queryExists', { phone });
    if (!q.exists) return toast(t('noWhatsapp'), 'error');
    await app.bridge.call('openChat', { id: q.id || toUserId(phone) });
  } catch (e) {
    toast(`${t('error')}: ${e instanceof Error ? e.message : e}`, 'error');
  }
}

/** Janela "nova conversa sem salvar o número" (também usada pelo atalho Ctrl+Alt+S). */
export function openNewChatDialog(app: App): void {
  let num = '';
  const input = textInput('', (v) => (num = v), {
    placeholder: '5511987654321',
    onkeydown: (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void openNumber(app, num).then(() => m.close());
      }
    },
  });
  const m = modal(t('newChat'), [field(t('linkPhone'), input, t('newChatHint'))], (close) => [
    btn(t('cancel'), close),
    btn(t('openChat'), async () => {
      await openNumber(app, num);
      close();
    }, { variant: 'primary', icon: 'chat' }),
  ]);
  setTimeout(() => input.focus(), 50);
}

export async function openSaveContactDialog(app: App, chatId?: string): Promise<void> {
  let phone = chatId?.endsWith('@c.us') ? chatId.split('@')[0] : '';
  let first = '';
  let last = '';
  if (chatId) {
    const info = await app.contactCtx(chatId);
    const parts = (info.name || info.pushname || '').trim().split(/\s+/);
    first = parts.shift() ?? '';
    last = parts.join(' ');
    phone = info.phone || phone;
  }
  modal(t('saveContact'), [
    field(t('contactNumber'), textInput(phone, (v) => (phone = v))),
    h('div', { class: 'row' }, h('div', { class: 'grow' }, field(t('firstName'), textInput(first, (v) => (first = v)))), h('div', { class: 'grow' }, field(t('lastName'), textInput(last, (v) => (last = v))))),
  ], (close) => [
    btn(t('cancel'), close),
    btn(t('save'), async () => {
      const p = normalizePhone(phone);
      if (!p || !first.trim()) return toast(t('invalidNumber'), 'error');
      try {
        await app.bridge.call('saveContact', { id: toUserId(p), first: first.trim(), last: last.trim() });
        toast(t('contactSaved'), 'ok');
        close();
      } catch (e) {
        toast(`${t('error')}: ${e instanceof Error ? e.message : e}`, 'error');
      }
    }, { variant: 'primary' }),
  ]);
}

type ExportKind = 'contacts' | 'chats' | 'groups' | 'members' | 'broadcastLists' | 'labels' | 'messages' | 'allMessages';
/** Limite da exportação de todas as conversas (a referência também corta e avisa). */
export const EXPORT_ALL_MAX = 20000;

async function runExport(app: App, kind: ExportKind, format: 'csv' | 'xlsx' | 'txt', chatId: string, from: string, to: string, countries: string[] = []): Promise<void> {
  await app.dir.refresh(true);
  let rows: Record<string, unknown>[] = [];
  const stamp = new Date().toISOString().slice(0, 10);
  switch (kind) {
    case 'contacts':
      rows = app.dir.contacts.map((c) => ({ name: c.name, whatsapp_name: c.pushname, phone: c.phone, saved: c.isMyContact ? 'yes' : 'no', id: c.id }));
      break;
    case 'chats':
      rows = app.dir.chats.map((c) => ({ name: c.name, id: c.id, group: c.isGroup ? 'yes' : 'no', unread: c.unread, archived: c.archived ? 'yes' : 'no', pinned: c.pinned ? 'yes' : 'no', labels: c.labels.map((l) => app.dir.labelName(l)).join(', '), last_activity: c.t ? new Date(c.t * 1000).toLocaleString(locale()) : '' }));
      break;
    case 'groups':
      rows = app.dir.groups.map((g) => ({ name: g.name, id: g.id, unread: g.unread, labels: g.labels.map((l) => app.dir.labelName(l)).join(', ') }));
      break;
    case 'members': {
      if (!chatId) return toast(t('exportChat'), 'error');
      const parts = await app.bridge.call<{ id: string; phone: string; name: string; isAdmin: boolean }[]>('groupParticipants', { id: chatId });
      rows = parts.map((p) => ({ name: p.name, phone: p.phone, admin: p.isAdmin ? 'yes' : 'no', id: p.id }));
      break;
    }
    case 'broadcastLists': {
      for (const l of app.dir.broadcastLists) {
        const ids = await app.bridge.call<string[]>('broadcastMembers', { id: l.id }).catch(() => []);
        for (const id of ids) rows.push({ list: l.name, phone: id.split('@')[0], name: app.dir.nameOf(id), id });
      }
      break;
    }
    case 'allMessages': {
      const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : 0;
      const toMs = to ? new Date(`${to}T23:59:59`).getTime() : Date.now();
      const codes = countries.map((iso) => COUNTRY_DIAL[iso]).filter(Boolean);
      const r = await app.bridge.call<{ messages: { chatId: string; chatName: string; isGroup: boolean; id: string; t: number; fromMe: boolean; sender: string; type: string; body: string }[]; truncated: boolean }>('allMessages', { from: fromMs, to: toMs, max: EXPORT_ALL_MAX }, 600_000);
      rows = r.messages
        .filter((m) => !codes.length || codes.includes(dialCodeOf(m.fromMe ? m.chatId : m.sender) ?? ''))
        .map((m) => ({ datetime: new Date(m.t * 1000).toLocaleString(locale()), chat: m.chatName, group: m.isGroup ? 'yes' : 'no', from_me: m.fromMe ? 'yes' : 'no', sender: m.sender.split('@')[0], name: app.dir.nameOf(m.sender), type: m.type, text: m.body, id: m.id }));
      if (r.truncated) toast(t('exportTruncated', { n: EXPORT_ALL_MAX }), 'info');
      break;
    }
    case 'labels':
      rows = app.dir.labels.map((l) => ({ name: l.name, id: l.id, color: l.color, chats: app.dir.chats.filter((c) => c.labels.includes(l.id)).length }));
      break;
    case 'messages': {
      if (!chatId) return toast(t('exportChat'), 'error');
      const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : 0;
      const toMs = to ? new Date(`${to}T23:59:59`).getTime() : Date.now();
      const msgs = await app.bridge.call<{ id: string; t: number; fromMe: boolean; sender: string; type: string; body: string }[]>('getMessages', { chatId, from: fromMs, to: toMs }, 180_000);
      rows = msgs.map((m) => ({ datetime: new Date(m.t * 1000).toLocaleString(locale()), from_me: m.fromMe ? 'yes' : 'no', sender: m.sender.split('@')[0], name: app.dir.nameOf(m.sender), type: m.type, text: m.body, id: m.id }));
      break;
    }
  }
  if (!rows.length) return toast(t('empty'), 'error');
  exportRows(`wabawebe-${kind}-${stamp}`, rows, format);
  toast(t('exported', { n: rows.length }), 'ok');
}

export const toolsView: View = {
  id: 'tools',
  label: 'navTools',
  icon: 'tools',
  fields: ['settings'],
  render({ app }) {
    // gerador de link
    let lp = '';
    let lm = '';
    const linkOut = h('div', { class: 'row' });
    const linkCard = h('div', { class: 'card stack' },
      h('div', { style: 'font-weight:600' }, t('linkGen')),
      field(t('linkPhone'), textInput('', (v) => (lp = v), { placeholder: '5511987654321' })),
      field(t('linkMessage'), textArea('', (v) => (lm = v), { rows: 2 })),
      h('div', null, btn(t('linkGenerate'), () => {
        const p = normalizePhone(lp);
        if (!p) return toast(t('invalidNumber'), 'error');
        const url = `https://wa.me/${p}${lm.trim() ? `?text=${encodeURIComponent(lm.trim())}` : ''}`;
        clear(linkOut);
        linkOut.append(h('input', { type: 'text', value: url, readOnly: true, class: 'grow' }), btn(t('copy'), () => {
          void navigator.clipboard.writeText(url).then(() => toast(t('copied'), 'ok'));
        }, { small: true, icon: 'copy' }));
      }, { variant: 'primary', icon: 'link' })),
      linkOut,
    );

    // nova conversa
    let nc = '';
    const newChatCard = h('div', { class: 'card stack' },
      h('div', { style: 'font-weight:600' }, t('newChat')),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, textInput('', (v) => (nc = v), { placeholder: '5511987654321' })), btn(t('openChat'), () => void openNumber(app, nc), { icon: 'chat' })),
      h('div', { class: 'hint' }, t('newChatHint')),
    );

    // grupos
    let gName = '';
    let gParts = '';
    let cloneSrc = '';
    let cloneName = '';
    const cloneSelect = h('div');
    void app.dir.refresh().then(() => {
      clear(cloneSelect);
      const groups = app.dir.groups;
      cloneSrc = groups[0]?.id ?? '';
      cloneSelect.append(selectBox(groups.map((g) => ({ value: g.id, label: g.name })), cloneSrc, (v) => (cloneSrc = v)));
      clear(exportChatSel);
      exportChat = app.dir.chats[0]?.id ?? '';
      exportChatSel.append(selectBox(app.dir.chats.filter((c) => !c.isBroadcast).map((c) => ({ value: c.id, label: c.name || c.id })), exportChat, (v) => (exportChat = v)));
    });
    const groupsCard = h('div', { class: 'card stack' },
      h('div', { style: 'font-weight:600' }, t('createGroup')),
      field(t('groupName'), textInput('', (v) => (gName = v))),
      field(t('groupParticipants'), textArea('', (v) => (gParts = v), { rows: 3 })),
      h('div', null, btn(t('createGroup'), async () => {
        const ids = parsePastedNumbers(gParts).map(toUserId);
        if (!gName.trim() || !ids.length) return toast(t('groupName'), 'error');
        try {
          await app.bridge.call('createGroup', { name: gName.trim(), participants: ids }, 120_000);
          toast(t('groupCreated'), 'ok');
        } catch (e) {
          toast(`${t('error')}: ${e instanceof Error ? e.message : e}`, 'error');
        }
      }, { icon: 'plus' })),
      h('div', { style: 'font-weight:600;margin-top:6px' }, t('cloneGroup')),
      field(t('cloneSource'), cloneSelect),
      field(t('cloneName'), textInput('', (v) => (cloneName = v))),
      h('div', null, btn(t('cloneGroup'), async () => {
        if (!cloneSrc || !cloneName.trim()) return toast(t('cloneName'), 'error');
        try {
          await app.bridge.call('cloneGroup', { sourceId: cloneSrc, name: cloneName.trim() }, 180_000);
          toast(t('groupCreated'), 'ok');
        } catch (e) {
          toast(`${t('error')}: ${e instanceof Error ? e.message : e}`, 'error');
        }
      }, { icon: 'copy' })),
    );

    // exportação
    let kind: ExportKind = 'contacts';
    let format: 'csv' | 'xlsx' | 'txt' = 'xlsx';
    let countries: string[] = [];
    let exportChat = '';
    // período padrão da referência: últimos 30 dias até hoje (bootstrap.min.js 0x152f)
    const today = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let from = iso(new Date(today.getTime() - 30 * 86_400_000));
    let to = iso(today);
    const exportChatSel = h('div', null, t('loading'));
    const extra = h('div', { class: 'stack' });
    const renderExtra = () => {
      clear(extra);
      if (kind === 'members' || kind === 'messages') extra.append(field(t('exportChat'), exportChatSel));
      if (kind === 'allMessages') extra.append(field(t('exportCountries'), picker(countryItems(), countries, (ids) => (countries = ids))));
      if (kind === 'messages' || kind === 'allMessages')
        extra.append(h('div', { class: 'row' },
          h('div', { class: 'grow' }, field(t('periodFrom'), h('input', { type: 'date', value: from, oninput: (e: Event) => (from = (e.target as HTMLInputElement).value) }))),
          h('div', { class: 'grow' }, field(t('periodTo'), h('input', { type: 'date', value: to, oninput: (e: Event) => (to = (e.target as HTMLInputElement).value) }))),
        ));
    };
    renderExtra();
    const exportCard = h('div', { class: 'card stack' },
      h('div', { style: 'font-weight:600' }, t('exportTitle')),
      field(t('exportWhat'), selectBox((['contacts', 'chats', 'groups', 'members', 'broadcastLists', 'labels', 'messages', 'allMessages'] as ExportKind[]).map((k) => ({ value: k, label: t(`exp_${k}` as I18nKey) })), kind, (v) => {
        kind = v;
        renderExtra();
      })),
      extra,
      field(t('exportFormat'), segmented([{ value: 'xlsx' as const, label: 'XLSX' }, { value: 'csv' as const, label: 'CSV' }, { value: 'txt' as const, label: 'TXT' }], format, (v) => (format = v))),
      h('div', null, btn(t('exportGo'), () => void runExport(app, kind, format, exportChat, from, to, countries).catch((e) => toast(String(e), 'error')), { variant: 'primary', icon: 'download' })),
    );

    const hb = app.store.settings.headerButtons;
    const hbKeys = Object.keys(hb) as (keyof HeaderButtons)[];
    return h(
      'div',
      null,
      h('h2', null, t('toolsTitle')),
      h('p', { class: 'sub' }, t('shortcutsHint')),
      linkCard,
      newChatCard,
      h('div', { class: 'card stack' }, h('div', { style: 'font-weight:600' }, t('saveContact')), h('div', null, btn(t('saveContact'), () => void openSaveContactDialog(app), { icon: 'userPlus' }))),
      groupsCard,
      exportCard,
      h('div', { class: 'card' },
        h('div', { style: 'font-weight:600' }, t('headerButtonsTitle')),
        hbKeys.map((k) => toggle(t(`hb_${k}` as I18nKey), hb[k], (v) => app.store.update('settings', (s) => void (s.headerButtons[k] = v)))),
        toggle(t('quickRepliesToggle'), app.store.settings.quickReplies, (v) => app.store.update('settings', (s) => void (s.quickReplies = v))),
        toggle(t('mentionAllTokens'), app.store.settings.mentionAllTokens, (v) => app.store.update('settings', (s) => void (s.mentionAllTokens = v))),
      ),
    );
  },
};
