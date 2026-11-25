"use strict";
(() => {
  // src/shared/ai.ts
  var GEMINI_ORIGIN = "https://generativelanguage.googleapis.com";
  var DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
  function defaultAiSettings() {
    return {
      apiKey: "",
      model: DEFAULT_GEMINI_MODEL,
      instructions: "",
      translateTo: "português do Brasil",
      temperature: 0.7
    };
  }
  function modelPath(model) {
    const m = (model || DEFAULT_GEMINI_MODEL).trim().replace(/^models\//, "");
    return `${GEMINI_ORIGIN}/v1beta/models/${encodeURIComponent(m)}:generateContent`;
  }
  function parseGeminiResponse(json) {
    const j = json;
    if (j?.error) return { ok: false, error: j.error.message || "gemini_error" };
    if (j?.promptFeedback?.blockReason) return { ok: false, error: `blocked: ${j.promptFeedback.blockReason}` };
    const parts = j?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("").trim();
    if (!text) return { ok: false, error: j?.candidates?.[0]?.finishReason ? `empty: ${j.candidates[0].finishReason}` : "empty" };
    return { ok: true, text };
  }

  // src/shared/protocol.ts
  var MSG_OPEN_PANEL = "WW_OPEN_PANEL";
  var MSG_WEBHOOK_FETCH = "WW_WEBHOOK_FETCH";
  var MSG_HAS_PERMISSION = "WW_HAS_PERMISSION";
  var MSG_REQUEST_PERMISSION = "WW_REQUEST_PERMISSION";
  var MSG_FETCH_FILE = "WW_FETCH_FILE";
  var MSG_AI_GENERATE = "WW_AI_GENERATE";
  var MSG_AI_MODELS = "WW_AI_MODELS";

  // src/background/index.ts
  var WA_URL = "https://web.whatsapp.com/";
  var WA_MATCH = "*://web.whatsapp.com/*";
  var FETCH_TIMEOUT_MS = 2e4;
  var MAX_BODY_CHARS = 65536;
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason !== "install" && details.reason !== "update") return;
    const tabs = await chrome.tabs.query({ url: WA_MATCH });
    for (const tab of tabs) if (tab.id !== void 0) chrome.tabs.reload(tab.id);
  });
  async function sendOpenPanel(tabId, tries = 10) {
    for (let i = 0; i < tries; i++) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: MSG_OPEN_PANEL });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 700));
      }
    }
  }
  chrome.action.onClicked.addListener(async (current) => {
    let tabs = await chrome.tabs.query({ url: WA_MATCH, windowId: current.windowId });
    if (!tabs.length) tabs = await chrome.tabs.query({ url: WA_MATCH });
    const tab = tabs[0];
    if (tab?.id !== void 0) {
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId !== void 0) await chrome.windows.update(tab.windowId, { focused: true });
      await sendOpenPanel(tab.id);
      return;
    }
    const created = await chrome.tabs.create({ url: WA_URL });
    if (created.id !== void 0) {
      const id = created.id;
      const listener = (tabId, info) => {
        if (tabId === id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          void sendOpenPanel(id, 20);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    }
  });
  function originPattern(origin) {
    return `${origin}/*`;
  }
  async function hasPermission(origin) {
    try {
      return await chrome.permissions.contains({ origins: [originPattern(origin)] });
    } catch {
      return false;
    }
  }
  async function doFetch(req) {
    let origin;
    try {
      const u = new URL(req.url);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad_protocol");
      origin = u.origin;
    } catch {
      return { ok: false, status: 0, contentType: "", body: "", error: "invalid_url" };
    }
    if (!await hasPermission(origin)) return { ok: false, status: 0, contentType: "", body: "", error: "no_permission" };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const method = req.method.toUpperCase();
      const res = await fetch(req.url, {
        method,
        headers: req.headers,
        body: method === "GET" ? void 0 : req.body,
        signal: ctrl.signal,
        credentials: "omit",
        redirect: "follow"
      });
      const text = (await res.text()).slice(0, MAX_BODY_CHARS);
      return { ok: res.ok, status: res.status, contentType: res.headers.get("content-type") ?? "", body: text };
    } catch (e) {
      return { ok: false, status: 0, contentType: "", body: "", error: e instanceof Error ? e.message : String(e) };
    } finally {
      clearTimeout(timer);
    }
  }
  async function aiSettings() {
    const raw = await chrome.storage.local.get("ww.settings");
    const s = raw["ww.settings"] ?? {};
    return { ...defaultAiSettings(), ...s.ai ?? {} };
  }
  async function geminiFetch(url, init, key) {
    if (!await hasPermission(GEMINI_ORIGIN)) throw new Error("no_permission");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9e4);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key, ...init.headers ?? {} },
        credentials: "omit",
        signal: ctrl.signal
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, json, status: res.status };
    } finally {
      clearTimeout(timer);
    }
  }
  async function aiGenerate(request) {
    try {
      const ai = await aiSettings();
      if (!ai.apiKey.trim()) return { ok: false, error: "no_key" };
      const r = await geminiFetch(modelPath(ai.model), { method: "POST", body: JSON.stringify(request) }, ai.apiKey.trim());
      const parsed = parseGeminiResponse(r.json);
      return parsed.ok ? { ok: true, text: parsed.text } : { ok: false, error: parsed.error || `HTTP ${r.status}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  async function aiModels() {
    try {
      const ai = await aiSettings();
      if (!ai.apiKey.trim()) return { ok: false, error: "no_key" };
      const r = await geminiFetch(`${GEMINI_ORIGIN}/v1beta/models?pageSize=200`, { method: "GET" }, ai.apiKey.trim());
      const j = r.json;
      if (!r.ok) return { ok: false, error: j?.error?.message || `HTTP ${r.status}` };
      const models = (j.models ?? []).filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m) => m.name.replace(/^models\//, "")).filter((n) => n.startsWith("gemini"));
      return { ok: true, models };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  var MAX_FILE_BYTES = 16 * 1024 * 1024;
  async function fetchFile(url) {
    const fail = (error) => ({ ok: false, dataUrl: "", mime: "", name: "", size: 0, error });
    let u;
    try {
      u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") return fail("bad_protocol");
    } catch {
      return fail("invalid_url");
    }
    if (!await hasPermission(u.origin)) return fail("no_permission");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS * 3);
    try {
      const res = await fetch(url, { signal: ctrl.signal, credentials: "omit" });
      if (!res.ok) return fail(`HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > MAX_FILE_BYTES) return fail("too_big");
      let bin = "";
      for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
      const mime = (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
      const name = decodeURIComponent(u.pathname.split("/").pop() || "arquivo");
      return { ok: true, dataUrl: `data:${mime};base64,${btoa(bin)}`, mime, name, size: buf.byteLength };
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
  }
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === MSG_WEBHOOK_FETCH) {
      doFetch(msg).then(sendResponse);
      return true;
    }
    if (msg?.type === MSG_AI_GENERATE) {
      aiGenerate(msg.request).then(sendResponse);
      return true;
    }
    if (msg?.type === MSG_AI_MODELS) {
      aiModels().then(sendResponse);
      return true;
    }
    if (msg?.type === MSG_FETCH_FILE && typeof msg.url === "string") {
      fetchFile(msg.url).then(sendResponse);
      return true;
    }
    if (msg?.type === MSG_HAS_PERMISSION && msg.origin) {
      hasPermission(msg.origin).then(sendResponse);
      return true;
    }
    if (msg?.type === MSG_REQUEST_PERMISSION && msg.origin) {
      const url = chrome.runtime.getURL(`grant.html?origin=${encodeURIComponent(msg.origin)}`);
      chrome.windows.create({ url, type: "popup", width: 460, height: 340 }).then(() => sendResponse(true));
      return true;
    }
    return false;
  });
})();
