import { t, type I18nKey } from '../../../shared/i18n';
import type { PrivacySettings } from '../../../shared/types';
import { h } from '../h';
import { toggle } from '../components';
import type { View } from '../view';

const BLUR: (keyof PrivacySettings)[] = ['blurNames', 'blurPhotos', 'blurRecent', 'blurConversation', 'blurComposer'];
const STEALTH: (keyof PrivacySettings)[] = ['invisible', 'hideTyping', 'hideRecording', 'noReadReceipts', 'viewStatusHidden', 'listenAudioHidden', 'disableCalls'];

export const privacyView: View = {
  id: 'privacy',
  label: 'navPrivacy',
  icon: 'privacy',
  fields: ['settings'],
  render({ app }) {
    const p = app.store.settings.privacy;
    const row = (k: keyof PrivacySettings) =>
      toggle(t(k as I18nKey), p[k], (v) => app.store.update('settings', (s) => void (s.privacy[k] = v)));
    return h(
      'div',
      null,
      h('h2', null, t('navPrivacy')),
      h('h3', null, t('privacyBlurTitle')),
      h('div', { class: 'card' }, h('div', { class: 'hint', style: 'margin-bottom:4px' }, t('privacyBlurHint')), BLUR.map(row)),
      h('h3', null, t('privacyStealthTitle')),
      h('div', { class: 'card' }, STEALTH.map(row)),
      h('div', { class: 'banner info', style: 'margin-top:12px' }, t('privacyNote')),
    );
  },
};
