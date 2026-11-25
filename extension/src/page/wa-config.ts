// Roda no contexto da página ANTES do wa-js: configura a biblioteca para não falar com ninguém de fora.
// (Não interceptamos o fetch do WhatsApp: qualquer camada no caminho de rede dele é um risco
// para o envio de mensagens. A própria configuração abaixo já desliga as chamadas externas.)

export {};

type AnyWin = Window & { WPPConfig?: Record<string, unknown> };
const w = window as AnyWin;

w.WPPConfig = {
  deviceName: false,
  disableGoogleAnalytics: true,
  googleAnalyticsId: null,
  googleAnalyticsUserProperty: {},
  // lista vazia (e não null): com null a biblioteca usa servidores de prévia de link de terceiros
  linkPreviewApiServers: [],
  poweredBy: null,
  sendStatusToDevice: false,
  // true (padrão do wa-js): com false a biblioteca descarta os status dos contatos
  syncAllStatus: true,
};
