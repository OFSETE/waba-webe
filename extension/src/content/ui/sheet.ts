// Leitura e escrita de planilhas (CSV próprio; XLSX com SheetJS empacotado localmente).

import * as XLSX from 'xlsx';
import { parseCsv } from '../../shared/numbers';
import { toTxt } from '../../shared/extras';
import { downloadBlob, readFileAsArrayBuffer, readFileAsText } from './h';

export async function readSheetFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') return parseCsv(await readFileAsText(file));
  const wb = XLSX.read(await readFileAsArrayBuffer(file), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' });
  return rows.map((r) => r.map((c) => String(c ?? ''))).filter((r) => r.some((c) => c.trim() !== ''));
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.map(csvCell).join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n');
}

export function exportRows(name: string, rows: Record<string, unknown>[], format: 'csv' | 'xlsx' | 'txt'): void {
  if (format === 'txt') {
    downloadBlob(`${name}.txt`, new Blob(['\uFEFF', toTxt(rows)], { type: 'text/plain;charset=utf-8' }));
    return;
  }
  if (format === 'csv') {
    downloadBlob(`${name}.csv`, new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    return;
  }
  // como a referência (bootstrap.min.js 0x22119): toda célula como texto ("@"), planilha "WhatsApp",
  // compressão ligada — números de telefone não viram notação científica
  const ws = XLSX.utils.json_to_sheet(rows);
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = range.s.r; r <= range.e.r; r++)
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        cell.v = cell.v === undefined || cell.v === null ? '' : String(cell.v);
        cell.t = 's';
        cell.z = '@';
      }
    }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'WhatsApp');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
  downloadBlob(`${name}.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
