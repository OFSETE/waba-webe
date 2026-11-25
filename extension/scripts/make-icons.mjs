// Gera os ícones próprios "WW" (verde-azulado) em PNG 16/48/128, sem dependências.
// Desenho: quadrado arredondado com degradê + dois "W" brancos em traço, com antisserrilhado.

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'icons');

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Coordenadas num quadro de 64×64 (mesmo desenho do logotipo do painel)
const W1 = [[10, 20], [15.5, 44], [22, 26], [28.5, 44], [34, 20]];
const W2 = [[30, 20], [35.5, 44], [42, 26], [48.5, 44], [54, 20]];
const SEGS = [];
for (const w of [W1, W2]) for (let i = 0; i < w.length - 1; i++) SEGS.push([...w[i], ...w[i + 1]]);

function sample(x, y) {
  // fundo: quadrado arredondado (raio 16) com degradê
  const r = 16;
  const cx = Math.min(Math.max(x, 2 + r), 62 - r);
  const cy = Math.min(Math.max(y, 2 + r), 62 - r);
  const inside = Math.hypot(x - cx, y - cy) <= r && x >= 2 && x <= 62 && y >= 2 && y <= 62;
  if (!inside) return [0, 0, 0, 0];
  const t = (x + y) / 128;
  const c1 = [0x14, 0xb8, 0xa6];
  const c2 = [0x0e, 0x74, 0x90];
  let col = c1.map((v, i) => v + (c2[i] - v) * t);
  const stroke = 2.3;
  const d = Math.min(...SEGS.map((s) => distSeg(x, y, ...s)));
  if (d <= stroke) col = [255, 255, 255];
  return [...col, 255];
}

function render(size) {
  const ss = 4; // supersampling 4×4
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      let acc = [0, 0, 0, 0];
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const x = ((px + (sx + 0.5) / ss) / size) * 64;
          const y = ((py + (sy + 0.5) / ss) / size) * 64;
          const [r, g, b, a] = sample(x, y);
          acc = [acc[0] + r * a, acc[1] + g * a, acc[2] + b * a, acc[3] + a];
        }
      const o = (py * size + px) * 4;
      const a = acc[3] / (ss * ss);
      buf[o] = acc[3] ? Math.round(acc[0] / acc[3]) : 0;
      buf[o + 1] = acc[3] ? Math.round(acc[1] / acc[3]) : 0;
      buf[o + 2] = acc[3] ? Math.round(acc[2] / acc[3]) : 0;
      buf[o + 3] = Math.round(a);
    }
  return png(size, buf);
}

mkdirSync(outDir, { recursive: true });
for (const s of [16, 48, 128]) writeFileSync(join(outDir, `icon-${s}.png`), render(s));
console.log('ícones gerados em', outDir);
