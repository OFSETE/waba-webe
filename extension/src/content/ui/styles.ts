// CSS do painel (dentro do Shadow DOM, isolado do WhatsApp Web).

export const PANEL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.root {
  --bg: #ffffff; --bg2: #f3f8f7; --bg3: #e6f1ef; --fg: #13312e; --muted: #5d7a76; --line: #d5e5e2;
  --accent: #0f9488; --accent2: #0e7490; --accentFg: #ffffff; --danger: #d14343; --warn: #c27c0e; --ok: #1f9d55;
  --shadow: 0 12px 40px rgba(10, 40, 37, .22);
  font: 13.5px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--fg);
}
.root.dark {
  --bg: #121c1b; --bg2: #182625; --bg3: #20322f; --fg: #e2f1ee; --muted: #93b0ab; --line: #2b403d;
  --accent: #2cc2b3; --accent2: #38a3c4; --accentFg: #06201d; --shadow: 0 12px 40px rgba(0,0,0,.55);
}
.ico { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
.panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: 460px; max-width: 100vw; z-index: 2147483000;
  background: var(--bg); box-shadow: var(--shadow); display: flex; flex-direction: column;
  transform: translateX(105%); transition: transform .22s ease; border-left: 1px solid var(--line);
}
.panel.open { transform: none; }
.top { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--line); background: var(--bg2); }
.top .title { font-weight: 700; font-size: 15px; letter-spacing: .3px; }
.top .status { font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--warn); display: inline-block; }
.dot.on { background: var(--ok); }
.spacer { flex: 1; }
.body { flex: 1; display: flex; min-height: 0; }
.nav { width: 56px; border-right: 1px solid var(--line); background: var(--bg2); display: flex; flex-direction: column; padding: 6px 0; gap: 2px; overflow-y: auto; }
.nav button { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 7px 2px; color: var(--muted); font-size: 9.5px; text-align: center; border-left: 3px solid transparent; }
.nav button:hover { color: var(--fg); background: var(--bg3); }
.nav button.active { color: var(--accent); border-left-color: var(--accent); background: var(--bg3); font-weight: 600; }
.content { flex: 1; overflow-y: auto; padding: 14px 16px 40px; }
h2 { font-size: 17px; margin: 0 0 4px; }
h3 { font-size: 13.5px; margin: 18px 0 8px; color: var(--accent2); text-transform: uppercase; letter-spacing: .5px; }
.sub { color: var(--muted); font-size: 12.5px; margin: 0 0 12px; }
.hint { color: var(--muted); font-size: 11.5px; margin-top: 3px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.row > .grow { flex: 1; min-width: 0; }
.stack { display: flex; flex-direction: column; gap: 10px; }
.card { background: var(--bg2); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
.card + .card { margin-top: 10px; }
.list { display: flex; flex-direction: column; gap: 8px; }
.item { background: var(--bg2); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; gap: 10px; align-items: flex-start; }
.item .main { flex: 1; min-width: 0; }
.item .name { font-weight: 600; overflow-wrap: anywhere; }
.item .meta { color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.item .acts { display: flex; gap: 2px; flex-shrink: 0; }
.badge { display: inline-block; font-size: 10.5px; padding: 1px 7px; border-radius: 99px; background: var(--bg3); color: var(--muted); font-weight: 600; margin-left: 6px; vertical-align: 1px; }
.badge.ok { background: rgba(31,157,85,.15); color: var(--ok); }
.badge.warn { background: rgba(194,124,14,.15); color: var(--warn); }
.badge.bad { background: rgba(209,67,67,.15); color: var(--danger); }
.badge.acc { background: rgba(15,148,136,.15); color: var(--accent); }
.btn { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 13px; border-radius: 9px; font-weight: 600; font-size: 13px; background: var(--bg3); color: var(--fg); border: 1px solid var(--line); }
.btn:hover { filter: brightness(.97); }
.btn.primary { background: var(--accent); color: var(--accentFg); border-color: transparent; }
.btn.danger { color: var(--danger); }
.btn.ghost { background: transparent; border-color: transparent; padding: 6px; color: var(--muted); }
.btn.ghost:hover { color: var(--fg); background: var(--bg3); }
.btn[disabled] { opacity: .5; pointer-events: none; }
.btn.small { padding: 4px 9px; font-size: 12px; }
label.field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--fg); }
input[type=text], input[type=password], input[type=number], input[type=url], input[type=datetime-local], input[type=time], input[type=date], input[type=search], select, textarea {
  font: inherit; font-weight: 400; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; width: 100%; outline: none;
}
textarea { resize: vertical; min-height: 70px; font-family: inherit; }
textarea.code { font-family: ui-monospace, Consolas, monospace; font-size: 12px; min-height: 160px; }
input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(15,148,136,.18); }
input.num { width: 84px; }
.toggle { display: flex; align-items: center; gap: 10px; padding: 7px 0; cursor: pointer; font-weight: 500; }
.toggle input { display: none; }
.toggle .sw { width: 34px; height: 20px; border-radius: 99px; background: var(--line); position: relative; flex-shrink: 0; transition: background .15s; }
.toggle .sw::after { content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
.toggle input:checked + .sw { background: var(--accent); }
.toggle input:checked + .sw::after { left: 17px; }
.toggle .txt { flex: 1; }
.check { display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; font-weight: 400; }
.check input { accent-color: var(--accent); width: 15px; height: 15px; margin: 0; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; flex-wrap: wrap; }
.seg button { all: unset; cursor: pointer; padding: 6px 11px; font-size: 12.5px; color: var(--muted); }
.seg button.on { background: var(--accent); color: var(--accentFg); font-weight: 600; }
.picker { border: 1px solid var(--line); border-radius: 10px; background: var(--bg); }
.picker .ph { display: flex; gap: 6px; padding: 6px; border-bottom: 1px solid var(--line); align-items: center; }
.picker .pl { max-height: 190px; overflow-y: auto; padding: 4px 8px; }
.picker .pl .check small { color: var(--muted); margin-left: 4px; }
.picker .count { font-size: 11.5px; color: var(--muted); white-space: nowrap; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.stat { background: var(--bg2); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; }
.stat .v { font-size: 22px; font-weight: 700; color: var(--accent); }
.stat .l { font-size: 11.5px; color: var(--muted); }
.bars { display: flex; align-items: flex-end; gap: 6px; height: 90px; padding-top: 8px; }
.bars .b { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 10px; color: var(--muted); height: 100%; justify-content: flex-end; }
.bars .b i { display: block; width: 100%; background: linear-gradient(180deg, var(--accent), var(--accent2)); border-radius: 5px 5px 2px 2px; min-height: 2px; }
.progress { height: 7px; border-radius: 99px; background: var(--bg3); overflow: hidden; margin: 6px 0 2px; }
.progress i { display: block; height: 100%; background: var(--accent); }
.banner { border-radius: 10px; padding: 9px 11px; font-size: 12.5px; background: rgba(194,124,14,.12); color: var(--warn); border: 1px solid rgba(194,124,14,.3); margin-bottom: 12px; }
.banner.info { background: rgba(15,148,136,.1); color: var(--accent2); border-color: rgba(15,148,136,.3); }
.empty { text-align: center; color: var(--muted); padding: 26px 10px; border: 1px dashed var(--line); border-radius: 12px; }
.overlay { position: fixed; inset: 0; z-index: 2147483001; background: rgba(5, 20, 18, .45); display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal { background: var(--bg); border-radius: 14px; width: 560px; max-width: 100%; max-height: calc(100vh - 40px); display: flex; flex-direction: column; box-shadow: var(--shadow); border: 1px solid var(--line); }
.modal .mh { display: flex; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--line); font-weight: 700; font-size: 15px; }
.modal .mb { padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.modal .mf { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--line); }
.toasts { position: fixed; right: 16px; bottom: 16px; z-index: 2147483002; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; pointer-events: none; }
.toast { pointer-events: auto; background: var(--fg); color: var(--bg); padding: 9px 13px; border-radius: 10px; box-shadow: var(--shadow); max-width: 360px; font-size: 13px; animation: tin .2s ease; }
.toast.error { background: var(--danger); color: #fff; }
.toast.ok { background: var(--ok); color: #fff; }
@keyframes tin { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
.fab { position: fixed; right: 18px; bottom: 86px; z-index: 2147482999; width: 44px; height: 44px; border-radius: 14px; border: 0; cursor: pointer; padding: 0; box-shadow: 0 6px 18px rgba(0,0,0,.25); background: none; }
.fab svg { width: 44px; height: 44px; display: block; }
.menu { position: fixed; z-index: 2147483003; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow); min-width: 220px; max-width: 340px; max-height: 320px; overflow-y: auto; padding: 4px; }
.menu .mi { all: unset; display: block; box-sizing: border-box; width: 100%; padding: 7px 10px; border-radius: 7px; cursor: pointer; font-size: 13px; }
.menu .mi small { display: block; color: var(--muted); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.menu .mi:hover, .menu .mi.sel { background: var(--bg3); }
.menu .mt { font-size: 11px; color: var(--muted); padding: 6px 10px 2px; text-transform: uppercase; letter-spacing: .4px; }
.hbar { display: inline-flex; gap: 2px; align-items: center; }
.hbar button { all: unset; cursor: pointer; width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #54656f; }
.hbar.dark button { color: #aebac1; }
.hbar button:hover { background: rgba(0,0,0,.08); }
.tabs2 { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 10px; flex-wrap: wrap; }
.tabs2 button { all: unset; cursor: pointer; padding: 6px 10px; font-size: 12.5px; color: var(--muted); border-bottom: 2px solid transparent; }
.tabs2 button.on { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
.kv { display: grid; grid-template-columns: 1fr 1fr auto; gap: 6px; align-items: center; }
.preview { white-space: pre-wrap; background: var(--bg3); border-radius: 10px; padding: 9px 11px; font-size: 13px; }
.mediaPrev { max-width: 100%; max-height: 260px; border-radius: 8px; display: block; }
a { color: var(--accent2); }
.qbar { display: flex; gap: 6px; align-items: center; padding: 6px 10px; overflow: visible; flex-wrap: nowrap; background: transparent; }
.qpill { all: unset; cursor: pointer; white-space: nowrap; padding: 4px 11px; border-radius: 99px; font-size: 12.5px; background: var(--bg); color: var(--fg); border: 1px solid var(--line); box-shadow: 0 1px 1px rgba(0,0,0,.06); }
.qpill:hover { border-color: var(--accent); }
.qpill.active { background: var(--accent); color: var(--accentFg); border-color: transparent; }
.qmore { position: relative; margin-left: auto; }
.qmore-menu { display: none; position: absolute; bottom: 34px; right: 0; width: 260px; max-height: 280px; overflow-y: auto; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow); z-index: 10; }
.qmore-menu.open { display: block; }
.qmore-items { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 6px 8px; }
`;
