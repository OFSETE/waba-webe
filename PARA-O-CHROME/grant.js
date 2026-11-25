"use strict";
(() => {
  // src/grant/index.ts
  var params = new URLSearchParams(location.search);
  var origin = params.get("origin") ?? "";
  var en = (chrome.i18n.getUILanguage() || "").toLowerCase().startsWith("en");
  var txt = en ? { title: "Allow webhook access", body: "WABA WEBE will only send the webhooks you configured to:", allow: "Allow", deny: "Not now", ok: "Permission granted. You can close this window.", fail: "Permission not granted." } : { title: "Permitir acesso do webhook", body: "O WABA WEBE só enviará para este endereço os webhooks que você configurou:", allow: "Permitir", deny: "Agora não", ok: "Permissão concedida. Pode fechar esta janela.", fail: "Permissão não concedida." };
  var $ = (id) => document.getElementById(id);
  $("title").textContent = txt.title;
  $("body").textContent = txt.body;
  $("origin").textContent = origin;
  $("allow").textContent = txt.allow;
  $("deny").textContent = txt.deny;
  var valid = false;
  try {
    const u = new URL(origin);
    valid = (u.protocol === "https:" || u.protocol === "http:") && u.origin === origin;
  } catch {
    valid = false;
  }
  $("allow").disabled = !valid;
  $("allow").addEventListener("click", async () => {
    const ok = await chrome.permissions.request({ origins: [`${origin}/*`] });
    $("result").textContent = ok ? txt.ok : txt.fail;
    if (ok) setTimeout(() => window.close(), 1200);
  });
  $("deny").addEventListener("click", () => window.close());
})();
