# WABA WEBE — pasta do projeto

## O que subir para o Chrome

**A pasta `PARA-O-CHROME`.** É ela que você escolhe no Chrome (ou Edge):

1. Abra `chrome://extensions` (no Edge: `edge://extensions`).
2. Ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta **`PARA-O-CHROME`** (a que tem o
   `manifest.json` dentro).
4. Abra ou recarregue <https://web.whatsapp.com> e clique no ícone **WW**.

Não apague nem mova a pasta depois de instalar: o Chrome lê os arquivos dela. Ao atualizar,
substitua o conteúdo e clique em recarregar no cartão da extensão. O passo a passo completo está
em `PARA-O-CHROME/LEIA-ME.txt`.

O arquivo `waba-webe-chrome-<versão>.zip` tem o mesmo conteúdo, para guardar, mandar para outra
pessoa (ela descompacta e escolhe a pasta) ou publicar na Chrome Web Store. O Chrome não instala o
.zip direto pelo modo do desenvolvedor.

## O resto

- **`extension/`** — o repositório da extensão (MIT): código TypeScript, testes, ícones, idiomas e o
  guia completo em `extension/README.md`. Para gerar de novo: `cd extension && npm install && npm run build`
  (isso atualiza `PARA-O-CHROME` e o .zip).
- **`main.py`** — pré-visualização do painel com dados de exemplo (sem WhatsApp, sem rede):
  `python main.py` abre no navegador; `python main.py --screenshot tela.png` salva uma captura.
- **`MECHANICS.md` / `mechanics.json`** — regras e valores lidos da extensão de referência.
