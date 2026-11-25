import { t } from '../../../shared/i18n';
import { DEFAULT_GEMINI_MODEL, maskKey } from '../../../shared/ai';
import { h, clear } from '../h';
import { btn, field, numInput, textArea, textInput, toast, toggle } from '../components';
import type { View } from '../view';

let showKey = false;

export const aiView: View = {
  id: 'ai',
  label: 'navAi',
  icon: 'bolt',
  fields: [],
  render({ app, rerender }) {
    const ai = app.store.settings.ai;
    const save = (fn: (a: typeof ai) => void) => app.store.update('settings', (s) => void fn(s.ai));

    const keyInput = h('input', {
      type: showKey ? 'text' : 'password',
      value: ai.apiKey,
      placeholder: 'AIza…',
      autocomplete: 'off',
      spellcheck: 'false',
      oninput: (e: Event) => save((a) => (a.apiKey = (e.target as HTMLInputElement).value.trim())),
    });

    const permRow = h('div', { class: 'row' });
    const refreshPerm = async () => {
      clear(permRow);
      if (await app.ai.hasPermission()) permRow.append(h('span', { class: 'badge ok' }, `${t('permissionOk')}: generativelanguage.googleapis.com`));
      else
        permRow.append(
          h('span', { class: 'hint grow' }, t('permissionNeeded', { origin: 'generativelanguage.googleapis.com' })),
          btn(t('aiPermission'), async () => {
            await app.ai.requestPermission();
            setTimeout(() => void refreshPerm(), 4000);
          }, { small: true, variant: 'primary' }),
        );
    };
    void refreshPerm();

    const modelBox = h('div', { class: 'row' });
    const renderModel = (options: string[] = []) => {
      clear(modelBox);
      const list = Array.from(new Set([ai.model || DEFAULT_GEMINI_MODEL, ...options]));
      const input = textInput(ai.model || DEFAULT_GEMINI_MODEL, (v) => save((a) => (a.model = v.trim() || DEFAULT_GEMINI_MODEL)), { list: 'ww-gemini-models' });
      modelBox.append(
        h('div', { class: 'grow' }, input, h('datalist', { id: 'ww-gemini-models' }, list.map((m) => h('option', { value: m })))),
        btn(t('aiLoadModels'), async () => {
          try {
            const models = await app.ai.models();
            renderModel(models);
            toast(`${models.length}`, 'ok');
          } catch (e) {
            toast(`${t('error')}: ${e instanceof Error ? e.message : e}`, 'error');
          }
        }, { small: true }),
      );
    };
    renderModel();

    const hb = app.store.settings.headerButtons;
    return h(
      'div',
      null,
      h('h2', null, t('aiTitle')),
      h('p', { class: 'sub' }, t('aiHint')),
      h('div', { class: 'card stack' },
        field(t('aiKey'), h('div', { class: 'row' }, h('div', { class: 'grow' }, keyInput), btn(showKey ? t('aiHideKey') : t('aiShowKey'), () => {
          showKey = !showKey;
          rerender();
        }, { small: true, icon: 'eye' })), t('aiKeyHelp')),
        ai.apiKey ? h('div', { class: 'hint' }, maskKey(ai.apiKey)) : null,
        permRow,
        field(t('aiModel'), modelBox),
        h('div', null, btn(t('aiTest'), async () => {
          try {
            await app.ai.test();
            toast(t('aiOk'), 'ok');
          } catch (e) {
            toast(`${t('error')}: ${e instanceof Error ? e.message : e}`, 'error');
          }
        }, { variant: 'primary', icon: 'bolt' })),
      ),
      h('div', { class: 'card stack', style: 'margin-top:10px' },
        field(t('aiInstructions'), textArea(ai.instructions, (v) => save((a) => (a.instructions = v)), { rows: 5, placeholder: t('aiInstructionsHint') })),
        field(t('aiTranslateTo'), textInput(ai.translateTo, (v) => save((a) => (a.translateTo = v)))),
        field(t('aiTemperature'), numInput(ai.temperature, (v) => save((a) => (a.temperature = Math.max(0, Math.min(2, v)))), { min: 0, max: 2, step: 0.1 })),
      ),
      h('div', { class: 'card', style: 'margin-top:10px' },
        toggle(t('hb_aiSuggest'), hb.aiSuggest, (v) => app.store.update('settings', (s) => void (s.headerButtons.aiSuggest = v))),
        toggle(t('hb_translate'), hb.translate, (v) => app.store.update('settings', (s) => void (s.headerButtons.translate = v))),
        toggle(t('hb_transcribe'), hb.transcribe, (v) => app.store.update('settings', (s) => void (s.headerButtons.transcribe = v))),
        h('div', { class: 'hint' }, t('aiReplyHint'), ' → ', t('navAutomations')),
      ),
      h('div', { class: 'banner info', style: 'margin-top:12px' }, t('aiPrivacy')),
    );
  },
};
