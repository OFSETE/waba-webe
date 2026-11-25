import { t, locale, type I18nKey } from '../../../shared/i18n';
import type { Priority, Task } from '../../../shared/types';
import { uid } from '../../../shared/defaults';
import { taskDueStatus } from '../../../shared/extras';
import { h, fmtDateTime, fromLocalInput, toLocalInput } from '../h';
import { btn, check, confirmBox, emptyState, field, iconBtn, modal, segmented, selectBox, textArea, textInput, toast, toggle } from '../components';
import type { App } from '../../app';
import type { View } from '../view';

let showDone = false;

/** Cores das prioridades como na referência (bootstrap.min.js, lista de prioridades das tarefas). */
export const PRIORITY_COLORS: Record<string, string> = { urgent: '#d32f2f', high: '#f57c00', normal: '#1e88e5', low: '#9e9e9e' };

export async function openTaskEditor(app: App, existing?: Task, chatId?: string): Promise<void> {
  await app.dir.refresh().catch(() => null);
  const task: Task = existing
    ? structuredClone(existing)
    : { id: uid('k_'), chatId: chatId ?? '', chatName: chatId ? app.dir.nameOf(chatId) : '', title: '', description: '', priority: 'normal', due: Date.now() + 3_600_000, notify: true, notified: false, done: false, createdAt: Date.now() };
  const chats = app.dir.chats.filter((c) => !c.isBroadcast);
  const options = [{ value: '', label: '—' }, ...chats.map((c) => ({ value: c.id, label: c.name || c.id }))];
  if (task.chatId && !chats.some((c) => c.id === task.chatId)) options.push({ value: task.chatId, label: task.chatName || task.chatId });
  modal(existing ? t('edit') : t('newTask'), [
    field(t('taskTitle'), textInput(task.title, (v) => (task.title = v))),
    field(t('taskDescription'), textArea(task.description, (v) => (task.description = v), { rows: 3 })),
    field(t('taskChat'), selectBox(options, task.chatId, (v) => {
      task.chatId = v;
      task.chatName = v ? app.dir.nameOf(v) : '';
    })),
    field(t('priority'), segmented((['urgent', 'high', 'normal', 'low'] as Priority[]).map((p) => ({ value: p, label: t(`pr_${p}` as I18nKey) })), task.priority, (v) => (task.priority = v))),
    field(t('dueAt'), h('input', { type: 'datetime-local', value: toLocalInput(task.due), oninput: (e: Event) => {
      task.due = fromLocalInput((e.target as HTMLInputElement).value);
      task.notified = false;
    } })),
    toggle(t('notifyMe'), task.notify, (v) => (task.notify = v)),
  ], (close) => [
    btn(t('cancel'), close),
    btn(t('save'), () => {
      if (!task.title.trim()) return toast(t('taskTitle'), 'error');
      app.store.update('tasks', (list) => {
        const i = list.findIndex((x) => x.id === task.id);
        if (i >= 0) list[i] = task;
        else list.unshift(task);
      });
      toast(t('saved'), 'ok');
      close();
    }, { variant: 'primary' }),
  ]);
}

export const tasksView: View = {
  id: 'tasks',
  label: 'navTasks',
  icon: 'tasks',
  fields: ['tasks'],
  render({ app, rerender }) {
    const order: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    const list = app.store.data.tasks
      .filter((x) => showDone || !x.done)
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? Infinity) - (b.due ?? Infinity) || order[a.priority] - order[b.priority]);
    const now = Date.now();
    return h(
      'div',
      null,
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('tasksTitle')), btn(t('newTask'), () => void openTaskEditor(app, undefined, app.activeChatId ?? undefined), { variant: 'primary', icon: 'plus' })),
      check(t('showDone'), showDone, (v) => {
        showDone = v;
        rerender();
      }),
      list.length
        ? h('div', { class: 'list' }, list.map((x) =>
            h('div', { class: 'item', style: x.done ? 'opacity:.6' : undefined },
              h('input', { type: 'checkbox', checked: x.done, style: 'margin-top:3px;accent-color:var(--accent)', onchange: (e: Event) => app.store.update('tasks', (l) => l.map((y) => (y.id === x.id ? { ...y, done: (e.target as HTMLInputElement).checked } : y))) }),
              h('div', { class: 'main' },
                h('div', { class: 'name', style: x.done ? 'text-decoration:line-through' : undefined }, x.title,
                  h('span', { class: 'badge', style: `background:${PRIORITY_COLORS[x.priority] ?? '#888'}22;color:${PRIORITY_COLORS[x.priority] ?? '#888'}` }, t(`pr_${x.priority}` as I18nKey)),
                  !x.done && taskDueStatus(x.due, now) === 'overdue' ? h('span', { class: 'badge bad' }, t('overdue')) : null,
                  !x.done && taskDueStatus(x.due, now) === 'dueSoon' ? h('span', { class: 'badge warn' }, t('dueSoon')) : null,
                ),
                h('div', { class: 'meta' }, [x.chatName, x.due ? fmtDateTime(x.due, locale()) : '', x.description].filter(Boolean).join(' • ')),
              ),
              h('div', { class: 'acts' },
                x.chatId ? iconBtn('chat', t('openChat'), () => void app.bridge.call('openChat', { id: x.chatId }).catch(() => null)) : null,
                iconBtn('edit', t('edit'), () => void openTaskEditor(app, x)),
                iconBtn('deleted', t('delete'), async () => {
                  if (await confirmBox(t('confirmDelete'))) app.store.update('tasks', (l) => l.filter((y) => y.id !== x.id));
                }, 'danger'),
              ),
            ),
          ))
        : emptyState(),
    );
  },
};
