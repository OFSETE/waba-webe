# Funções: extensão de referência × WABA WEBE

Levantamento feito no código e nos textos da extensão de referência (v5.2.9), item por item.
✅ = tem · 🤖 = tem, usando IA (Google Gemini com a sua chave) · ➖ = a referência não tem de verdade (explicação ao lado).

## Onde fica
| Função | WABA WEBE |
| --- | --- |
| Ícone na barra de ferramentas lateral do WhatsApp Web (pisca enquanto uma transmissão envia) | ✅ (se a barra não existir, aparece um botão flutuante) |
| Ícone na barra do navegador abre/foca o WhatsApp Web e o painel | ✅ |
| Idiomas: português, inglês, espanhol, árabe, russo e turco | ✅ |

## Privacidade (Alt+P liga/desliga tudo)
| Função | WABA WEBE |
| --- | --- |
| Desfocar nomes, fotos, prévias, mensagens da conversa e campo de digitação | ✅ |
| Modo invisível, esconder "digitando"/"gravando", sem confirmação de leitura | ✅ |
| Ver status sem avisar, ouvir áudio sem marcar como ouvido, desativar chamadas no Web | ✅ |
| Recuperar mensagens apagadas (lista + botão "Restaurar" na própria mensagem, com download da mídia) | ✅ |

## Personalizações (Alt+C)
| Função | WABA WEBE |
| --- | --- |
| Impedir que a lista de conversas "pule" ao enviar | ✅ |
| Avisar quando qualquer contato fica online/offline ou digita/grava | ✅ (e também só para contatos escolhidos) |
| Imagem de fundo da conversa (até 2 MB) | ✅ |
| Fixar conversas sem o limite de 3 (só neste navegador) | ✅ |

## Botões extras (Alt+B)
| Função | WABA WEBE |
| --- | --- |
| 👍, fixar, nova conversa, lida/não lida, salvar contato, informações da conversa, tarefa | ✅ |
| Respostas rápidas (botões acima do campo + lista com "/") | ✅ |
| Baixar status | ✅ |
| Traduzir mensagem | 🤖 (a referência usava o tradutor do Google) |
| Transcrever áudio | 🤖 (a referência usava um servidor dela) |
| Etiqueta rápida, enviar modelo, executar automação na conversa | ✅ |
| Sugerir resposta | 🤖 (novo) |

## Modelos de mensagem
| Função | WABA WEBE |
| --- | --- |
| Texto, mídia, documentos, cartão de contato, enquete, localização, PIX, evento | ✅ |
| Lista de opções | ✅ |
| Chamada agendada (o "evento" da referência) | ✅ |
| Imagem dinâmica (URL com variáveis, inclusive a foto de perfil) | ✅ |
| Prévia de link | ✅ (montada no seu navegador, sem servidores de terceiros) |
| Variáveis, colunas da planilha e variações {a\|b} | ✅ |
| Áudio como voz, visualização única, marcar todos do grupo (em silêncio ou com @todos) | ✅ |

## Transmissões
| Função | WABA WEBE |
| --- | --- |
| Contatos salvos / salvos que conversaram / não salvos que conversaram | ✅ |
| Grupos (ou membros), etiquetas, listas de transmissão, países, planilha, números colados | ✅ |
| Conferir números, remover repetidos, intervalo aleatório, horário, agendamento, repetição (dias/semanas/meses) | ✅ |
| Pausar/parar/retomar, progresso, medidor de risco | ✅ |
| Depois do envio: etiquetar, arquivar, bloquear, webhooks | ✅ |
| Aviso anti-spam com aceite | ✅ |

## Automações
| Função | WABA WEBE |
| --- | --- |
| Gatilhos: palavra-chave, mensagem que eu envio, anexo, localização, pedido, status, anúncio do Facebook, chamada, entrar/sair do grupo | ✅ |
| Filtros: grupos, contatos, não contatos, conversa aberta, dias, horário, etiquetas, países, conversas | ✅ |
| Responder com modelos, atraso, digitando, citar, no privado | ✅ |
| Responder com agente de IA (na referência: bloqueado atrás de outro produto pago) | 🤖 Gemini |
| Reagir, favoritar, fixar mensagem, fixar/silenciar/reativar som/apagar/arquivar conversa, lida/não lida, bloquear | ✅ |
| Etiquetar/remover, grupos, salvar contato com prefixo, avisar outras conversas, webhooks | ✅ |
| Executar manualmente; modo offline | ✅ |

## Webhooks
| Função | WABA WEBE |
| --- | --- |
| Saída: corpo personalizado com campos, resposta virando mensagem (texto e arquivo) | ✅ (com novas tentativas) |
| Entrada: mandar mensagens a partir de outro sistema | ✅ sem servidor nosso: a extensão consulta uma URL sua (a referência usava um servidor dela) |

## Ferramentas, dados e estatísticas
| Função | WABA WEBE |
| --- | --- |
| Link wa.me, nova conversa (Ctrl+Alt+S), criar/clonar grupo, salvar contato | ✅ |
| Exportar contatos, conversas, grupos, membros, listas de transmissão, etiquetas, mensagens (de uma conversa ou de todas, por período e país) em CSV, XLSX ou TXT | ✅ |
| Exportar/importar dados escolhendo o que entra (backup) | ✅ |
| Estatísticas: contatos, grupos, conversas, canais, etiquetas, chamadas, produtos, mensagens apagadas, mensagens e chamadas por tipo | ✅ |
| Tarefas com prioridade (urgente/alta/normal/baixa), vencimento, "vence em breve" e aviso | ✅ |

## O que a referência mostra mas não faz (por isso não entrou)
| Item | Situação |
| --- | --- |
| Tela de bloqueio | ➖ a própria referência marca como "obsoleta" e não tem código para ela |
| "Salvar no Zoho CRM" | ➖ só sobrou o texto; não há código de Zoho na referência. Dá para mandar contatos ao seu CRM pelos webhooks |
| Seguir canal / avaliar / programa de afiliados / pesquisa / planos e licença | ➖ divulgação e cobrança da empresa da referência; o WABA WEBE é grátis e sem conta |
