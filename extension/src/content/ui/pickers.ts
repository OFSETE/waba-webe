// Itens para as listas de seleção (contatos, grupos, etiquetas, países, conversas...).

import { COUNTRY_DIAL, flagOf } from '../../shared/numbers';
import { getLang, t } from '../../shared/i18n';
import type { App } from '../app';
import type { PickItem } from './components';

export function countryName(iso: string): string {
  try {
    const dn = new Intl.DisplayNames([getLang() === 'en' ? 'en' : 'pt-BR'], { type: 'region' });
    return dn.of(iso) ?? iso;
  } catch {
    return iso;
  }
}

export function countryItems(): PickItem[] {
  return Object.entries(COUNTRY_DIAL)
    .map(([iso, dial]) => ({ id: iso, label: `${flagOf(iso)} ${countryName(iso)}`, sub: `+${dial}` }))
    .sort((a, b) => a.label.slice(5).localeCompare(b.label.slice(5)));
}

export function contactItems(app: App): PickItem[] {
  return app.dir.contacts
    .filter((c) => c.isMyContact)
    .map((c) => ({ id: c.id, label: c.name || c.pushname || c.phone, sub: c.phone ? `+${c.phone}` : '' }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function groupItems(app: App): PickItem[] {
  return app.dir.groups.map((g) => ({ id: g.id, label: g.name || g.id })).sort((a, b) => a.label.localeCompare(b.label));
}

export function listItems(app: App): PickItem[] {
  return app.dir.broadcastLists.map((g) => ({ id: g.id, label: g.name || g.id }));
}

export function labelItems(app: App): PickItem[] {
  return app.dir.labels.map((l) => ({ id: l.id, label: l.name, sub: l.count ? String(l.count) : '' }));
}

export function chatItems(app: App): PickItem[] {
  return app.dir.chats
    .filter((c) => !c.isBroadcast)
    .map((c) => ({ id: c.id, label: c.name || c.id.split('@')[0], sub: c.isGroup ? t('targetsGroups') : `+${c.id.split('@')[0]}` }));
}

export function templateItems(app: App): PickItem[] {
  return app.store.data.templates.map((x) => ({ id: x.id, label: x.name, sub: t(`kind_${x.kind}` as never) }));
}

export function webhookItems(app: App): PickItem[] {
  return app.store.data.webhooks.map((w) => ({ id: w.id, label: w.name || w.url, sub: w.url }));
}
