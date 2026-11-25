// Gera dist/ (extensão pronta para "Carregar sem compactação") e dist-preview/ (pré-visualização do painel).

import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { zipFolder } from './zip.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const preview = join(root, 'dist-preview');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

if (!existsSync(join(root, 'icons', 'icon-128.png'))) execFileSync(process.execPath, [join(root, 'scripts', 'make-icons.mjs')], { stdio: 'inherit' });

rmSync(dist, { recursive: true, force: true });
rmSync(preview, { recursive: true, force: true });
mkdirSync(join(dist, 'vendor'), { recursive: true });
mkdirSync(preview, { recursive: true });

const common = {
  bundle: true,
  format: 'iife',
  target: ['chrome110'],
  charset: 'utf8',
  legalComments: 'eof',
  logLevel: 'info',
  sourcemap: false,
  minify: false,
};

await build({
  ...common,
  entryPoints: {
    background: 'src/background/index.ts',
    content: 'src/content/index.ts',
    page: 'src/page/index.ts',
    'wa-config': 'src/page/wa-config.ts',
    grant: 'src/grant/index.ts',
  },
  outdir: dist,
  absWorkingDir: root,
});

await build({ ...common, entryPoints: { preview: 'src/preview/main.ts' }, outdir: preview, absWorkingDir: root });

// manifesto com a versão do package.json
const manifest = JSON.parse(readFileSync(join(root, 'static', 'manifest.json'), 'utf8'));
manifest.version = pkg.version;
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));

cpSync(join(root, 'static', 'grant.html'), join(dist, 'grant.html'));
cpSync(join(root, '_locales'), join(dist, '_locales'), { recursive: true });
cpSync(join(root, 'icons'), join(dist, 'icons'), { recursive: true });
cpSync(join(root, 'node_modules', '@wppconnect', 'wa-js', 'dist', 'wppconnect-wa.js'), join(dist, 'vendor', 'wppconnect-wa.js'));
cpSync(join(root, 'node_modules', '@wppconnect', 'wa-js', 'dist', 'wppconnect-wa.js.LICENSE.txt'), join(dist, 'vendor', 'wppconnect-wa.js.LICENSE.txt'));
mkdirSync(join(dist, 'licenses'), { recursive: true });
cpSync(join(root, 'node_modules', '@wppconnect', 'wa-js', 'LICENSE'), join(dist, 'licenses', 'wa-js-LICENSE.txt'));
cpSync(join(root, 'node_modules', 'xlsx', 'LICENSE'), join(dist, 'licenses', 'SheetJS-LICENSE.txt'));
for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) if (existsSync(join(root, f))) cpSync(join(root, f), join(dist, f));

cpSync(join(root, 'static', 'LEIA-ME.txt'), join(dist, 'LEIA-ME.txt'));
cpSync(join(root, 'static', 'preview.html'), join(preview, 'preview.html'));

// pacote .zip da extensão (para guardar, enviar a alguém ou publicar na Chrome Web Store)
mkdirSync(join(root, 'release'), { recursive: true });
const zipName = `waba-webe-chrome-${pkg.version}.zip`;
const nFiles = zipFolder(dist, join(root, 'release', zipName));

// Na pasta do projeto do Craft Anything (que tem main.py), deixa uma cópia fácil de achar:
// PARA-O-CHROME/ (a pasta que se escolhe em "Carregar sem compactação") e o .zip ao lado.
const outer = join(root, '..');
let handy = '';
if (existsSync(join(outer, 'main.py'))) {
  handy = join(outer, 'PARA-O-CHROME');
  rmSync(handy, { recursive: true, force: true });
  cpSync(dist, handy, { recursive: true });
  cpSync(join(root, 'release', zipName), join(outer, zipName));
}

console.log(`\nOK: extensão em ${dist}\n    zip em ${join(root, 'release', zipName)} (${nFiles} arquivos)`);
if (handy) console.log(`    pasta para o Chrome: ${handy}`);
console.log(`    pré-visualização em ${join(preview, 'preview.html')}`);
