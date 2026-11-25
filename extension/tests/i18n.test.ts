import { describe, expect, it } from 'vitest';
import { I18N_KEYS, rawText } from '../src/shared/i18n';
import type { Lang } from '../src/shared/types';

const LANGS: Lang[] = ['en', 'es', 'ar', 'ru', 'tr'];

/** Marcadores que não podem ser traduzidos: {nome}, ${variavel}, {{campo}}. */
function markers(s: string): string[] {
  const out = [...s.matchAll(/\$\{[^}]+\}|\{\{[^}]+\}\}|\{[a-z]+\}/gi)].map((m) => m[0]);
  return out.sort();
}

describe('traduções', () => {
  it.each(LANGS)('%s tem todos os textos', (lang) => {
    const missing = I18N_KEYS.filter((k) => !rawText(lang, k));
    expect(missing).toEqual([]);
  });

  it.each(LANGS)('%s mantém os marcadores ({n}, ${...}, {{...}})', (lang) => {
    const broken = I18N_KEYS.filter((k) => JSON.stringify(markers(rawText(lang, k) ?? '')) !== JSON.stringify(markers(rawText('pt_BR', k) ?? '')));
    expect(broken).toEqual([]);
  });

  it.each(LANGS)('%s tem 7 dias da semana', (lang) => {
    expect((rawText(lang, 'dayNames') ?? '').split(',')).toHaveLength(7);
  });
});
