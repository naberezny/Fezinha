"""Monta a pasta do artefato a partir da build 'artefato' do app Angular + os dados JSON exportados."""
import json
import re
import shutil
from pathlib import Path

DIST = Path(r"C:\Users\joao.naberezny\repositorios\Sorteios\dist\apps\app-artefato\browser")
DEST = Path(__file__).with_name("saida")
DEST.mkdir(exist_ok=True)

html = (DIST / "index.html").read_text(encoding="utf-8")
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)

# Remove o que não faz sentido dentro do artefato (base, manifesto, ícones de app, metas duplicadas).
head = re.sub(r"<base [^>]*>", "", head)
head = re.sub(r'<link rel="manifest"[^>]*>', "", head)
head = re.sub(r'<link rel="apple-touch-icon"[^>]*>', "", head)
head = re.sub(r'<meta charset[^>]*>', "", head)
head = re.sub(r'<meta name="viewport"[^>]*>', "", head)
# A folha de estilo entra direta (sem o truque de media=print/onload) para não depender de evento no sandbox.
head = re.sub(r'<link rel="stylesheet" href="([^"]+)" media="print" onload="[^"]*">', r'<link rel="stylesheet" href="\1">', head)
head = re.sub(r"<noscript>.*?</noscript>", "", head, flags=re.S)

pagina = (
    head.strip()
    + "\n<style>html,body{height:100%}srt-root{display:block;height:100%}</style>\n"
    + body.strip()
    + "\n"
)
(DEST / "index.html").write_text(pagina, encoding="utf-8")

# Copia os arquivos da build (sem index.html e sem service worker).
ignorar = {"index.html", "ngsw.json", "ngsw-worker.js", "safety-worker.js", "worker-basic.min.js", "manifest.webmanifest"}
arquivos = {}
for origem in DIST.rglob("*"):
    if origem.is_dir():
        continue
    rel = origem.relative_to(DIST).as_posix()
    if origem.name in ignorar:
        continue
    destino = DEST / rel
    destino.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(origem, destino)
    arquivos[rel] = str(destino)

# Dados exportados da API.
for dado in ["saude.json", "loterias/lista.json", "loterias/megasena/historico.json", "loterias/lotomania/historico.json"]:
    arquivos[dado] = str(DEST / dado)

mapa = {rel: {"from": caminho, "contentType": "application/json"} if rel.endswith(".json") else caminho for rel, caminho in arquivos.items()}
(DEST.parent / "artefato-app-files.json").write_text(json.dumps(mapa, indent=1, ensure_ascii=False), encoding="utf-8")
print("página:", len(pagina), "bytes;", len(mapa), "arquivos")
print("\n".join(sorted(mapa)))
