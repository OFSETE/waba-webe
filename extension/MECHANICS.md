# Mecânica da extensão de referência e como o WABA WEBE a segue

## Como foi lido

A extensão de referência **não tem programa nativo**. O inventário completo da pasta
(`core_archive_show`, evidência `ev_bb0682a2…`) tem 29 arquivos: 4 JavaScript, 16 JSON, 1 CSS,
3 PNG, 1 SVG e 4 "binários" que são só a fonte de ícones Material Design (`.eot/.ttf/.woff/.woff2`).
As duas partes principais são JavaScript minificado — `app.min.js` (roda na página do WhatsApp Web)
e `bootstrap.min.js` (o painel). `core_target_open` abre os dois como "script", e
`native_strings_find` / `native_function_pseudocode` recusam ("not native machine code"): não há
funções de máquina para descompilar. Por isso a leitura foi
feita com as ferramentas de JavaScript (`js_app_map`, evidência `ev_7f135d5a…`; `js_function_explain`,
evidência `ev_c0cfa75a…`) e com a leitura direta do código nos deslocamentos abaixo.

**"Endereço" aqui = deslocamento de byte no arquivo** (`app.min.js @0x…` ou `bootstrap.min.js @0x…`).
Nenhum código foi copiado: as regras foram reescritas.

## Variáveis e spintax — `app.min.js @0x903a3` (ação `sendMsg`)

| Regra | Referência | WABA WEBE (`src/shared/variables.ts`) |
| --- | --- | --- |
| `${contactNameFirst}` | `nome.split(" ")[0]` | igual |
| `${contactNameLast}` / `${waNameLast}` | `nome.split(" ")[1]` — **a 2ª palavra**, não a última | igual ("Maria Clara Souza" → "Clara") |
| `${date}` | `new Date().toLocaleDateString()` | dd/mm/aaaa (pt-BR), mm/dd/aaaa (en) |
| `${time}` | `toLocaleTimeString()` (com segundos) | `HH:MM:SS` (pt-BR), `h:MM:SS AM/PM` (en) |
| `${1}`…`${N}` | colunas da linha da planilha, `${t+1}` = coluna t; não usadas → removidas | igual (`${1}` = número) |
| Texto final | `trim()` | igual |
| Spintax | regex `/{([^{}]+?)}/` repetida; sorteio `⌊random × n⌋`; **qualquer** `{x}` perde as chaves | igual (variáveis `${…}` protegidas) |
| Ordem | variáveis primeiro, depois spintax | spintax primeiro, depois variáveis (*diferença proposital*: o conteúdo de uma variável, como a mensagem recebida, nunca é sorteado) |
| Substituição | `replace` com texto troca só a **1ª** ocorrência | todas as ocorrências (*diferença proposital*) |

## Envio — `app.min.js @0x903a3`

- Número limpo de espaços, `+`, `(`, `)`, `-` e conferido com `WPP.contact.queryExists`; sem
  WhatsApp → destinatário marcado como inválido (`markTargetInvalid`). Igual no WABA WEBE quando
  "Conferir números" está ligado.
- Grupo com `mention` → `mentionedList` = todos os participantes (menção silenciosa). WABA WEBE:
  opção "Marcar todos os membros ao enviar no grupo" na transmissão (`src/page/index.ts`).
- Prévia de link só quando pedida. WABA WEBE: sempre desligada (`linkPreview: false`).

## Menção a todos por palavra — `app.min.js @0x93663` (evento `MsgStore add`)

Mensagem **minha** num grupo contendo `@everyone @all @here @الجميع @الكل @todos @tous @כולם @herkes`
→ envia `"@"` com `mentionedList` = todos. WABA WEBE: mesma lista (`MENTION_ALL_TOKENS`), ligada por
padrão, desligável em Ferramentas.

## Privacidade — `app.min.js` (handler `fromAngular`)

| Recurso | Referência | WABA WEBE (`src/page/privacy.ts`) |
| --- | --- | --- |
| Invisível | `ChatPresence.sendPresenceAvailable` → no-op e `sendPresenceUnavailable()` a cada **1000 ms** (@0x91a4d) | troca igual; reafirma a cada **5000 ms** (*diferença proposital*: menos tráfego) |
| Sem confirmação de leitura | `sendConversationSeen` → resolve após **100 ms** (@0x91b3b) | resolve na hora |
| Esconder digitando / gravando | `WAWebChatStateBridge.sendChatStateComposing` / `…Recording` → no-op (@0x92022 / @0x92173) | igual |
| Ver status sem avisar | `StatusV3Model.prototype.sendReadStatus` → no-op (@0x918e7) | igual |
| Ouvir áudio sem marcar | `markPlayed` → no-op (@0x924a0) | igual |
| Desativar chamadas | `WAWebABProps.getABPropConfigValue` → `false` para 6 chaves + `isCallingEnabled` → `false` (@0x91d71) | igual, mesmas chaves: `enable_web_calling`, `enable_web_group_calling`, `web_voip_call_tab_new_call`, `enable_wds_calling_dropdown`, `enable_web_calling_nux`, `enable_web_calling_beta_upsell` |

## Anti-apagar — `app.min.js @0x93663`, `bootstrap.min.js @0x1b392`

- Guarda o conteúdo das mensagens recebidas (texto, localização, mídia baixada em base64, tipo,
  mime, nome do arquivo). Referência: mídia **sem limite**, só em memória. WABA WEBE: até **16 MB**
  por arquivo (ajustável) e até 40 MB somados no cache salvo (*diferença*: o nosso sobrevive a recarregar a página).
- Revogação só conta para conversas `c.us`, `g.us` e `lid` e nunca para mensagens minhas. Igual.
- "Removidas": no máximo **500** itens e **50 MB** (52 428 800 caracteres) — corta os mais antigos
  10% por vez. Igual (`trimDeleted`).

## Automações — `bootstrap.min.js @0x1cba3` (avaliação) e `@0x1dc08` (execução)

- Palavra-chave: `texto.trim().toLowerCase()` contém (ou, em "exata", é igual a) a palavra-chave
  aparada e em minúsculas; **acentos contam**; `*` = qualquer mensagem. Igual (`matchKeywords`).
- Chamada: tipos `personal_audio`, `personal_video`, `group_audio`, `group_video` (`app.min.js`,
  `call.incoming_call`). Igual (`callTypeOf`).
- Entrada/saída de grupo só para grupos escolhidos. WABA WEBE: "Somente estas conversas".
- Filtro de horário `ce(de, até)`: `de < agora < até`, no mesmo dia (@0x21708). WABA WEBE: aceita
  também janelas que atravessam a meia-noite (*extensão*).
- Filtro de país: número do remetente começa com o DDI. Igual (prefixo mais longo).
- Responder no privado (`replyPrivately`): em grupo, a resposta vai para quem mandou. Igual.
- "Digitando": dura o atraso configurado, ou **3000 ms** sem atraso (`app.min.js @0x92a9f`,
  `delay || 3e3`), e corre **junto** com a espera. Igual (`TYPING_DEFAULT_MS`).
- Só o **1º** modelo cita a mensagem recebida. Igual.
- Bloquear e adicionar/remover de grupos agem sobre o **remetente** em mensagens de grupo. Igual.
- Arquivar espera **1000 ms** (`app.min.js @0x90ac4`); lida/não lida espera **2000 ms**
  (`@0x1dc08`). Igual (`ARCHIVE_DELAY_MS`, `MARK_DELAY_MS`).
- Padrões de uma automação nova: gatilho palavra-chave, enviar mensagens, ativa; todo o resto
  desligado (`const xe` @0x13ef3). Igual (sem atraso, sem "digitando", sem ignorar grupos,
  intervalo por conversa 0).
- "Disparar manualmente" na conversa aberta, ignorando gatilho e filtros (@0x155f0). Igual
  (botão ▶ na lista de automações).

## Transmissões — `bootstrap.min.js @0xefc9` (padrões), `@0xf776` (validação), `@0x11f80` (laço)

- Padrões: intervalo **15 a 30 s**, horário **09:00–17:00**, repetir **3** vezes a cada **dia**,
  remover repetidos. Igual (`DEFAULT_INTERVAL_FROM/TO`).
- Validação: de > 0, até > 0 e de < até. Igual (`validInterval`).
- Atraso: `1000 × (⌊random × (até − de + 1)⌋ + de)` — segundos inteiros, aplicado **antes** de cada
  envio, inclusive o primeiro. Igual (`randomDelayMs`; o primeiro envio também espera).
- "Todos os modelos": **2000 ms** entre um modelo e outro; "aleatório": `⌊random × n⌋`. Igual.
- Repetição: dias = 86 400 000 ms, semanas = 604 800 000 ms, meses = **30 dias** (2 592 000 000 ms)
  (@0x108ab). Igual (`monthly`); "a cada X horas" é extensão nossa.
- Agendadas verificadas a cada **30 s** (`checkScheduledBroadcastings`, @0x1336e); uma transmissão
  por vez. WABA WEBE: um envio por vez, verificação a cada 2 s.
- Fora do horário de funcionamento a referência **para** a campanha. WABA WEBE **espera** a janela
  abrir (*diferença proposital*: não perde a campanha).

## Webhooks — `app.min.js @0x90ac4`, `@0x8e970`; `bootstrap.min.js @0x1b884`, `@0x155f0`

- Campos: `m_id`, `m_type`, `m_datetime` (`new Date(t×1000).toString()`), `m_timestamp` (segundos),
  `m_user` (lid), `m_phone`, `m_content`, `m_text`, `m_cname`, `m_uname`, `m_gname`, `m_gid`,
  `m_platform`, `w_id`, `c_labels` (lista de nomes), `c_image`, `c_location`. Igual (`c_image` fica
  vazio: não lemos a foto de perfil).
- Corpo personalizado: um JSON em que valores iguais a um nome de campo (`"telefone": "m_phone"`) são
  trocados pelo valor real, em qualquer profundidade e mantendo o tipo (função `i` @0x8e970).
  Igual (`substituteFieldNames`), e também aceitamos `{{m_phone}}` dentro de textos.
  Sem corpo personalizado → objeto inteiro. Igual (`DEFAULT_PAYLOAD`).
- Método padrão POST. Igual.
- Resposta → mensagem: texto no caminho `contentParam` e arquivo pela URL em `attachmentParam`.
  Igual (`replyPath`, `attachmentPath`).
- A referência entrega por um servidor dela e **não repete**. WABA WEBE entrega direto do navegador
  (com permissão por domínio) e repete 30 s × 2^(n−1), até 1 h, no máximo **6** vezes (pedido do projeto).
- Modo offline bloqueia webhooks. Igual.

## Atalhos e padrões das opções — `bootstrap.min.js @0x17a80`, `@0x1200`, `e.toggleAll`

- Atalhos (evento `keyup`): **Ctrl+Alt+S** = nova conversa; **Alt+P** = liga/desliga todas as opções
  de privacidade; **Alt+B** = liga/desliga todos os botões extras (Alt+C, "personalizações", não
  tem equivalente aqui); **Esc** fecha o painel. Igual (`src/content/boot.ts`).
- `toggleAll`: se todas as opções do grupo estão ligadas, desliga todas; senão, liga todas. Igual
  (`toggleAll` em `src/shared/automation.ts`).
- Padrões: **todas** as opções de privacidade, o anti-apagar (`restoreDeletedMessages`) e **todos**
  os botões extras começam **desligados**. Igual.

## Respostas rápidas — `bootstrap.min.js @0x9bcf`

- Barra de botões no topo do rodapé da conversa (`#main footer`), um por modelo marcado como
  resposta rápida; os que não cabem vão para "Mais", com busca. Clicar **envia** o modelo na conversa
  aberta e destaca o botão por **2000 ms**. Igual (`QuickReplyBar`).
- Lista ao digitar `/` no campo de mensagem: extensão nossa (pedida no projeto), ligada pela mesma opção.

## IA — `bootstrap.min.js @0x35900` (opção de agente), `app.min.js` (evento `newMsg`), `bootstrap.min.js @0x17df5`

- A referência tem "Responder usando agente ChatGPT" nas automações (desativada atrás de outro
  produto pago) e envia, a cada mensagem nova, as **últimas 20** mensagens de texto da conversa como
  `{role: "assistant"|"user", content}` (minhas = assistant). Com o agente ligado, a lista de modelos
  some: a IA responde no lugar deles. WABA WEBE: mesma regra com o **Gemini** e a chave do usuário
  (`AI_HISTORY_MESSAGES = 20`; minhas = `model`, do contato = `user`).
- Botões "Traduzir" (referência: tradutor do Google sem chave) e "Transcrever" (referência: áudio
  enviado ao servidor dela) aparecem ao passar o mouse na mensagem. WABA WEBE: os dois pelo Gemini.
- Reagir à mensagem espera **5000 ms** (`bootstrap.min.js @0x1dc08`, `ee(5e3)`). Igual.
- Salvar contato pela automação: prefixo + 1ª palavra do nome do WhatsApp; o resto vira sobrenome
  (`@0x1cba3`). Igual.
- Gatilhos extras: "compose" (palavra-chave em mensagem **minha**; age sobre quem recebeu), "status"
  (contato publica status; responde no privado dele) e "order" (pedido). Igual.

## Biblioteca do WhatsApp e o "reloginho" (mensagens presas)

- A biblioteca da referência é um wa-js recente (tem o código de listas/"native flow" com
  sender-key em `app.min.js`). O WABA WEBE estava com o **wa-js 3.23.4** (a última da série 3),
  que embrulha funções do envio do WhatsApp (`createMsgProtobuf`, `createFanoutMsgStanza`,
  `encryptAndSendMsg`, `getABPropConfigValue` → `web_unwrap_message_for_stanza_attributes` = false)
  de um jeito feito para um WhatsApp Web mais antigo → mensagens enviadas ficavam no relógio.
  Agora: **wa-js 4.8.2** (atual) e o carregador `WPP.loader` (o antigo `WPP.webpack` sumiu na v4).
- `syncAllStatus` voltou ao padrão (`true`): com `false` a biblioteca descarta os status dos contatos.
- Não interceptamos mais o `fetch` do WhatsApp (a configuração já desliga as chamadas externas).
- Privacidade: com a opção desligada, nada do WhatsApp é procurado nem trocado (antes o bloqueio de
  chamadas trocava uma função mesmo desligado).
- Botões no topo da conversa só entram na página quando algum está ligado.

## Barra de ferramentas, personalizações e outros — `bootstrap.min.js`

- Ícone na barra lateral do WhatsApp: acrescentado ao bloco do primeiro `header hr` (`@0x84f`), pisca
  enquanto transmite (`wawp-blink`). Igual (`ToolbarButton`); sem barra, fica o botão flutuante.
- `pinnedChats`: fixar só no navegador, `chat.pin = chat.t` (sem o limite de 3) (`@0xb900`). Igual.
- "Lista não pula": guarda `#pane-side.scrollTop` ao enviar e devolve **100 ms** depois (`@0x1b2ef`). Igual.
- Avisos de qualquer contato: online/offline e digitando/gravando (`"onlineActivity"`). Igual.
- Tarefa "vence em breve" = nas próximas **24 h** (`taskDueStatus`, `864e5`). Igual.
- Baixar status: botão no visualizador de status (`statusItemClicked`). WABA WEBE: aparece quando há
  uma mídia grande aberta fora da lista e da conversa.
- Restaurar mensagem apagada na própria conversa (botão "restore-message-button"). Igual.
- Exportar mensagens de todas as conversas por período e país, com aviso de corte. WABA WEBE: até
  **20 000** mensagens. Formatos CSV, XLSX e TXT (`_e`, `$e`, `Ae`). Igual.
- Estatísticas: contatos, grupos, conversas, canais, etiquetas, chamadas, produtos, removidas
  (`AllContactsCounter`… `@0x11a6`). Igual, mais mensagens e chamadas por tipo.
- Modelos: tipos da referência incluem lista, imagem dinâmica (URL com variáveis e `${profilePicture}`)
  e "evento" = chamada agendada (`sendScheduledCallMessage`) (`@0xcf00`, `@0x1ef4c`). Igual.
- Origem dos contatos na transmissão: salvos / salvos que conversaram / não salvos que conversaram. Igual.
- Medidor de risco da transmissão: a referência tem o campo `riskLevel` (`@0xef84`), mas a fórmula não
  aparece no código lido; a do WABA WEBE é **estimada** (volume, intervalo e conferência de números).
- Webhook de entrada: a referência usa um servidor dela; o WABA WEBE consulta uma URL do usuário a
  cada N segundos (mínimo 10) e avisa o resultado numa segunda URL (opcional).
- Idiomas da referência: `["ar","en","es","pt","tr","ru"]` (`@0x84f`). Igual (+ pt-BR padrão).

## Outros

- Fundo da conversa: só imagens, até **2 097 152 bytes** (2 MB) (`bootstrap.min.js @0x758b`). Igual.
- Tarefas: prioridades **urgente `#d32f2f`, alta `#f57c00`, normal `#1e88e5` (padrão), baixa `#9e9e9e`**
  (`const j={priority:"normal"}`). Igual.
- Exportação: período padrão = últimos **30 dias** até hoje (@0x152f); XLSX com todas as células
  como texto, planilha "WhatsApp", compressão ligada (@0x22119). Igual.
- Avisos de presença: online quando `isOnline` vira verdadeiro; digitando/gravando quando o estado
  não é `available`/`unavailable` (`app.min.js`, `PresenceCollection`). Igual.
- wa-js: `linkPreviewApiServers: []` — com `null` a biblioteca usaria três servidores de prévia de
  link de terceiros (visto em `wppconnect-wa.js`); análise de uso desligada.
