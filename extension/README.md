# WABA WEBE

Extensão de navegador **open source (MIT)** para o WhatsApp Web, para Chrome e Edge (Manifest V3).
Privacidade, modelos de mensagem, transmissões, automações, webhooks e ferramentas —
**tudo grátis e local**: sem telemetria, sem servidor próprio, sem conta, sem licença, sem paywall.

> ⚠️ **API não oficial.** O WABA WEBE usa a biblioteca de código aberto
> [@wppconnect/wa-js](https://github.com/wppconnect-team/wa-js) para conversar com o WhatsApp Web.
> Ela depende de partes internas do WhatsApp Web que **podem mudar a qualquer momento** e quebrar
> recursos sem aviso. Quando isso acontecer, atualize a dependência (`npm update @wppconnect/wa-js`)
> e gere o build de novo.

> ⚠️ **Aviso anti-spam.** Envio em massa e respostas automáticas para quem não pediu violam os
> [Termos de Serviço do WhatsApp](https://www.whatsapp.com/legal/terms-of-service) e podem levar ao
> **banimento do seu número**. Use transmissões só com quem aceitou receber suas mensagens, com
> intervalos generosos e conteúdo útil. Você é o único responsável pelo uso. A extensão pede um
> aceite explícito antes da primeira transmissão.

O WABA WEBE não é afiliado à WhatsApp LLC nem à Meta.

---

## Instalação (sem compactação)

1. Instale o [Node.js](https://nodejs.org) 18 ou mais novo.
2. Nesta pasta:
   ```bash
   npm install
   npm run build
   ```
3. No Chrome abra `chrome://extensions` (no Edge, `edge://extensions`), ligue o **Modo do
   desenvolvedor** e clique em **Carregar sem compactação** → escolha a pasta **`dist/`**
   (a que tem o `manifest.json`). O build também gera `release/waba-webe-chrome-<versão>.zip`
   com o mesmo conteúdo — para guardar, compartilhar ou enviar à Chrome Web Store
   (o Chrome não instala o .zip direto no modo do desenvolvedor).
4. Abra (ou recarregue) <https://web.whatsapp.com>. Clique no ícone **WW** que aparece na barra de
   ferramentas do próprio WhatsApp (a coluna de ícones à esquerda) — ou no ícone WW da barra do navegador.

Para atualizar depois de mudar o código: `npm run build` e clique em "recarregar" na extensão.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run build` | Gera `dist/` (extensão) e `dist-preview/` (pré-visualização do painel). |
| `npm test` | Roda os testes (vitest): variáveis, spintax, planilhas/números, filtros, agendador, webhooks. |
| `npm run typecheck` | Verifica os tipos do TypeScript. |
| `npm run icons` | Regera os ícones PNG 16/48/128 em `icons/`. |
| `python main.py` | Abre a pré-visualização do painel com dados de exemplo (sem WhatsApp). |
| `python main.py --screenshot tela.png` | Salva uma captura da pré-visualização (Chrome/Edge sem janela). |

## Recursos

- **Privacidade** — desfocar nomes, fotos, prévias da lista, mensagens da conversa e campo de
  digitação (passe o mouse para revelar); modo invisível; esconder "digitando…" e "gravando…";
  não enviar confirmação de leitura; ver status sem avisar; ouvir áudio sem marcar como ouvido;
  desativar chamadas no WhatsApp Web. Tudo reversível: desligar devolve a função original.
- **Anti-apagar** — guarda as mensagens recebidas (texto e mídias pequenas, limite configurável) e,
  quando o remetente apaga, lista em "Removidas" para ver, copiar, baixar ou devolver ao campo de texto.
- **Modelos** — texto, mídia/arquivo, cartão de contato, localização, enquete, chave PIX e evento.
  Variáveis `${contactName}` `${contactNameFirst}` `${contactNameLast}` `${waName}` `${waNameFirst}`
  `${waNameLast}` `${phone}` `${groupName}` `${date}` `${time}` `${messageContent}` e `${1}`…`${N}`
  (colunas da planilha: `${1}` é o número, `${2}` a 2ª coluna...). Variações (spintax):
  `{Oi|Olá|E aí}`, inclusive aninhadas. Respostas rápidas: digite `/` no campo de mensagem.
- **Transmissões** — destinatários por contatos, grupos (ou os membros), etiquetas, listas de
  transmissão, países (DDI), planilha CSV/XLSX (1ª coluna = número, com opção de prefixar o DDI) e
  números colados; conferência se o número tem WhatsApp; intervalo aleatório; horário de
  funcionamento por dia da semana; agendamento; repetição (diária, semanal, a cada X horas, N vezes);
  pausar/retomar/parar; progresso; etiquetar, arquivar, bloquear e disparar webhooks depois do envio.
- **Automações** — gatilhos por palavra-chave (separadas por vírgula, `*` = qualquer, opção de
  frase exata), anexo, localização, chamada recebida, entrada e saída de grupo; filtros (ignorar
  grupos/contatos/não contatos, não responder com a conversa aberta, dias, horário, etiquetas,
  países, conversas específicas, intervalo mínimo por conversa); ações (responder com modelos,
  atraso, "digitando…", citar, etiquetar/remover etiqueta, lida/não lida, arquivar, bloquear,
  adicionar/remover de grupos, favoritar, webhook).
- **Modo offline** — um botão que pausa transmissões, automações e webhooks.
- **IA com Google Gemini (opcional)** — na aba **IA** do painel você coloca a SUA chave de API do
  Gemini (grátis em aistudio.google.com/apikey), escolhe o modelo e escreve instruções. Com ela:
  automações podem **responder com IA** (usando as últimas 20 mensagens da conversa), há um botão
  para **sugerir resposta** no campo de mensagem e botões para **traduzir** mensagens e
  **transcrever** áudios. A chave fica só neste navegador, não entra no backup, e o navegador pede
  permissão para acessar `generativelanguage.googleapis.com`. Sem chave, nada disso é usado.
- Comparação completa com a extensão de referência: `FUNCOES.md`.
- **Webhooks de saída** — URL, método, cabeçalhos e corpo JSON com os campos `event` `m_id`
  `m_type` `m_datetime` `m_timestamp` `m_user` `m_phone` `m_content` `m_text` `m_cname` `m_uname`
  `m_gname` `m_gid` `m_platform` `w_id` `c_labels` `c_image` `c_location`: use o nome do campo
  como valor (`"telefone": "m_phone"`, mantém o tipo) ou `{{m_phone}}` dentro de um texto;
  fila com novas tentativas (30 s, 1 min, 2 min… até 6 vezes); a resposta (texto puro, ou JSON
  lido num caminho como `data.message`, mais um arquivo opcional por URL) pode virar resposta na conversa. A permissão para cada domínio é pedida na hora
  (permissões opcionais do navegador) — nenhum domínio externo vem liberado.
- **Ferramentas** — gerador de link wa.me; nova conversa com número não salvo (**Ctrl+Alt+S**);
  criar e clonar grupo; exportar contatos, conversas, grupos, membros, etiquetas e mensagens por
  período em CSV ou XLSX; salvar contato; botões extras no topo da conversa (lida/não lida,
  fixar, etiqueta rápida, salvar contato, enviar modelo, nova tarefa).
- **Tarefas e lembretes** por conversa (título, descrição, prioridade, vencimento, aviso).
- **Monitorar** — aviso quando contatos escolhidos ficam online ou começam a digitar.
- **Backup** em JSON (exportar/importar), **estatísticas** simples e **imagem de fundo** da
  conversa (até 2 MB).
- Tema claro/escuro (ou automático, seguindo o WhatsApp Web) e 6 idiomas: português (padrão), inglês,
  espanhol, árabe, russo e turco.
- **Webhook de entrada sem servidor**: a extensão consulta uma URL sua e envia as mensagens que ela devolver.
- Biblioteca do WhatsApp: @wppconnect/wa-js **4.x** (a 3.x deixava mensagens presas no relógio).

## Arquitetura

```
src/
  background/  service worker: clique no ícone foca/abre web.whatsapp.com e manda WW_OPEN_PANEL;
               recarrega a aba do WhatsApp ao instalar/atualizar; faz o fetch dos webhooks
               (só para domínios que você autorizou).
  content/     content script (document_end): painel em Shadow DOM, estado em chrome.storage.local,
               motores (transmissões, automações, webhooks, anti-apagar, lembretes) e injeção dos
               scripts da página.
  page/        roda no contexto da página: wa-config.js (configura o wa-js antes de carregar),
               depois vendor/wppconnect-wa.js e page.js (métodos e eventos sobre o global WPP).
  grant/       página que pede a permissão de host de um webhook (precisa de um clique).
  shared/      tipos, textos (i18n), armazenamento e regras puras testadas (variáveis, spintax,
               números/planilhas, filtros de automação, agendador, payload de webhook).
  preview/     pré-visualização do painel com dados falsos (sem WhatsApp, sem rede).
```

Comunicação content ↔ página: `CustomEvent`s `wabawebe:req` / `wabawebe:res` (com id de
requisição e Promise) e `wabawebe:evt` para eventos (`message`, `revoke`, `call`, `group`,
`presence`, `activeChat`, `ready`).

Permissões: `storage`, `unlimitedStorage`, acesso a `web.whatsapp.com` e, opcionalmente, aos
domínios dos webhooks que você cadastrar e ao Gemini (`generativelanguage.googleapis.com`, só se
você usar a IA). `web_accessible_resources` lista só os três scripts injetados. Não há `identity`
nem coleta de dados; o único endereço externo fixo é o da API do Gemini, usado apenas com a sua
chave e quando você pede.

Detalhes de como cada recurso de privacidade funciona por dentro estão em `MECHANICS.md`.

## Limitações conhecidas

- Os desfoques e os botões no cabeçalho usam seletores da página do WhatsApp Web, que mudam de
  tempos em tempos; podem precisar de ajuste.
- O anti-apagar só recupera mensagens recebidas enquanto o WhatsApp Web estava aberto com a
  extensão ativa.
- Etiquetas existem só em contas do WhatsApp Business.
- No filtro de países, códigos compartilhados (como +1 para EUA/Canadá) valem para todos os países
  com esse código.

## Licença

MIT — veja `LICENSE`. Componentes de terceiros em `THIRD_PARTY_NOTICES.md`.
