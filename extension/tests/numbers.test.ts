import { describe, expect, it } from 'vitest';
import { dialCodeOf, normalizePhone, parseCsv, parsePastedNumbers, phoneFromId, rowsToRecipients } from '../src/shared/numbers';

describe('normalização de números', () => {
  it('remove símbolos e espaços', () => {
    expect(normalizePhone('+55 (11) 98765-4321')).toBe('5511987654321');
  });
  it('remove 00 e zeros à esquerda', () => {
    expect(normalizePhone('0055 11 98765 4321')).toBe('5511987654321');
  });
  it('rejeita curtos e longos demais', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('1234567890123456')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
  it('prefixa o DDI no formato local', () => {
    expect(normalizePhone('(11) 98765-4321', { format: 'local', ddi: '55' })).toBe('5511987654321');
    expect(normalizePhone('011 98765-4321', { format: 'local', ddi: '55' })).toBe('5511987654321');
  });
  it('não duplica o DDI quando já presente', () => {
    expect(normalizePhone('5511987654321', { format: 'local', ddi: '55' })).toBe('5511987654321');
  });
  it('DDD igual ao DDI (55) com número local ainda recebe o prefixo', () => {
    expect(normalizePhone('55 99876-5432', { format: 'local', ddi: '55' })).toBe('5555998765432');
  });
  it('números colados: separa por linha, vírgula e ponto e vírgula, sem repetir', () => {
    expect(parsePastedNumbers('5511987654321\n+55 21 97654-3210; 5511987654321, x')).toEqual(['5511987654321', '5521976543210']);
  });
  it('identifica o DDI pelo prefixo mais longo', () => {
    expect(dialCodeOf('5511987654321')).toBe('55');
    expect(dialCodeOf('351912345678')).toBe('351');
    expect(dialCodeOf('15551234567')).toBe('1');
    expect(dialCodeOf('999')).toBeNull();
  });
  it('extrai o telefone de um id', () => {
    expect(phoneFromId('5511987654321@c.us')).toBe('5511987654321');
    expect(phoneFromId('1203630@g.us')).toBe('');
  });
});

describe('planilhas', () => {
  it('lê CSV com vírgula, aspas e quebra de linha dentro de aspas', () => {
    const rows = parseCsv('numero,nome\r\n5511987654321,"Silva, Ana"\n5521976543210,"linha1\nlinha2"\n');
    expect(rows).toEqual([
      ['numero', 'nome'],
      ['5511987654321', 'Silva, Ana'],
      ['5521976543210', 'linha1\nlinha2'],
    ]);
  });
  it('detecta ponto e vírgula e ignora BOM e linhas vazias', () => {
    expect(parseCsv('﻿a;b\n\n1;"x""y"')).toEqual([
      ['a', 'b'],
      ['1', 'x"y'],
    ]);
  });
  it('1ª coluna = número; cabeçalho e repetidos são ignorados; colunas viram ${1}..${N}', () => {
    const { recipients, invalid } = rowsToRecipients(
      [
        ['Telefone', 'Nome', 'Pedido'],
        ['(11) 98765-4321', 'Ana', '7'],
        ['11 98765 4321', 'Ana de novo', '8'],
        ['21976543210', 'Bruno', ''],
      ],
      { format: 'local', ddi: '55' },
    );
    expect(invalid).toBe(1);
    expect(recipients).toEqual([
      { phone: '5511987654321', columns: ['5511987654321', 'Ana', '7'] },
      { phone: '5521976543210', columns: ['5521976543210', 'Bruno', ''] },
    ]);
  });
});
