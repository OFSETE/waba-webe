# Avisos de terceiros / Third-party notices

O WABA WEBE é distribuído sob a licença MIT (veja `LICENSE`). Ele inclui, sem modificações,
os componentes abaixo, cada um sob a sua própria licença. Os textos completos das licenças vão
em `dist/licenses/` a cada build.

## @wppconnect/wa-js

- Uso: biblioteca carregada no contexto da página do WhatsApp Web (global `WPP`), copiada para
  `dist/vendor/wppconnect-wa.js`.
- Licença: Apache License 2.0
- Copyright 2021–2025 WPPConnect Team
- Projeto: https://github.com/wppconnect-team/wa-js
- O arquivo `dist/vendor/wppconnect-wa.js.LICENSE.txt` traz os avisos dos componentes que a
  própria biblioteca embute (por exemplo Compressor.js, licença MIT).
- Configuração usada pelo WABA WEBE: análise de uso desligada, nenhum servidor de prévia de link
  (`linkPreviewApiServers: []`) e envio de prévia de link desligado em cada mensagem.

## SheetJS Community Edition (xlsx)

- Uso: leitura e escrita de planilhas XLSX, empacotada dentro de `dist/content.js`.
- Licença: Apache License 2.0
- Copyright (C) 2012-present SheetJS LLC
- Projeto: https://sheetjs.com — versão 0.20.3 obtida de https://cdn.sheetjs.com

## Ferramentas de desenvolvimento (não são distribuídas na extensão)

TypeScript (Apache-2.0), esbuild (MIT), Vitest (MIT), @types/chrome (MIT).

---

WhatsApp é marca registrada da WhatsApp LLC / Meta Platforms, Inc. O WABA WEBE não é afiliado,
associado, autorizado ou endossado por elas.
