import { LANGS, t, type I18nKey } from '../../../shared/i18n';
import type { Customizations, Lang, Theme } from '../../../shared/types';
import { emptyData } from '../../../shared/defaults';
import { exportBackup, parseBackup } from '../../../shared/storage';
import { BACKUP_PARTS, type BackupPart } from '../../../shared/extras';
import { h, downloadBlob, pickFile, readFileAsDataUrl, readFileAsText } from '../h';
import { btn, check, confirmBox, field, numInput, segmented, selectBox, toast, toggle } from '../components';
import type { View } from '../view';

export const MAX_BACKGROUND_BYTES = 2 * 1024 * 1024;

const backupSel = new Set<BackupPart>(BACKUP_PARTS);

export const settingsView: View = {
  id: 'settings',
  label: 'navSettings',
  icon: 'settings',
  fields: ['settings'],
  render({ app }) {
    const s = app.store.settings;
    const bg = s.background;
    return h(
      'div',
      null,
      h('h2', null, t('settingsTitle')),
      h('div', { class: 'card stack', style: 'margin-top:10px' },
        field(t('language'), selectBox<Lang>(LANGS, s.lang, (v) => app.store.update('settings', (x) => void (x.lang = v)))),
        field(t('theme'), segmented<Theme>((['auto', 'light', 'dark'] as Theme[]).map((v) => ({ value: v, label: t(`theme_${v}` as I18nKey) })), s.theme, (v) => app.store.update('settings', (x) => void (x.theme = v)))),
      ),
      h('h3', null, t('background')),
      h('div', { class: 'card stack' },
        h('div', { class: 'hint' }, t('backgroundHint')),
        bg ? h('img', { src: bg.dataUrl, style: 'max-height:120px;border-radius:8px;object-fit:cover' }) : null,
        h('div', { class: 'row' },
          btn(t('chooseFile'), async () => {
            const f = await pickFile('image/png,image/jpeg,image/webp');
            if (!f) return;
            if (!f.type.startsWith('image/')) return toast(t('backgroundHint'), 'error');
            if (f.size > MAX_BACKGROUND_BYTES) return toast(t('fileTooBig', { max: 2 }), 'error');
            const dataUrl = await readFileAsDataUrl(f);
            app.store.update('settings', (x) => void (x.background = { dataUrl, dim: x.background?.dim ?? 20 }));
          }, { icon: 'upload', small: true }),
          bg ? btn(t('removeBackground'), () => app.store.update('settings', (x) => void (x.background = null)), { small: true, variant: 'danger' }) : null,
        ),
        bg ? field(t('backgroundDim'), numInput(bg.dim, (v) => app.store.update('settings', (x) => void (x.background && (x.background.dim = Math.max(0, Math.min(90, v))))), { min: 0, max: 90 })) : null,
      ),
      h('h3', null, t('backup')),
      // backup escolhendo o que entra (como "exportar/importar dados" da referência)
      h('div', { class: 'card stack' },
        field(t('backupParts'), h('div', { class: 'row' }, BACKUP_PARTS.map((p) =>
          check(t(`part_${p}` as I18nKey), backupSel.has(p), (v) => {
            if (v) backupSel.add(p);
            else backupSel.delete(p);
          }),
        ))),
        h('div', { class: 'row' },
        btn(t('exportBackup'), () => {
          const full = JSON.parse(exportBackup(app.store.data)) as { data: Record<string, unknown> };
          for (const k of Object.keys(full.data)) if (!backupSel.has(k as BackupPart)) delete full.data[k];
          downloadBlob(`wabawebe-backup-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(full, null, 2)], { type: 'application/json' }));
        }, { icon: 'download' }),
        btn(t('importBackup'), async () => {
          const f = await pickFile('application/json,.json');
          if (!f) return;
          try {
            const text = await readFileAsText(f);
            const incoming = parseBackup(text, app.store.settings.ai.apiKey);
            const raw = (JSON.parse(text) as { data?: Record<string, unknown> }).data ?? {};
            // só substitui as partes marcadas E que vieram no arquivo
            const merged = { ...app.store.data };
            for (const p of BACKUP_PARTS) if (backupSel.has(p) && raw[p] !== undefined) (merged as Record<string, unknown>)[p] = incoming[p];
            await app.store.replaceAll(merged);
            toast(t('backupImported'), 'ok');
          } catch {
            toast(t('backupInvalid'), 'error');
          }
        }, { icon: 'upload' }),
        btn(t('resetAll'), async () => {
          if (await confirmBox(t('resetConfirm'))) await app.store.replaceAll(emptyData());
        }, { variant: 'danger' }),
        ),
      ),
      h('h3', null, t('customizationsTitle')),
      h('div', { class: 'card' },
        (['preventChatsListJumping', 'notifyOnlineActivities', 'notifyTypingRecordingActivities'] as (keyof Customizations)[]).map((k) =>
          toggle(t(`cz_${k}` as I18nKey), app.store.settings.customizations[k], (v) => app.store.update('settings', (x) => void (x.customizations[k] = v))),
        ),
      ),
      h('h3', null, t('about')),
      h('div', { class: 'card' }, h('div', { style: 'font-weight:600' }, `WABA WEBE ${chrome.runtime?.getManifest?.().version ?? ''}`), h('div', { class: 'hint' }, t('aboutText'))),
    );
  },
};
