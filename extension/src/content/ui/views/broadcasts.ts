import { t, locale, type I18nKey } from '../../../shared/i18n';
import type { Broadcast, RepeatKind, SelectMode, TargetSelection } from '../../../shared/types';
import { newBroadcast, uid } from '../../../shared/defaults';
import { progressOf, validInterval } from '../../../shared/scheduler';
import { broadcastRisk } from '../../../shared/extras';
import { rowsToRecipients } from '../../../shared/numbers';
import { h, clear, fmtDateTime, fromLocalInput, pickFile, toLocalInput } from '../h';
import { btn, check, confirmBox, daysPicker, emptyState, field, iconBtn, modal, numInput, picker, segmented, selectBox, textArea, textInput, toast, toggle, type PickItem } from '../components';
import { contactItems, countryItems, groupItems, labelItems, listItems, templateItems, webhookItems } from '../pickers';
import { readSheetFile } from '../sheet';
import type { App } from '../../app';
import type { BroadcastRunner } from '../../engine/broadcast';
import type { View } from '../view';

const MODES: SelectMode[] = ['none', 'all', 'allExcept', 'only'];

function riskBadge(level: 0 | 1 | 2 | 3): HTMLElement {
  return h('span', { class: `badge ${['ok', 'warn', 'bad', 'bad'][level]}` }, t(`risk_${level}` as I18nKey));
}

/** Itens da lista de contatos conforme a origem escolhida (salvos / salvos que conversaram / não salvos que conversaram). */
function contactSourceItems(app: App, source: 'saved' | 'chatted' | 'unsaved'): PickItem[] {
  if (source === 'saved') return contactItems(app);
  const saved = new Set(app.dir.contacts.filter((c) => c.isMyContact).map((c) => c.id));
  return app.dir.chats
    .filter((c) => !c.isGroup && !c.isBroadcast && (source === 'chatted' ? saved.has(c.id) : !saved.has(c.id)))
    .map((c) => ({ id: c.id, label: c.name || c.id.split('@')[0], sub: c.id.endsWith('@c.us') ? `+${c.id.split('@')[0]}` : '' }));
}

function selectionBlock(title: string, sel: TargetSelection, items: () => PickItem[], extra?: HTMLElement): HTMLElement {
  const area = h('div');
  const render = () => {
    clear(area);
    if (sel.mode === 'allExcept' || sel.mode === 'only') area.append(picker(items(), sel.ids, (ids) => (sel.ids = ids)));
  };
  render();
  return h('div', { class: 'card stack' },
    h('div', { style: 'font-weight:600' }, title),
    segmented(MODES.map((m) => ({ value: m, label: t(`mode_${m}` as I18nKey) })), sel.mode, (m) => {
      sel.mode = m;
      render();
    }),
    area,
    extra ?? null,
  );
}

export async function openBroadcastEditor(app: App, runner: BroadcastRunner, existing?: Broadcast): Promise<void> {
  const draft: Broadcast = existing ? structuredClone(existing) : newBroadcast();
  const tg = draft.targets;
  await app.dir.refresh().catch(() => null);
  const sheetInfo = h('div', { class: 'hint' }, tg.sheet.rows.length ? t('rowsImported', { n: tg.sheet.rows.length, bad: 0 }) : t('sheetHint'));
  const ddiInput = textInput(tg.sheet.ddi, (v) => (tg.sheet.ddi = v.replace(/\D/g, '')), { style: 'width:80px' });

  const sections = {
    messages: h('div', { class: 'stack' },
      app.store.data.templates.length
        ? picker(templateItems(app), draft.templateIds, (ids) => (draft.templateIds = ids))
        : h('div', { class: 'banner' }, t('needTemplates')),
      segmented([
        { value: 'all' as const, label: t('templateModeAll') },
        { value: 'random' as const, label: t('templateModeRandom') },
      ], draft.templateMode, (v) => (draft.templateMode = v)),
    ),
    targets: h('div', { class: 'stack' },
      selectionBlock(t('targetsContacts'), tg.contacts, () => contactSourceItems(app, tg.contacts.source ?? 'saved'), field(t('contactsSource'), segmented((['saved', 'chatted', 'unsaved'] as const).map((v) => ({ value: v, label: t(`src_${v}` as I18nKey) })), tg.contacts.source ?? 'saved', (v) => (tg.contacts.source = v)))),
      selectionBlock(t('targetsGroups'), tg.groups, () => groupItems(app), h('div', null, check(t('groupMembers'), tg.groups.members, (v) => (tg.groups.members = v)), check(t('groupMention'), !!tg.groups.mention, (v) => (tg.groups.mention = v)))),
      selectionBlock(t('targetsLabels'), tg.labels, () => labelItems(app)),
      selectionBlock(t('targetsLists'), tg.lists, () => listItems(app), check(t('listMembers'), tg.lists.members, (v) => (tg.lists.members = v))),
      selectionBlock(t('targetsCountries'), tg.countries, countryItems),
      h('div', { class: 'card stack' },
        h('div', { style: 'font-weight:600' }, t('targetsSheet')),
        h('div', { class: 'row' },
          btn(t('chooseFile'), async () => {
            const f = await pickFile('.csv,.xlsx,.xls,.txt');
            if (!f) return;
            try {
              tg.sheet.rows = await readSheetFile(f);
              const { recipients, invalid } = rowsToRecipients(tg.sheet.rows, { format: tg.sheet.numberFormat, ddi: tg.sheet.ddi });
              sheetInfo.textContent = t('rowsImported', { n: recipients.length, bad: invalid });
            } catch (e) {
              toast(String(e), 'error');
            }
          }, { icon: 'upload', small: true }),
          tg.sheet.rows.length ? btn(t('delete'), () => {
            tg.sheet.rows = [];
            sheetInfo.textContent = t('sheetHint');
          }, { small: true, variant: 'danger' }) : null,
        ),
        sheetInfo,
        segmented([
          { value: 'international' as const, label: t('sheetFormatIntl') },
          { value: 'local' as const, label: t('sheetFormatLocal') },
        ], tg.sheet.numberFormat, (v) => (tg.sheet.numberFormat = v)),
        h('div', { class: 'row' }, t('ddi'), ddiInput),
      ),
      h('div', { class: 'card stack' },
        h('div', { style: 'font-weight:600' }, t('targetsPasted')),
        textArea(tg.pasted, (v) => (tg.pasted = v), { rows: 4, placeholder: t('pastedHint') }),
      ),
      toggle(t('validateNumbers'), tg.validate, (v) => (tg.validate = v)),
    ),
    timing: h('div', { class: 'stack' },
      field(t('intervalRandom'), h('div', { class: 'row' }, t('from'), numInput(draft.intervalMin, (v) => (draft.intervalMin = Math.trunc(v)), { min: 1 }), t('to'), numInput(draft.intervalMax, (v) => (draft.intervalMax = Math.trunc(v)), { min: 1 }), t('seconds'))),
      field(t('scheduleStart'), h('input', { type: 'datetime-local', value: toLocalInput(draft.schedule.startAt), oninput: (e: Event) => (draft.schedule.startAt = fromLocalInput((e.target as HTMLInputElement).value)) }), `${t('startNow')}: ${t('optional')}`),
      h('div', { class: 'card stack' },
        toggle(t('workingHours'), draft.schedule.workingHours.enabled, (v) => (draft.schedule.workingHours.enabled = v)),
        h('div', { class: 'row' },
          t('start'), h('input', { type: 'time', value: draft.schedule.workingHours.start, style: 'width:110px', oninput: (e: Event) => (draft.schedule.workingHours.start = (e.target as HTMLInputElement).value) }),
          t('end'), h('input', { type: 'time', value: draft.schedule.workingHours.end, style: 'width:110px', oninput: (e: Event) => (draft.schedule.workingHours.end = (e.target as HTMLInputElement).value) }),
        ),
        daysPicker(draft.schedule.workingHours.days, (d) => (draft.schedule.workingHours.days = d)),
      ),
      h('div', { class: 'card stack' },
        field(t('repeat'), selectBox((['none', 'daily', 'weekly', 'monthly', 'everyHours'] as RepeatKind[]).map((k) => ({ value: k, label: t(`repeat_${k}` as I18nKey) })), draft.schedule.repeat.kind, (v) => (draft.schedule.repeat.kind = v))),
        h('div', { class: 'row' },
          t('repeatHours'), numInput(draft.schedule.repeat.hours, (v) => (draft.schedule.repeat.hours = Math.max(1, v)), { min: 1 }),
          t('repeatTimes'), numInput(draft.schedule.repeat.times, (v) => (draft.schedule.repeat.times = Math.max(0, v)), { min: 0 }),
        ),
      ),
    ),
    after: h('div', { class: 'stack' },
      field(t('postLabel'), picker(labelItems(app), draft.post.labelIds, (ids) => (draft.post.labelIds = ids), { emptyText: t('noLabels') })),
      toggle(t('postArchive'), draft.post.archive, (v) => (draft.post.archive = v)),
      toggle(t('postBlock'), draft.post.block, (v) => (draft.post.block = v)),
      field(t('postWebhook'), picker(webhookItems(app), draft.post.webhookIds, (ids) => (draft.post.webhookIds = ids))),
    ),
  };

  const tabs: { id: keyof typeof sections; label: I18nKey }[] = [
    { id: 'messages', label: 'stepMessages' },
    { id: 'targets', label: 'stepTargets' },
    { id: 'timing', label: 'stepTiming' },
    { id: 'after', label: 'stepAfter' },
  ];
  const holder = h('div');
  const tabBar = h('div', { class: 'tabs2' });
  const show = (id: keyof typeof sections) => {
    clear(tabBar);
    tabs.forEach((tb) => tabBar.append(h('button', { class: tb.id === id ? 'on' : '', onclick: () => show(tb.id) }, t(tb.label))));
    clear(holder);
    holder.append(sections[id]);
  };
  show('messages');

  const save = () => {
    if (!draft.name.trim()) draft.name = `${t('navBroadcasts')} ${new Date().toLocaleDateString(locale())}`;
    if (draft.status === 'done' || draft.status === 'stopped') draft.status = 'draft';
    app.store.update('broadcasts', (list) => {
      const i = list.findIndex((x) => x.id === draft.id);
      if (i >= 0) list[i] = draft;
      else list.unshift(draft);
    });
  };

  modal(existing ? t('edit') : t('newBroadcast'), [field(t('broadcastName'), textInput(draft.name, (v) => (draft.name = v))), tabBar, holder], (close) => [
    btn(t('cancel'), close),
    btn(t('save'), () => {
      if (!validInterval(draft.intervalMin, draft.intervalMax)) return toast(t('intervalInvalid'), 'error');
      save();
      toast(t('saved'), 'ok');
      close();
    }),
    btn(t('startBroadcast'), () => {
      if (!draft.templateIds.length) return toast(t('needTemplates'), 'error');
      if (!validInterval(draft.intervalMin, draft.intervalMax)) return toast(t('intervalInvalid'), 'error');
      save();
      close();
      void startWithTerms(app, runner, draft.id);
    }, { variant: 'primary', icon: 'play' }),
  ], { wide: true });
}

/** Mostra o aviso anti-spam (aceite obrigatório) e inicia a transmissão. */
export async function startWithTerms(app: App, runner: BroadcastRunner, id: string): Promise<void> {
  const go = async () => {
    toast(t('preparing'));
    const n = await runner.launch(id).catch((e) => {
      toast(String(e), 'error');
      return -1;
    });
    if (n === 0) toast(t('noRecipients'), 'error');
    else if (n > 0) toast(`${n} ${t('recipients')}`, 'ok');
  };
  if (app.store.settings.termsAccepted) return go();
  let accepted = false;
  modal(t('antiSpamTitle'), [h('div', { class: 'banner' }, t('antiSpamText')), check(t('antiSpamAccept'), false, (v) => (accepted = v))], (close) => [
    btn(t('cancel'), close),
    btn(t('startBroadcast'), () => {
      if (!accepted) return toast(t('antiSpamAccept'), 'error');
      app.store.update('settings', (s) => void (s.termsAccepted = true));
      close();
      void go();
    }, { variant: 'primary' }),
  ]);
}

function showRecipients(app: App, b: Broadcast): void {
  const rows = b.recipients.slice(0, 2000).map((r) =>
    h('div', { class: 'row', style: 'justify-content:space-between;border-bottom:1px solid var(--line);padding:4px 0' },
      h('span', null, app.dir.nameOf(r.id), ' ', h('small', { class: 'hint' }, r.id.split('@')[0])),
      h('span', { class: `badge ${r.status === 'sent' ? 'ok' : r.status === 'pending' ? '' : 'bad'}`, title: r.error ?? '' }, t(`rec_${r.status}` as I18nKey)),
    ),
  );
  modal(b.name, rows.length ? rows : emptyState(), (close) => [btn(t('close'), close)]);
}

export function broadcastsView(runner: BroadcastRunner): View {
  return {
    id: 'broadcasts',
    label: 'navBroadcasts',
    icon: 'broadcasts',
    fields: ['broadcasts', 'settings'],
    render({ app }) {
      const list = app.store.data.broadcasts;
      const statusBadge = (b: Broadcast) => {
        const cls = b.status === 'running' ? 'acc' : b.status === 'done' ? 'ok' : b.status === 'paused' || b.status === 'scheduled' ? 'warn' : b.status === 'stopped' ? 'bad' : '';
        return h('span', { class: `badge ${cls}` }, t(`status_${b.status}` as I18nKey));
      };
      return h(
        'div',
        null,
        h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('broadcastsTitle')), btn(t('newBroadcast'), () => openBroadcastEditor(app, runner), { variant: 'primary', icon: 'plus' })),
        h('div', { class: 'banner', style: 'margin-top:8px' }, t('antiSpamText')),
        app.store.settings.offline ? h('div', { class: 'banner info' }, t('offlineOn')) : null,
        list.length
          ? h('div', { class: 'list' }, list.map((b) => {
              const p = progressOf(b);
              const active = b.status === 'running' || b.status === 'scheduled';
              return h('div', { class: 'item' },
                h('div', { class: 'main' },
                  h('div', { class: 'name' }, b.name, statusBadge(b)),
                  b.recipients.length
                    ? [
                        h('div', { class: 'progress' }, h('i', { style: `width:${p.percent}%` })),
                        h('div', { class: 'meta' }, t('progress', { done: p.done, total: p.total, sent: p.sent, failed: p.failed })),
                      ]
                    : h('div', { class: 'meta' }, `${b.templateIds.length} × ${t('navTemplates').toLowerCase()}`),
                  b.recipients.length ? h('div', { class: 'meta' }, `${t('risk')}: `, riskBadge(broadcastRisk(b.recipients.length, b.intervalMin, b.intervalMax, b.targets.validate))) : null,
                  active && b.nextAt ? h('div', { class: 'meta' }, t('nextSendAt', { when: fmtDateTime(b.nextAt, locale()) })) : null,
                  b.lastError ? h('div', { class: 'meta', style: 'color:var(--danger)' }, b.lastError) : null,
                ),
                h('div', { class: 'acts' },
                  b.status === 'running' || b.status === 'scheduled'
                    ? iconBtn('pause', t('pause'), () => runner.pause(b.id))
                    : b.status === 'paused'
                      ? iconBtn('play', t('resume'), () => runner.resume(b.id))
                      : iconBtn('play', b.status === 'draft' ? t('startBroadcast') : t('restart'), () => void startWithTerms(app, runner, b.id)),
                  active || b.status === 'paused' ? iconBtn('stop', t('stop'), () => runner.stop(b.id), 'danger') : null,
                  b.recipients.length ? iconBtn('eye', t('viewLog'), () => showRecipients(app, b)) : null,
                  !active ? iconBtn('edit', t('edit'), () => openBroadcastEditor(app, runner, b)) : null,
                  iconBtn('copy', t('duplicate'), () =>
                    app.store.update('broadcasts', (l) => void l.unshift({ ...structuredClone(b), id: uid('b_'), name: `${b.name} (2)`, status: 'draft', recipients: [], cursor: 0, runs: 0, nextAt: null, createdAt: Date.now() })),
                  ),
                  !active ? iconBtn('deleted', t('delete'), async () => {
                    if (await confirmBox(t('confirmDelete'))) app.store.update('broadcasts', (l) => l.filter((x) => x.id !== b.id));
                  }, 'danger') : null,
                ),
              );
            }))
          : emptyState(),
      );
    },
  };
}
