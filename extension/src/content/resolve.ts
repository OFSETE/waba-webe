// Transforma um modelo salvo numa mensagem pronta para enviar (variáveis + spintax).

import type { ResolvedMessage, Template } from '../shared/types';
import { renderText, type VarContext } from '../shared/variables';
import { locale } from '../shared/i18n';

function toEpochSec(local: string): number | undefined {
  if (!local) return undefined;
  const ms = new Date(local).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

export function resolveTemplate(tpl: Template, ctx: VarContext): ResolvedMessage {
  const c: VarContext = { locale: locale(), ...ctx };
  const r = (s: string) => renderText(s ?? '', c);
  const out: ResolvedMessage = { kind: tpl.kind, text: r(tpl.text) };
  switch (tpl.kind) {
    case 'media':
      out.media = tpl.media;
      break;
    case 'vcard':
      out.vcards = (tpl.vcards ?? []).filter((v) => v.phone).map((v) => ({ name: r(v.name), phone: v.phone.replace(/\D/g, '') }));
      break;
    case 'location':
      out.location = tpl.location && { ...tpl.location, name: r(tpl.location.name), address: r(tpl.location.address) };
      break;
    case 'poll':
      out.poll = tpl.poll && {
        question: r(tpl.poll.question),
        options: tpl.poll.options.map(r).filter(Boolean),
        selectable: Math.max(1, Math.min(tpl.poll.selectable || 1, tpl.poll.options.length || 1)),
      };
      break;
    case 'pix':
      out.pix = tpl.pix && { ...tpl.pix, name: r(tpl.pix.name), instructions: r(tpl.pix.instructions) };
      break;
    case 'event': {
      const e = tpl.event;
      if (e) {
        const start = toEpochSec(e.start) ?? Math.floor(Date.now() / 1000) + 3600;
        out.event = { name: r(e.name), startTime: start, endTime: toEpochSec(e.end), callType: e.callType || undefined };
      }
      break;
    }
    case 'call': {
      const c = tpl.call;
      if (c) {
        const ms = new Date(c.start).getTime();
        out.call = { title: r(c.title), startMs: Number.isFinite(ms) ? ms : Date.now() + 3_600_000, callType: c.callType || 'voice' };
      }
      break;
    }
    case 'list':
      out.list = tpl.list && {
        buttonText: r(tpl.list.buttonText),
        title: r(tpl.list.title),
        footer: r(tpl.list.footer),
        sections: tpl.list.sections
          .map((s) => ({ title: r(s.title), rows: s.rows.filter((x) => x.title.trim()).map((x) => ({ title: r(x.title), description: r(x.description) })) }))
          .filter((s) => s.rows.length),
      };
      break;
    default:
      break;
  }
  return out;
}

/** URL da imagem dinâmica com as variáveis aplicadas (sem spintax, para não estragar o endereço). */
export function dynamicImageUrl(tpl: Template, ctx: VarContext & { profilePicture?: string }): string {
  const raw = tpl.dynamicImage?.url ?? '';
  return raw.replace(/\$\{\s*([A-Za-z0-9_]+)\s*\}/g, (whole, name: string) => {
    if (name === 'profilePicture') return encodeURIComponent(ctx.profilePicture ?? '');
    const v = renderText(`\${${name}}`, ctx);
    return v === whole ? whole : encodeURIComponent(v);
  });
}

/** Texto curto para mostrar o modelo numa lista. */
export function templateSummary(tpl: Template): string {
  switch (tpl.kind) {
    case 'media':
      return `${tpl.media?.name ?? ''} ${tpl.text}`.trim();
    case 'vcard':
      return (tpl.vcards ?? []).map((v) => v.name || v.phone).join(', ');
    case 'location':
      return tpl.location ? `${tpl.location.name || ''} (${tpl.location.lat}, ${tpl.location.lng})` : '';
    case 'poll':
      return tpl.poll ? `${tpl.poll.question} — ${tpl.poll.options.join(' / ')}` : '';
    case 'pix':
      return tpl.pix ? `${tpl.pix.keyType}: ${tpl.pix.key}` : '';
    case 'event':
      return tpl.event ? `${tpl.event.name} — ${tpl.event.start.replace('T', ' ')}` : '';
    case 'call':
      return tpl.call ? `${tpl.call.title} — ${tpl.call.start.replace('T', ' ')}` : '';
    case 'list':
      return tpl.list ? `${tpl.list.buttonText}: ${tpl.list.sections.flatMap((s) => s.rows.map((x) => x.title)).join(' / ')}` : '';
    case 'dynamicImage':
      return `${tpl.dynamicImage?.url ?? ''} ${tpl.text}`.trim();
    default:
      return tpl.text;
  }
}
