import { describe, expect, it } from 'vitest';
import { firstName, lastName, renderText, replaceVariables, spin, formatDate, formatTime } from '../src/shared/variables';

const now = new Date(2026, 10, 25, 9, 5); // 25/11/2026 09:05

describe('variáveis', () => {
  const ctx = { contactName: 'Maria Clara Souza', waName: 'Mari S', phone: '5511987654321', groupName: 'Equipe', messageContent: 'quero o preço', now, locale: 'pt-BR' };

  it('substitui nomes, partes do nome e telefone', () => {
    expect(replaceVariables('${contactName}|${contactNameFirst}|${contactNameLast}', ctx)).toBe('Maria Clara Souza|Maria|Clara'); // sobrenome = 2ª palavra, como a referência
    expect(replaceVariables('${waName}|${waNameFirst}|${waNameLast}', ctx)).toBe('Mari S|Mari|S');
    expect(replaceVariables('${phone} ${groupName}', ctx)).toBe('5511987654321 Equipe');
    expect(replaceVariables('Você disse: ${messageContent}', ctx)).toBe('Você disse: quero o preço');
  });

  it('formata data e hora', () => {
    expect(replaceVariables('${date} ${time}', ctx)).toBe('25/11/2026 09:05:00');
    expect(formatTime(new Date(2026, 0, 1, 15, 4, 9), 'en-US')).toBe('3:04:09 PM');
    expect(formatDate(now, 'en-US')).toBe('11/25/2026');
  });

  it('usa colunas da planilha em ${1}..${N}', () => {
    expect(replaceVariables('${1} - ${2} - ${3} - ${9}', { columns: ['5511', 'Pedido 7', 'R$ 10'] })).toBe('5511 - Pedido 7 - R$ 10 - ');
  });

  it('sem nome salvo, contactName cai para o nome do WhatsApp', () => {
    expect(replaceVariables('Oi ${contactNameFirst}', { waName: 'João Pedro' })).toBe('Oi João');
  });

  it('mantém variáveis desconhecidas e aceita espaços', () => {
    expect(replaceVariables('${foo} ${ phone }', { phone: '1' })).toBe('${foo} 1');
  });

  it('primeiro e último nome', () => {
    expect(firstName('  Ana  ')).toBe('Ana');
    expect(lastName('Ana')).toBe('');
    expect(lastName('Ana de Souza')).toBe('de');
  });
});

describe('spintax', () => {
  it('sorteia uma das opções', () => {
    expect(spin('{a|b|c}', () => 0)).toBe('a');
    expect(spin('{a|b|c}', () => 0.5)).toBe('b');
    expect(spin('{a|b|c}', () => 0.999)).toBe('c');
  });

  it('resolve aninhado', () => {
    expect(spin('{Oi|{Olá|E aí}} tudo bem', () => 0.99)).toBe('E aí tudo bem');
  });

  it('chaves sem barra perdem as chaves (regra da referência); variáveis ficam intactas', () => {
    expect(spin('{json} ${contactName} {x|y} {}', () => 0)).toBe('json ${contactName} x {}');
  });

  it('opção pode conter variável', () => {
    expect(renderText('{Oi ${contactNameFirst}|Olá}', { contactName: 'Ana Lima' }, () => 0)).toBe('Oi Ana');
  });

  it('conteúdo da variável não vira spintax', () => {
    expect(renderText('${messageContent}', { messageContent: '{a|b}' }, () => 0)).toBe('{a|b}');
  });

  it('o texto final é aparado nas pontas', () => {
    expect(renderText('  oi {a|b}  ', {}, () => 0)).toBe('oi a');
  });

  it('opção vazia é permitida', () => {
    expect(spin('a{|!}', () => 0)).toBe('a');
  });
});
