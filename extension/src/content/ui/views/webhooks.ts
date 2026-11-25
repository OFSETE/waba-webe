import { t, locale } from '../../../shared/i18n';
import type { Webhook } from '../../../shared/types';
import { newWebhook } from '../../../shared/defaults';
import { originOf, renderPayload, validatePayloadTemplate } from '../../../shared/webhook';
import { h, clear, fmtDateTime } from '../h';
import { btn, confirmBox, emptyState, field, iconBtn, modal, numInput, selectBox, textArea, textInput, toast, toggle } from '../components';
import type { App } from '../../app';
import type { WebhookQueue } from '../../engine/webhooks';
import type { View } from '../view';

function permissionRow(queue: WebhookQueue, url: () => string): HTMLElement {
  const box = h('div', { class: 'row' });
  const refresh = async () => {
    clear(box);
    const origin = originOf(url());
    if (!origin) return;
    if (await queue.hasPermission(url())) box.append(h('span', { class: 'badge ok' }, `${t('permissionOk')}: ${origin}`));
    else
      box.append(
        h('span', { class: 'hint grow' }, t('permissionNeeded', { origin })),
        btn(t('grantPermission'), async () => {
          await queue.requestPermission(url());
          setTimeout(refresh, 4000);
        }, { small: true, variant: 'primary' }),
      );
  };
  void refresh();
  (box as HTMLElement & { refresh?: () => void }).refresh = () => void refresh();
  return box;
}

export function openWebhookEditor(app: App, queue: WebhookQueue, existing?: Webhook): void {
  const w: Webhook = existing ? structuredClone(existing) : newWebhook();
  const headersBox = h('div', { class: 'stack' });
  const renderHeaders = () => {
    clear(headersBox);
    w.headers.forEach((hd, i) =>
      headersBox.append(h('div', { class: 'kv' },
        textInput(hd.key, (v) => (hd.key = v), { placeholder: t('headerKey') }),
        textInput(hd.value, (v) => (hd.value = v), { placeholder: t('headerValue') }),
        iconBtn('close', t('delete'), () => {
          w.headers.splice(i, 1);
          renderHeaders();
        }),
      )),
    );
  };
  renderHeaders();
  const payloadErr = h('div', { class: 'hint', style: 'color:var(--danger)' });
  const perm = permissionRow(queue, () => w.url) as HTMLElement & { refresh?: () => void };
  let urlTimer: ReturnType<typeof setTimeout> | undefined;

  modal(
    existing ? t('edit') : t('newWebhook'),
    [
      field(t('webhookName'), textInput(w.name, (v) => (w.name = v))),
      h('div', { class: 'row' },
        h('div', { style: 'width:110px' }, field(t('method'), selectBox((['POST', 'PUT', 'PATCH', 'GET'] as const).map((m) => ({ value: m, label: m })), w.method, (v) => (w.method = v)))),
        h('div', { class: 'grow' }, field(t('webhookUrl'), textInput(w.url, (v) => {
          w.url = v.trim();
          clearTimeout(urlTimer);
          urlTimer = setTimeout(() => perm.refresh?.(), 600);
        }, { type: 'url', placeholder: 'https://exemplo.com/webhook' }))),
      ),
      perm,
      field(t('headers'), headersBox),
      h('div', null, btn(t('addRow'), () => {
        w.headers.push({ key: '', value: '' });
        renderHeaders();
      }, { small: true, icon: 'plus' })),
      field(t('payload'), textArea(w.payload, (v) => {
        w.payload = v;
        const r = validatePayloadTemplate(v);
        payloadErr.textContent = r.ok ? '' : t('payloadInvalid', { err: r.error });
      }, { class: 'code', spellcheck: 'false' }), `${t('payloadHelp')}. ${t('payloadFieldsHelp')}`),
      payloadErr,
      h('div', { class: 'card' },
        toggle(t('onIncoming'), w.onIncoming, (v) => (w.onIncoming = v)),
        toggle(t('onOutgoing'), w.onOutgoing, (v) => (w.onOutgoing = v)),
        toggle(t('replyFromResponse'), w.replyFromResponse, (v) => (w.replyFromResponse = v), t('replyHelp')),
        field(t('replyPath'), textInput(w.replyPath ?? 'reply', (v) => (w.replyPath = v.trim()))),
        field(t('attachmentPath'), textInput(w.attachmentPath ?? '', (v) => (w.attachmentPath = v.trim()))),
      ),
    ],
    (close) => [
      btn(t('testWebhook'), async () => {
        const headers: Record<string, string> = {};
        w.headers.forEach((x) => x.key && (headers[x.key] = x.value));
        const now = Math.floor(Date.now() / 1000);
        const body = renderPayload(w.payload, { event: 'test', m_id: 'test', m_type: 'chat', m_text: 'WABA WEBE', m_content: 'WABA WEBE', m_timestamp: now, m_datetime: new Date().toString(), m_phone: '5511999999999', c_labels: [] });
        const r = await queue.deliver({ url: w.url, method: w.method, headers, body }).catch((e) => ({ ok: false, status: 0, error: String(e), body: '', contentType: '' }));
        toast(r.ok ? `HTTP ${r.status}` : `${t('error')}: ${r.error || `HTTP ${r.status}`}`, r.ok ? 'ok' : 'error');
      }, { icon: 'send' }),
      btn(t('cancel'), close),
      btn(t('save'), () => {
        if (!originOf(w.url)) return toast(t('webhookUrl'), 'error');
        const v = validatePayloadTemplate(w.payload);
        if (!v.ok) return toast(t('payloadInvalid', { err: v.error }), 'error');
        if (!w.name.trim()) w.name = new URL(w.url).host;
        app.store.update('webhooks', (list) => {
          const i = list.findIndex((x) => x.id === w.id);
          if (i >= 0) list[i] = w;
          else list.push(w);
        });
        toast(t('saved'), 'ok');
        close();
      }, { variant: 'primary' }),
    ],
    { wide: true },
  );
}

export function webhooksView(queue: WebhookQueue): View {
  return {
    id: 'webhooks',
    label: 'navWebhooks',
    icon: 'webhooks',
    fields: ['webhooks', 'queue', 'settings'],
    render({ app }) {
      const list = app.store.data.webhooks;
      const q = app.store.data.queue;
      return h(
        'div',
        null,
        h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('webhooksTitle')), btn(t('newWebhook'), () => openWebhookEditor(app, queue), { variant: 'primary', icon: 'plus' })),
        app.store.settings.offline ? h('div', { class: 'banner', style: 'margin-top:8px' }, t('offlineOn')) : null,
        h('div', { style: 'height:10px' }),
        list.length
          ? h('div', { class: 'list' }, list.map((w) =>
              h('div', { class: 'item' },
                h('label', { class: 'toggle' },
                  h('input', { type: 'checkbox', checked: w.enabled, onchange: (e: Event) => app.store.update('webhooks', (l) => l.map((x) => (x.id === w.id ? { ...x, enabled: (e.target as HTMLInputElement).checked } : x))) }),
                  h('span', { class: 'sw' }),
                ),
                h('div', { class: 'main' }, h('div', { class: 'name' }, w.name, h('span', { class: 'badge' }, w.method)), h('div', { class: 'meta' }, w.url)),
                h('div', { class: 'acts' },
                  iconBtn('edit', t('edit'), () => openWebhookEditor(app, queue, w)),
                  iconBtn('deleted', t('delete'), async () => {
                    if (await confirmBox(t('confirmDelete'))) app.store.update('webhooks', (l) => l.filter((x) => x.id !== w.id));
                  }, 'danger'),
                ),
              ),
            ))
          : emptyState(),
        h('h3', null, `${t('queue')} (${q.length})`),
        q.length
          ? h('div', { class: 'stack' },
              h('div', { class: 'row' }, btn(t('processQueue'), () => void queue.process(true), { small: true, icon: 'restore' }), btn(t('clearQueue'), () => app.store.update('queue', () => []), { small: true, variant: 'danger' })),
              h('div', { class: 'list' }, q.slice(0, 50).map((item) =>
                h('div', { class: 'item' }, h('div', { class: 'main' },
                  h('div', { class: 'name' }, item.url),
                  h('div', { class: 'meta' }, `${item.attempts} ${t('attempts')} • ${fmtDateTime(item.nextAt, locale())}${item.lastError ? ` • ${item.lastError}` : ''}`),
                )),
              )),
            )
          : h('div', { class: 'hint' }, t('queueEmpty')),
        incomingSection(app, queue),
      );
    },
  };
}

/** Webhook de entrada sem servidor nosso: a extensão consulta uma URL do usuário. */
function incomingSection(app: App, queue: WebhookQueue): HTMLElement {
  const cfg = app.store.settings.incoming;
  const save = (fn: (c: typeof cfg) => void) => app.store.update('settings', (s) => void fn(s.incoming));
  const headersBox = h('div', { class: 'stack' });
  const renderHeaders = () => {
    clear(headersBox);
    cfg.headers.forEach((hd, i) =>
      headersBox.append(h('div', { class: 'kv' },
        textInput(hd.key, (v) => save((c) => (c.headers[i].key = v)), { placeholder: t('headerKey') }),
        textInput(hd.value, (v) => save((c) => (c.headers[i].value = v)), { placeholder: t('headerValue') }),
        iconBtn('close', t('delete'), () => {
          save((c) => c.headers.splice(i, 1));
          renderHeaders();
        }),
      )),
    );
  };
  renderHeaders();
  const perm = permissionRow(queue, () => app.store.settings.incoming.url) as HTMLElement & { refresh?: () => void };
  let timer: ReturnType<typeof setTimeout> | undefined;
  return h('div', null,
    h('h3', null, t('incomingTitle')),
    h('div', { class: 'card stack' },
      h('div', { class: 'hint' }, t('incomingHint')),
      toggle(t('enabled'), cfg.enabled, (v) => save((c) => (c.enabled = v))),
      field(t('incomingUrl'), textInput(cfg.url, (v) => {
        save((c) => (c.url = v.trim()));
        clearTimeout(timer);
        timer = setTimeout(() => perm.refresh?.(), 600);
      }, { type: 'url', placeholder: 'https://seu-sistema.com/whatsapp/pendentes' })),
      perm,
      field(t('incomingInterval'), numInput(cfg.intervalSec, (v) => save((c) => (c.intervalSec = Math.max(10, v))), { min: 10 })),
      field(t('incomingAck'), textInput(cfg.ackUrl, (v) => save((c) => (c.ackUrl = v.trim())), { type: 'url', placeholder: 'https://seu-sistema.com/whatsapp/resultado' })),
      field(t('headers'), headersBox),
      h('div', { class: 'row' },
        btn(t('addRow'), () => {
          save((c) => c.headers.push({ key: '', value: '' }));
          renderHeaders();
        }, { small: true, icon: 'plus' }),
        btn(t('incomingRunNow'), async () => {
          const n = (await app.incoming?.runOnce().catch(() => 0)) ?? 0;
          toast(`${t('sent')} ${n}`, n ? 'ok' : 'info');
        }, { small: true, icon: 'restore' }),
      ),
      cfg.lastRunAt ? h('div', { class: 'hint' }, t('incomingLast', { when: fmtDateTime(cfg.lastRunAt, locale()), n: cfg.received }), cfg.lastError ? h('div', { style: 'color:var(--danger)' }, cfg.lastError) : null) : null,
    ),
  );
}
