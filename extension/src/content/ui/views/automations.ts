import { t, type I18nKey } from '../../../shared/i18n';
import type { Automation, TriggerType } from '../../../shared/types';
import { newAutomation, uid } from '../../../shared/defaults';
import { h, clear } from '../h';
import { btn, check, confirmBox, daysPicker, emptyState, field, iconBtn, modal, numInput, picker, segmented, selectBox, textArea, textInput, toast, toggle } from '../components';
import { CALL_TYPES } from '../../../shared/automation';
import { chatItems, countryItems, groupItems, labelItems, templateItems, webhookItems } from '../pickers';
import type { App } from '../../app';
import type { View } from '../view';

const TRIGGERS: TriggerType[] = ['keyword', 'outgoing', 'attachment', 'location', 'order', 'status', 'facebookAd', 'call', 'groupJoin', 'groupLeave'];
const ATT = ['image', 'video', 'audio', 'document', 'sticker', 'vcard'];
const CALLS = CALL_TYPES as readonly string[];

export async function openAutomationEditor(app: App, existing?: Automation): Promise<void> {
  await app.dir.refresh().catch(() => null);
  const a: Automation = existing ? structuredClone(existing) : newAutomation();
  const trig = h('div', { class: 'stack' });
  const renderTrigger = () => {
    clear(trig);
    if (a.trigger.type === 'keyword' || a.trigger.type === 'outgoing')
      trig.append(field(t('keywords'), textInput(a.trigger.keywords, (v) => (a.trigger.keywords = v), { placeholder: 'oi, olá, preço, *' })), check(t('exactMatch'), a.trigger.exact, (v) => (a.trigger.exact = v)));
    if (a.trigger.type === 'attachment') {
      const sel = new Set(a.trigger.attachmentTypes);
      trig.append(field(t('attachmentTypes'), h('div', { class: 'row' }, ATT.map((k) =>
        check(t(`att_${k}` as I18nKey), sel.has(k), (v) => {
          if (v) sel.add(k);
          else sel.delete(k);
          a.trigger.attachmentTypes = Array.from(sel);
        }),
      ))));
    }
    if (a.trigger.type === 'facebookAd') trig.append(field(t('facebookAdId'), textInput(a.trigger.facebookAdId ?? '', (v) => (a.trigger.facebookAdId = v.trim()))));
    if (a.trigger.type === 'call') {
      const sel = new Set(a.trigger.callTypes ?? []);
      trig.append(field(t('callTypes'), h('div', { class: 'row' }, CALLS.map((k) =>
        check(t(`call_${k}` as I18nKey), sel.has(k), (v) => {
          if (v) sel.add(k);
          else sel.delete(k);
          a.trigger.callTypes = Array.from(sel);
        }),
      ))));
    }
  };
  renderTrigger();

  const f = a.filters;
  const act = a.actions;
  modal(
    existing ? t('edit') : t('newAutomation'),
    [
      field(t('automationName'), textInput(a.name, (v) => (a.name = v))),
      h('h3', null, t('trigger')),
      selectBox(TRIGGERS.map((x) => ({ value: x, label: t(`trigger_${x}` as I18nKey) })), a.trigger.type, (v) => {
        a.trigger.type = v;
        renderTrigger();
      }),
      trig,
      h('h3', null, t('filters')),
      h('div', { class: 'card' },
        toggle(t('ignoreGroups'), f.ignoreGroups, (v) => (f.ignoreGroups = v)),
        toggle(t('ignoreContacts'), f.ignoreContacts, (v) => (f.ignoreContacts = v)),
        toggle(t('ignoreNonContacts'), f.ignoreNonContacts, (v) => (f.ignoreNonContacts = v)),
        toggle(t('skipIfChatOpen'), f.skipIfChatOpen, (v) => (f.skipIfChatOpen = v)),
      ),
      field(t('days'), daysPicker(f.days, (d) => (f.days = d)), t('mode_all')),
      h('div', { class: 'card stack' },
        toggle(t('onlyHours'), f.hours.enabled, (v) => (f.hours.enabled = v)),
        h('div', { class: 'row' },
          t('start'), h('input', { type: 'time', value: f.hours.start, style: 'width:110px', oninput: (e: Event) => (f.hours.start = (e.target as HTMLInputElement).value) }),
          t('end'), h('input', { type: 'time', value: f.hours.end, style: 'width:110px', oninput: (e: Event) => (f.hours.end = (e.target as HTMLInputElement).value) }),
        ),
      ),
      field(t('onlyLabels'), picker(labelItems(app), f.labelIds, (ids) => (f.labelIds = ids), { emptyText: t('noLabels') })),
      field(t('onlyCountries'), picker(countryItems(), f.countries, (ids) => (f.countries = ids))),
      field(t('onlyChats'), picker(chatItems(app), f.chatIds, (ids) => (f.chatIds = ids))),
      field(t('cooldown'), numInput(a.cooldownSec, (v) => (a.cooldownSec = Math.max(0, v)), { min: 0 })),
      h('h3', null, t('actions')),
      h('div', { class: 'card stack' },
        toggle(t('aiReply'), !!act.aiReply, (v) => (act.aiReply = v), app.ai.configured ? t('aiReplyHint') : t('aiNoKey')),
        field(t('aiPrompt'), textArea(act.aiPrompt ?? '', (v) => (act.aiPrompt = v), { rows: 2 })),
      ),
      field(t('replyWith'), picker(templateItems(app), act.templateIds, (ids) => (act.templateIds = ids))),
      segmented([
        { value: 'all' as const, label: t('templateModeAll') },
        { value: 'random' as const, label: t('templateModeRandom') },
      ], act.templateMode, (v) => (act.templateMode = v)),
      field(t('delayBefore'), numInput(act.delaySec, (v) => (act.delaySec = Math.max(0, v)), { min: 0 })),
      h('div', { class: 'card' },
        toggle(t('showTyping'), act.typing, (v) => (act.typing = v)),
        toggle(t('quoteMessage'), act.quote, (v) => (act.quote = v)),
        toggle(t('replyPrivately'), !!act.replyPrivately, (v) => (act.replyPrivately = v)),
        toggle(t('starMessage'), act.star, (v) => (act.star = v)),
        toggle(t('archiveChat'), act.archive, (v) => (act.archive = v)),
        toggle(t('blockUser'), act.block, (v) => (act.block = v)),
        toggle(t('pinChatAction'), !!act.pinChat, (v) => (act.pinChat = v)),
        toggle(t('deleteChatAction'), !!act.deleteChat, (v) => (act.deleteChat = v)),
        toggle(t('unmuteChat'), !!act.unmuteChat, (v) => (act.unmuteChat = v)),
        toggle(t('saveContactAction'), !!act.saveContact?.enabled, (v) => (act.saveContact = { prefix: act.saveContact?.prefix ?? '', enabled: v })),
      ),
      field(t('pinMessage'), selectBox(['0', '24', '168', '720'].map((v) => ({ value: v, label: t(`pin_${v}` as I18nKey) })), String(act.pinMessageHours ?? 0), (v) => (act.pinMessageHours = Number(v)))),
      field(t('saveContactPrefix'), textInput(act.saveContact?.prefix ?? '', (v) => (act.saveContact = { enabled: act.saveContact?.enabled ?? false, prefix: v }))),
      h('div', { class: 'row' },
        h('div', { class: 'grow' }, field(t('reaction'), textInput(act.reaction ?? '', (v) => (act.reaction = v.trim()), { placeholder: '👍 ❤️ 🙏' }))),
        h('div', { class: 'grow' }, field(t('muteHours'), numInput(act.muteHours ?? 0, (v) => (act.muteHours = v < 0 ? -1 : v), { min: -1 }))),
      ),
      field(t('notifyChats'), picker(chatItems(app), act.notify?.chatIds ?? [], (ids) => (act.notify = { text: act.notify?.text ?? '', chatIds: ids }))),
      field(t('notifyText'), textArea(act.notify?.text ?? '', (v) => (act.notify = { chatIds: act.notify?.chatIds ?? [], text: v }), { rows: 2, placeholder: 'Novo contato: ${waName} (${phone}) disse: ${messageContent}' })),
      field(t('markAs'), segmented((['none', 'read', 'unread'] as const).map((m) => ({ value: m, label: t(`mark_${m}` as I18nKey) })), act.mark, (v) => (act.mark = v))),
      field(t('addLabels'), picker(labelItems(app), act.addLabels, (ids) => (act.addLabels = ids), { emptyText: t('noLabels') })),
      field(t('removeLabels'), picker(labelItems(app), act.removeLabels, (ids) => (act.removeLabels = ids), { emptyText: t('noLabels') })),
      field(t('addToGroups'), picker(groupItems(app), act.addToGroups, (ids) => (act.addToGroups = ids))),
      field(t('removeFromGroups'), picker(groupItems(app), act.removeFromGroups, (ids) => (act.removeFromGroups = ids))),
      field(t('fireWebhooks'), picker(webhookItems(app), act.webhookIds, (ids) => (act.webhookIds = ids))),
    ],
    (close) => [
      btn(t('cancel'), close),
      btn(t('save'), () => {
        if (!a.name.trim()) a.name = t(`trigger_${a.trigger.type}` as I18nKey);
        if (a.trigger.type === 'keyword' && !a.trigger.keywords.trim()) return toast(t('keywords'), 'error');
        app.store.update('automations', (list) => {
          const i = list.findIndex((x) => x.id === a.id);
          if (i >= 0) list[i] = a;
          else list.push(a);
        });
        toast(t('saved'), 'ok');
        close();
      }, { variant: 'primary' }),
    ],
    { wide: true },
  );
}

export const automationsView: View = {
  id: 'automations',
  label: 'navAutomations',
  icon: 'automations',
  fields: ['automations', 'settings'],
  render({ app }) {
    const list = app.store.data.automations;
    return h(
      'div',
      null,
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('automationsTitle')), btn(t('newAutomation'), () => void openAutomationEditor(app), { variant: 'primary', icon: 'plus' })),
      app.store.settings.offline ? h('div', { class: 'banner', style: 'margin-top:8px' }, t('offlineOn')) : null,
      h('div', { style: 'height:10px' }),
      list.length
        ? h('div', { class: 'list' }, list.map((a) =>
            h('div', { class: 'item' },
              h('label', { class: 'toggle', title: a.enabled ? t('enabled') : t('disabled') },
                h('input', { type: 'checkbox', checked: a.enabled, onchange: (e: Event) => app.store.update('automations', (l) => l.map((x) => (x.id === a.id ? { ...x, enabled: (e.target as HTMLInputElement).checked } : x))) }),
                h('span', { class: 'sw' }),
              ),
              h('div', { class: 'main' },
                h('div', { class: 'name' }, a.name, h('span', { class: 'badge' }, `${a.runs} ${t('runs')}`)),
                h('div', { class: 'meta' }, t(`trigger_${a.trigger.type}` as I18nKey), a.trigger.type === 'keyword' ? `: ${a.trigger.keywords}` : ''),
              ),
              h('div', { class: 'acts' },
                iconBtn('play', t('runNow'), async () => {
                  const chatId = app.activeChatId ?? (await app.bridge.call<string | null>('activeChat').catch(() => null));
                  if (!chatId) return toast(t('noActiveChat'), 'error');
                  await app.runAutomationNow(a, chatId).then(() => toast(t('done'), 'ok')).catch((e) => toast(String(e), 'error'));
                }),
                iconBtn('edit', t('edit'), () => void openAutomationEditor(app, a)),
                iconBtn('copy', t('duplicate'), () => app.store.update('automations', (l) => void l.push({ ...structuredClone(a), id: uid('a_'), name: `${a.name} (2)`, runs: 0, enabled: false, createdAt: Date.now() }))),
                iconBtn('deleted', t('delete'), async () => {
                  if (await confirmBox(t('confirmDelete'))) app.store.update('automations', (l) => l.filter((x) => x.id !== a.id));
                }, 'danger'),
              ),
            ),
          ))
        : emptyState(),
    );
  },
};
