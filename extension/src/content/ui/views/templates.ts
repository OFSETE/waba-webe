import { t, type I18nKey } from '../../../shared/i18n';
import type { ListSection, PixKeyType, Template, TemplateKind } from '../../../shared/types';
import { newTemplate, uid } from '../../../shared/defaults';
import { VARIABLE_NAMES } from '../../../shared/variables';
import { h, clear, readFileAsDataUrl, pickFile } from '../h';
import { btn, check, confirmBox, emptyState, field, iconBtn, modal, numInput, popupMenu, selectBox, textArea, textInput, toast } from '../components';
import { resolveTemplate, templateSummary } from '../../resolve';
import type { App } from '../../app';
import type { View } from '../view';

const KINDS: TemplateKind[] = ['text', 'media', 'vcard', 'location', 'poll', 'pix', 'event', 'call', 'list', 'dynamicImage'];
export const MAX_MEDIA_MB = 16;

/** Lista de opções em texto: "# Seção" começa uma seção; cada linha "Título | descrição" vira uma opção. */
export function textToSections(text: string): ListSection[] {
  const out: ListSection[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      out.push({ title: line.replace(/^#+\s*/, ''), rows: [] });
      continue;
    }
    if (!out.length) out.push({ title: '', rows: [] });
    const [title, ...rest] = line.split('|');
    out[out.length - 1].rows.push({ title: title.trim(), description: rest.join('|').trim() });
  }
  return out;
}

export function sectionsToText(sections: ListSection[]): string {
  return sections
    .map((s) => [s.title ? `# ${s.title}` : '', ...s.rows.map((r) => (r.description ? `${r.title} | ${r.description}` : r.title))].filter(Boolean).join('\n'))
    .join('\n');
}

function variableButton(target: () => HTMLTextAreaElement | HTMLInputElement): HTMLElement {
  return btn(t('insertVariable'), (e) => {
    const vars = [...VARIABLE_NAMES, '1', '2', '3'];
    popupMenu(e.clientX, e.clientY, vars.map((v) => ({
      label: `\${${v}}`,
      onClick: () => {
        const el = target();
        const pos = el.selectionStart ?? el.value.length;
        el.value = `${el.value.slice(0, pos)}\${${v}}${el.value.slice(el.selectionEnd ?? pos)}`;
        el.dispatchEvent(new Event('input'));
        el.focus();
      },
    })));
  }, { small: true });
}

export function openTemplateEditor(app: App, existing?: Template): void {
  const draft: Template = existing ? structuredClone(existing) : newTemplate();
  const kindArea = h('div', { class: 'stack' });
  const previewBox = h('div', { class: 'preview' });

  const updatePreview = () => {
    try {
      const r = resolveTemplate(draft, { contactName: 'Maria Souza', waName: 'Mari', phone: '5511987654321', groupName: 'Equipe', messageContent: 'oi', columns: ['5511987654321', 'Pedido 123'] });
      previewBox.textContent = r.text || templateSummary({ ...draft, text: r.text });
    } catch {
      previewBox.textContent = '';
    }
  };

  const textEditor = (labelKey: I18nKey) => {
    const ta = textArea(draft.text, (v) => {
      draft.text = v;
      updatePreview();
    }, { rows: 5 });
    return h('div', { class: 'stack' }, field(t(labelKey), ta), h('div', { class: 'row' }, variableButton(() => ta)), h('div', { class: 'hint' }, t('variablesHelp')));
  };

  const renderKind = () => {
    clear(kindArea);
    switch (draft.kind) {
      case 'text':
        kindArea.append(textEditor('messageText'), check(t('linkPreview'), !!draft.linkPreview, (v) => (draft.linkPreview = v)), h('div', { class: 'hint' }, t('linkPreviewHint')));
        break;
      case 'call': {
        draft.call ??= { title: '', start: '', callType: 'voice' };
        const cl = draft.call;
        kindArea.append(
          field(t('callTitle'), textInput(cl.title, (v) => (cl.title = v))),
          h('div', { class: 'row' },
            h('div', { class: 'grow' }, field(t('callStart'), h('input', { type: 'datetime-local', value: cl.start, oninput: (e: Event) => (cl.start = (e.target as HTMLInputElement).value) }))),
            h('div', { class: 'grow' }, field(t('eventCall'), selectBox([{ value: 'voice' as const, label: t('eventCallVoice') }, { value: 'video' as const, label: t('eventCallVideo') }], cl.callType, (v) => (cl.callType = v)))),
          ),
          textEditor('taskDescription'),
        );
        break;
      }
      case 'list': {
        draft.list ??= { buttonText: 'Ver opções', title: '', footer: '', sections: [{ title: '', rows: [{ title: '', description: '' }] }] };
        const ls = draft.list;
        kindArea.append(
          textEditor('messageText'),
          h('div', { class: 'row' },
            h('div', { class: 'grow' }, field(t('listButtonText'), textInput(ls.buttonText, (v) => (ls.buttonText = v)))),
            h('div', { class: 'grow' }, field(t('listTitle'), textInput(ls.title, (v) => (ls.title = v)))),
          ),
          field(t('listFooter'), textInput(ls.footer, (v) => (ls.footer = v))),
          field(t('listSections'), textArea(sectionsToText(ls.sections), (v) => (ls.sections = textToSections(v)), { rows: 6, placeholder: '# Bolos\nChocolate | R$ 50\nMorango | R$ 55\n# Doces\nBrigadeiro | cento' })),
        );
        break;
      }
      case 'dynamicImage': {
        draft.dynamicImage ??= { url: '' };
        const di = draft.dynamicImage;
        kindArea.append(
          field(t('dynamicImageUrl'), textInput(di.url, (v) => (di.url = v.trim()), { placeholder: 'https://...' }), t('dynamicImageHint')),
          textEditor('caption'),
        );
        break;
      }
      case 'media': {
        const info = h('div', { class: 'hint' }, draft.media ? `${draft.media.name} (${Math.round(draft.media.size / 1024)} KB)` : '');
        const prev = h('div');
        const showPrev = () => {
          clear(prev);
          if (draft.media?.mime.startsWith('image/')) prev.append(h('img', { class: 'mediaPrev', src: draft.media.dataUrl }));
        };
        showPrev();
        kindArea.append(
          h('div', { class: 'row' }, btn(t('chooseFile'), async () => {
            const f = await pickFile('*/*');
            if (!f) return;
            if (f.size > MAX_MEDIA_MB * 1024 * 1024) return toast(t('fileTooBig', { max: MAX_MEDIA_MB }), 'error');
            draft.media = { name: f.name, mime: f.type || 'application/octet-stream', size: f.size, dataUrl: await readFileAsDataUrl(f), asDocument: draft.media?.asDocument, asVoice: draft.media?.asVoice };
            info.textContent = `${f.name} (${Math.round(f.size / 1024)} KB)`;
            showPrev();
          }, { icon: 'upload' }), info),
          prev,
          check(t('sendAsDocument'), !!draft.media?.asDocument, (v) => draft.media && (draft.media.asDocument = v)),
          check(t('sendAsVoice'), !!draft.media?.asVoice, (v) => draft.media && (draft.media.asVoice = v)),
          check(t('viewOnce'), !!draft.media?.viewOnce, (v) => draft.media && (draft.media.viewOnce = v)),
          textEditor('caption'),
        );
        break;
      }
      case 'vcard': {
        draft.vcards ??= [{ name: '', phone: '' }];
        const rows = h('div', { class: 'stack' });
        const renderRows = () => {
          clear(rows);
          draft.vcards!.forEach((v, i) =>
            rows.append(
              h('div', { class: 'row' },
                h('div', { class: 'grow' }, textInput(v.name, (x) => (v.name = x), { placeholder: t('vcardName') })),
                h('div', { class: 'grow' }, textInput(v.phone, (x) => (v.phone = x), { placeholder: t('vcardPhone') })),
                iconBtn('close', t('delete'), () => {
                  draft.vcards!.splice(i, 1);
                  renderRows();
                }),
              ),
            ),
          );
        };
        renderRows();
        kindArea.append(field(t('vcardContacts'), rows), h('div', null, btn(t('addRow'), () => {
          draft.vcards!.push({ name: '', phone: '' });
          renderRows();
        }, { small: true, icon: 'plus' })), textEditor('messageText'));
        break;
      }
      case 'location': {
        draft.location ??= { lat: -23.5505, lng: -46.6333, name: '', address: '' };
        const l = draft.location;
        kindArea.append(
          h('div', { class: 'row' },
            h('div', { class: 'grow' }, field(t('latitude'), textInput(String(l.lat), (v) => (l.lat = Number(v.replace(',', '.')) || 0)))),
            h('div', { class: 'grow' }, field(t('longitude'), textInput(String(l.lng), (v) => (l.lng = Number(v.replace(',', '.')) || 0)))),
          ),
          field(t('placeName'), textInput(l.name, (v) => (l.name = v))),
          field(t('address'), textInput(l.address, (v) => (l.address = v))),
        );
        break;
      }
      case 'poll': {
        draft.poll ??= { question: '', options: ['', ''], selectable: 1 };
        const p = draft.poll;
        kindArea.append(
          field(t('pollQuestion'), textInput(p.question, (v) => (p.question = v))),
          field(t('pollOptions'), textArea(p.options.join('\n'), (v) => (p.options = v.split('\n').map((x) => x.trim()).filter(Boolean)), { rows: 4 })),
          field(t('pollSelectable'), numInput(p.selectable, (v) => (p.selectable = Math.max(1, v)), { min: 1 })),
        );
        break;
      }
      case 'pix': {
        draft.pix ??= { keyType: 'CPF', key: '', name: '', instructions: '' };
        const x = draft.pix;
        const types: PixKeyType[] = ['CPF', 'CNPJ', 'PHONE', 'EMAIL', 'EVP'];
        kindArea.append(
          field(t('pixKeyType'), selectBox(types.map((v) => ({ value: v, label: v })), x.keyType, (v) => (x.keyType = v))),
          field(t('pixKey'), textInput(x.key, (v) => (x.key = v))),
          field(t('pixName'), textInput(x.name, (v) => (x.name = v))),
          field(t('pixInstructions'), textInput(x.instructions, (v) => (x.instructions = v))),
        );
        break;
      }
      case 'event': {
        draft.event ??= { name: '', start: '', end: '', callType: '' };
        const ev = draft.event;
        kindArea.append(
          field(t('eventName'), textInput(ev.name, (v) => (ev.name = v))),
          h('div', { class: 'row' },
            h('div', { class: 'grow' }, field(t('eventStart'), h('input', { type: 'datetime-local', value: ev.start, oninput: (e: Event) => (ev.start = (e.target as HTMLInputElement).value) }))),
            h('div', { class: 'grow' }, field(t('eventEnd'), h('input', { type: 'datetime-local', value: ev.end, oninput: (e: Event) => (ev.end = (e.target as HTMLInputElement).value) }))),
          ),
          field(t('eventCall'), selectBox([
            { value: '' as const, label: t('eventCallNone') },
            { value: 'voice' as const, label: t('eventCallVoice') },
            { value: 'video' as const, label: t('eventCallVideo') },
          ], ev.callType, (v) => (ev.callType = v))),
          textEditor('taskDescription'),
        );
        break;
      }
    }
    updatePreview();
  };

  renderKind();
  modal(
    existing ? t('edit') : t('newTemplate'),
    [
      field(t('templateName'), textInput(draft.name, (v) => (draft.name = v))),
      field(t('templateKind'), selectBox(KINDS.map((k) => ({ value: k, label: t(`kind_${k}` as I18nKey) })), draft.kind, (v) => {
        draft.kind = v;
        renderKind();
      })),
      kindArea,
      check(t('quickReply'), draft.quick, (v) => (draft.quick = v)),
      field(t('preview'), previewBox),
    ],
    (close) => [
      btn(t('cancel'), close),
      btn(t('save'), () => {
        if (!draft.name.trim()) draft.name = templateSummary(draft).slice(0, 40) || t(`kind_${draft.kind}` as I18nKey);
        app.store.update('templates', (list) => {
          const i = list.findIndex((x) => x.id === draft.id);
          if (i >= 0) list[i] = draft;
          else list.push(draft);
        });
        toast(t('saved'), 'ok');
        close();
      }, { variant: 'primary' }),
    ],
  );
}

export async function sendTemplateToActive(app: App, tpl: Template): Promise<void> {
  const chatId = app.activeChatId ?? (await app.bridge.call<string | null>('activeChat').catch(() => null));
  if (!chatId) return toast(t('noActiveChat'), 'error');
  try {
    await app.sendTemplate(chatId, tpl, await app.varsFor(chatId));
    toast(t('sent'), 'ok');
  } catch (e) {
    toast(`${t('error')}: ${e instanceof Error ? e.message : e}`, 'error');
  }
}

export const templatesView: View = {
  id: 'templates',
  label: 'navTemplates',
  icon: 'templates',
  fields: ['templates'],
  render({ app }) {
    const list = app.store.data.templates;
    return h(
      'div',
      null,
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('templatesTitle')), btn(t('newTemplate'), () => openTemplateEditor(app), { variant: 'primary', icon: 'plus' })),
      h('p', { class: 'sub' }, t('variablesHelp')),
      list.length
        ? h('div', { class: 'list' }, list.map((tpl) =>
            h('div', { class: 'item' },
              h('div', { class: 'main' },
                h('div', { class: 'name' }, tpl.name, h('span', { class: 'badge acc' }, t(`kind_${tpl.kind}` as I18nKey)), tpl.quick ? h('span', { class: 'badge' }, '/') : null),
                h('div', { class: 'meta' }, templateSummary(tpl)),
              ),
              h('div', { class: 'acts' },
                iconBtn('send', t('sendToActive'), () => void sendTemplateToActive(app, tpl)),
                iconBtn('edit', t('edit'), () => openTemplateEditor(app, tpl)),
                iconBtn('copy', t('duplicate'), () => app.store.update('templates', (l) => void l.push({ ...structuredClone(tpl), id: uid('t_'), name: `${tpl.name} (2)`, createdAt: Date.now() }))),
                iconBtn('deleted', t('delete'), async () => {
                  if (await confirmBox(t('confirmDelete'))) app.store.update('templates', (l) => l.filter((x) => x.id !== tpl.id));
                }, 'danger'),
              ),
            ),
          ))
        : emptyState(),
    );
  },
};
