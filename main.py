"""Pré-visualização do painel do WABA WEBE (opcional, só para conferir a interface).

A extensão de verdade fica em extension/ (repositório completo). Depois de `npm run build` lá dentro,
extension/dist/ é carregada no Chrome/Edge
em "Carregar sem compactação". Este script abre extension/dist-preview/preview.html: o mesmo painel,
com dados de exemplo, sem WhatsApp e sem rede.

    python main.py                         abre a pré-visualização no navegador
    python main.py --screenshot tela.png   salva uma captura (Chrome/Edge sem janela) e sai
    opções: --tab broadcasts  --lang en  --theme dark
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXT = ROOT / "extension"
PREVIEW = EXT / "dist-preview" / "preview.html"
PREVIEW_JS = EXT / "dist-preview" / "preview.js"


def newest_source() -> float:
    """Data da modificação mais recente do código-fonte da extensão."""
    newest = 0.0
    for folder in ("src", "static", "_locales", "scripts"):
        for p in (EXT / folder).rglob("*"):
            if p.is_file():
                newest = max(newest, p.stat().st_mtime)
    for name in ("package.json", "tsconfig.json"):
        p = EXT / name
        if p.exists():
            newest = max(newest, p.stat().st_mtime)
    return newest


def ensure_built() -> None:
    """Gera a extensão e a pré-visualização quando faltam ou estão mais velhas que o código."""
    ready = PREVIEW.exists() and PREVIEW_JS.exists() and (ROOT / "PARA-O-CHROME" / "manifest.json").exists()
    if ready and PREVIEW_JS.stat().st_mtime >= newest_source():
        return
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        sys.exit("extension/dist-preview/ está faltando ou velha e o npm não foi encontrado: rode `npm install` e `npm run build` em extension/.")
    if not (EXT / "node_modules").exists():
        subprocess.run([npm, "install"], cwd=EXT, check=True)
    subprocess.run([npm, "run", "build"], cwd=EXT, check=True, stdout=subprocess.DEVNULL)


def find_browser() -> str | None:
    candidates = [
        os.environ.get("WABAWEBE_BROWSER", ""),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    for c in candidates:
        if c and Path(c).exists():
            return c
    for name in ("google-chrome", "chromium", "chromium-browser", "microsoft-edge", "msedge", "chrome"):
        p = shutil.which(name)
        if p:
            return p
    return None


def preview_url(tab: str, lang: str, theme: str, open_: str = "", closed: bool = False) -> str:
    url = PREVIEW.as_uri() + f"?tab={tab}&lang={lang}&theme={theme}"
    if open_:
        url += f"&open={open_}"
    if closed:
        url += "&panel=closed"
    return url


def screenshot(out: Path, url: str, width: int, height: int) -> None:
    browser = find_browser()
    if not browser:
        sys.exit("Nenhum Chrome/Edge encontrado para tirar a captura (defina WABAWEBE_BROWSER).")
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    with tempfile.TemporaryDirectory(prefix="wabawebe-shot-") as profile:
        cmd = [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-first-run",
            "--no-default-browser-check",
            "--allow-file-access-from-files",
            f"--user-data-dir={profile}",
            f"--window-size={width},{height}",
            "--virtual-time-budget=4000",
            f"--screenshot={out}",
            url,
        ]
        subprocess.run(cmd, check=False, timeout=120, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            if out.exists() and out.stat().st_size > 0:
                break
            time.sleep(0.2)
    if not out.exists() or out.stat().st_size == 0:
        sys.exit(f"Falha ao salvar a captura em {out}")
    print(f"captura salva em {out}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--screenshot", metavar="ARQUIVO.png", help="salva uma captura da pré-visualização e sai")
    ap.add_argument("--tab", default="home", help="aba inicial do painel (home, privacy, templates, broadcasts, ...)")
    ap.add_argument("--lang", default="pt_BR", choices=["pt_BR", "en", "es", "ar", "ru", "tr"])
    ap.add_argument("--theme", default="light", choices=["light", "dark"])
    ap.add_argument("--open", default="", help="abre uma janela de edição: template, broadcast, automation, webhook, task, newchat")
    ap.add_argument("--closed", action="store_true", help="mostra a página sem o painel aberto (barra de respostas rápidas e botões extras)")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=800)
    args = ap.parse_args()

    ensure_built()
    url = preview_url(args.tab, args.lang, args.theme, args.open, args.closed)
    if args.screenshot:
        screenshot(Path(args.screenshot).resolve(), url, args.width, args.height)
        return
    webbrowser.open(url)


if __name__ == "__main__":
    main()
