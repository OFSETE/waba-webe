"use strict";
(() => {
  // src/page/wa-config.ts
  var w = window;
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
    syncAllStatus: true
  };
})();
