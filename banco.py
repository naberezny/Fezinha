"""
Camada de dados da Mega-Sena: schema SQLite, leitura da planilha oficial e upsert.

Fonte da verdade = megasena.db. A planilha Mega-Sena.xlsx (export da Caixa) é
só uma origem de carga; no futuro uma API alimentará o mesmo banco usando
`upsert_concursos(conn, registros, origem="api")` com o mesmo formato de dict.

Só biblioteca padrão (sqlite3, zipfile, xml).

Modelo (3ª forma normal, pensado para gráficos por período):

  concursos             1 linha por concurso: data, ganhadores/rateio por faixa,
                        acumulados, arrecadação, estimativa, observação, origem.
  dezenas               6 linhas por concurso (ordem 1..6, dezena 1..60).
                        É a tabela que alimenta "mais/menos sorteadas em X período".
  ganhadores_sena_local 1 linha por cidade/UF premiada na sena (0..N por concurso).
  metadados             chave/valor: última importação, mtime da planilha, etc.

Views prontas:
  vw_sorteios                 concurso + dezenas pivotadas (d1..d6) + ano/mês + acumulou
  vw_frequencia_dezenas       total histórico, 1ª e última aparição por dezena
  vw_atraso_dezenas           atraso atual (concursos desde a última aparição)
  vw_frequencia_dezenas_ano   total por (ano, dezena)
  vw_frequencia_dezenas_mes   total por (ano_mes, dezena)
"""

from __future__ import annotations

import re
import sqlite3
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree as ET

PASTA = Path(__file__).resolve().parent
BANCO_PADRAO = PASTA / "megasena.db"
PLANILHA_PADRAO = PASTA / "Mega-Sena.xlsx"

TOTAL_NUMEROS = 60
NUMEROS_POR_JOGO = 6

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
TAG_T = "{%s}t" % NS["m"]

# Posição (0-based) de cada coluna no export oficial da Caixa.
COLUNAS = {
    "concurso": 0, "data": 1,
    "bolas": (2, 3, 4, 5, 6, 7),
    "ganhadores_sena": 8, "cidades_uf": 9, "rateio_sena": 10,
    "ganhadores_quina": 11, "rateio_quina": 12,
    "ganhadores_quadra": 13, "rateio_quadra": 14,
    "valor_acumulado_sena": 15, "arrecadacao_total": 16,
    "estimativa_premio": 17, "acumulado_mega_virada": 18,
    "observacao": 19,
}

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS concursos (
    concurso                INTEGER PRIMARY KEY,
    data_sorteio            TEXT    NOT NULL,            -- ISO yyyy-mm-dd
    ganhadores_sena         INTEGER NOT NULL DEFAULT 0,
    rateio_sena             REAL    NOT NULL DEFAULT 0,  -- em R$
    ganhadores_quina        INTEGER NOT NULL DEFAULT 0,
    rateio_quina            REAL    NOT NULL DEFAULT 0,
    ganhadores_quadra       INTEGER NOT NULL DEFAULT 0,
    rateio_quadra           REAL    NOT NULL DEFAULT 0,
    acumulou                INTEGER NOT NULL DEFAULT 0,  -- 1 = ninguém acertou a sena
    valor_acumulado_sena    REAL    NOT NULL DEFAULT 0,
    arrecadacao_total       REAL    NOT NULL DEFAULT 0,
    estimativa_premio       REAL    NOT NULL DEFAULT 0,  -- estimativa p/ o próximo concurso
    acumulado_mega_virada   REAL    NOT NULL DEFAULT 0,
    observacao              TEXT,
    origem                  TEXT    NOT NULL,            -- 'planilha' | 'api'
    atualizado_em           TEXT    NOT NULL             -- ISO datetime
);
CREATE INDEX IF NOT EXISTS ix_concursos_data ON concursos(data_sorteio);

CREATE TABLE IF NOT EXISTS dezenas (
    concurso    INTEGER NOT NULL REFERENCES concursos(concurso) ON DELETE CASCADE,
    ordem       INTEGER NOT NULL CHECK (ordem BETWEEN 1 AND 6),
    dezena      INTEGER NOT NULL CHECK (dezena BETWEEN 1 AND 60),
    PRIMARY KEY (concurso, ordem),
    UNIQUE (concurso, dezena)
);
CREATE INDEX IF NOT EXISTS ix_dezenas_dezena ON dezenas(dezena);

CREATE TABLE IF NOT EXISTS ganhadores_sena_local (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    concurso    INTEGER NOT NULL REFERENCES concursos(concurso) ON DELETE CASCADE,
    cidade      TEXT,                                    -- NULL quando o export só traz a UF
    uf          TEXT,
    descricao   TEXT    NOT NULL                         -- texto original ("DOURADOS/MS", "SP", "CANAL ELETRONICO")
);
CREATE INDEX IF NOT EXISTS ix_ganhadores_concurso ON ganhadores_sena_local(concurso);
CREATE INDEX IF NOT EXISTS ix_ganhadores_uf ON ganhadores_sena_local(uf);

CREATE TABLE IF NOT EXISTS metadados (
    chave   TEXT PRIMARY KEY,
    valor   TEXT
);

-- Views são recriadas a cada criar_schema() para evoluir sem apagar o banco.
DROP VIEW IF EXISTS vw_sorteios;
DROP VIEW IF EXISTS vw_atraso_dezenas;
DROP VIEW IF EXISTS vw_frequencia_dezenas;
DROP VIEW IF EXISTS vw_frequencia_dezenas_ano;
DROP VIEW IF EXISTS vw_frequencia_dezenas_mes;

CREATE VIEW vw_sorteios AS
SELECT c.concurso,
       c.data_sorteio,
       CAST(strftime('%Y', c.data_sorteio) AS INTEGER) AS ano,
       strftime('%Y-%m', c.data_sorteio)               AS ano_mes,
       MAX(CASE d.ordem WHEN 1 THEN d.dezena END) AS d1,
       MAX(CASE d.ordem WHEN 2 THEN d.dezena END) AS d2,
       MAX(CASE d.ordem WHEN 3 THEN d.dezena END) AS d3,
       MAX(CASE d.ordem WHEN 4 THEN d.dezena END) AS d4,
       MAX(CASE d.ordem WHEN 5 THEN d.dezena END) AS d5,
       MAX(CASE d.ordem WHEN 6 THEN d.dezena END) AS d6,
       c.acumulou, c.ganhadores_sena, c.rateio_sena,
       c.valor_acumulado_sena, c.arrecadacao_total, c.estimativa_premio
FROM concursos c
JOIN dezenas d ON d.concurso = c.concurso
GROUP BY c.concurso;

CREATE VIEW vw_frequencia_dezenas AS
SELECT f.dezena, f.total, f.primeiro_concurso, f.ultimo_concurso,
       c.data_sorteio AS ultima_data
FROM (SELECT dezena, COUNT(*) AS total,
             MIN(concurso) AS primeiro_concurso, MAX(concurso) AS ultimo_concurso
      FROM dezenas GROUP BY dezena) f
JOIN concursos c ON c.concurso = f.ultimo_concurso;

CREATE VIEW vw_atraso_dezenas AS
SELECT f.dezena,
       f.total,
       f.ultimo_concurso,
       f.ultima_data,
       (SELECT COUNT(*) FROM concursos c WHERE c.concurso > f.ultimo_concurso) AS atraso
FROM vw_frequencia_dezenas f;

CREATE VIEW vw_frequencia_dezenas_ano AS
SELECT CAST(strftime('%Y', c.data_sorteio) AS INTEGER) AS ano, d.dezena, COUNT(*) AS total
FROM dezenas d JOIN concursos c ON c.concurso = d.concurso
GROUP BY ano, d.dezena;

CREATE VIEW vw_frequencia_dezenas_mes AS
SELECT strftime('%Y-%m', c.data_sorteio) AS ano_mes, d.dezena, COUNT(*) AS total
FROM dezenas d JOIN concursos c ON c.concurso = d.concurso
GROUP BY ano_mes, d.dezena;
"""


# ----------------------------------------------------------------------------
# Conexão e schema
# ----------------------------------------------------------------------------

def conectar(caminho: Path = BANCO_PADRAO) -> sqlite3.Connection:
    conn = sqlite3.connect(caminho)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def criar_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)


def ler_metadado(conn: sqlite3.Connection, chave: str) -> str | None:
    linha = conn.execute("SELECT valor FROM metadados WHERE chave = ?", (chave,)).fetchone()
    return linha["valor"] if linha else None


def gravar_metadado(conn: sqlite3.Connection, chave: str, valor: Any) -> None:
    conn.execute("INSERT OR REPLACE INTO metadados(chave, valor) VALUES (?, ?)", (chave, str(valor)))


# ----------------------------------------------------------------------------
# Conversões
# ----------------------------------------------------------------------------

def dinheiro(texto: str | None) -> float:
    """'R$2.307.162,23' -> 2307162.23. Vazio/None -> 0.0."""
    if not texto:
        return 0.0
    limpo = re.sub(r"[^\d,.-]", "", str(texto)).replace(".", "").replace(",", ".")
    try:
        return float(limpo) if limpo else 0.0
    except ValueError:
        return 0.0


def inteiro(texto: str | None) -> int:
    try:
        return int(float(str(texto).replace(".", "").replace(",", "."))) if texto not in (None, "") else 0
    except ValueError:
        return 0


def data_iso(texto: str | None) -> str:
    """'11/03/1996' -> '1996-03-11'. Aceita ISO ou serial do Excel."""
    if not texto:
        raise ValueError("data vazia")
    t = str(texto).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y"):
        try:
            return datetime.strptime(t[:10], fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    if re.fullmatch(r"\d+(\.\d+)?", t):  # serial do Excel (dias desde 1899-12-30)
        from datetime import timedelta
        return (datetime(1899, 12, 30) + timedelta(days=float(t))).strftime("%Y-%m-%d")
    raise ValueError(f"data não reconhecida: {texto!r}")


def separar_locais(texto: str | None) -> list[dict[str, str | None]]:
    """'MIRANTE DO PARANAPANEMA/SP; RJ' -> [{cidade, uf, descricao}, ...]."""
    if not texto:
        return []
    locais = []
    for parte in re.split(r"\s*;\s*", str(texto).strip()):
        if not parte:
            continue
        cidade, uf = None, None
        if "/" in parte:
            cidade, uf = (p.strip() or None for p in parte.rsplit("/", 1))
        elif re.fullmatch(r"[A-Z]{2}", parte.strip()):
            uf = parte.strip()
        else:
            cidade = parte.strip()  # ex.: "CANAL ELETRONICO"
        locais.append({"cidade": cidade, "uf": uf, "descricao": parte.strip()})
    return locais


# ----------------------------------------------------------------------------
# Leitura da planilha (xlsx = zip com XML)
# ----------------------------------------------------------------------------

def _coluna_para_indice(ref: str) -> int:
    letras = re.match(r"[A-Z]+", ref).group(0)
    idx = 0
    for ch in letras:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx - 1


def _ler_shared_strings(z: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    raiz = ET.fromstring(z.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.iter(TAG_T)) for si in raiz.findall("m:si", NS)]


def _valor_celula(c: ET.Element, shared: list[str]) -> str | None:
    tipo = c.get("t")
    if tipo == "inlineStr":
        return "".join(t.text or "" for t in c.iter(TAG_T))
    v = c.find("m:v", NS)
    if v is None or v.text is None:
        return None
    return shared[int(v.text)] if tipo == "s" else v.text


def _linhas_planilha(caminho: Path) -> Iterable[list[str | None]]:
    with zipfile.ZipFile(caminho) as z:
        shared = _ler_shared_strings(z)
        nomes = sorted(n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n))
        if not nomes:
            raise SystemExit("Nenhuma aba encontrada no xlsx.")
        raiz = ET.fromstring(z.read(nomes[0]))
    for linha in raiz.find("m:sheetData", NS).findall("m:row", NS):
        celulas: dict[int, str | None] = {}
        proximo = 0
        for c in linha.findall("m:c", NS):
            ref = c.get("r")
            idx = _coluna_para_indice(ref) if ref else proximo
            celulas[idx] = _valor_celula(c, shared)
            proximo = idx + 1
        tamanho = max(celulas) + 1 if celulas else 0
        yield [celulas.get(i) for i in range(tamanho)]


def ler_planilha(caminho: Path = PLANILHA_PADRAO) -> list[dict[str, Any]]:
    """Lê o export da Caixa e devolve 1 dict por concurso, já tipado (mesmo formato aceito pelo upsert)."""
    if not caminho.exists():
        raise SystemExit(f"Planilha não encontrada: {caminho}")
    registros: list[dict[str, Any]] = []

    def col(linha: list, chave: str) -> str | None:
        i = COLUNAS[chave]
        return linha[i] if i < len(linha) else None

    for linha in _linhas_planilha(caminho):
        try:
            concurso = int(float(col(linha, "concurso") or ""))
            bolas = [int(float(linha[i] or "")) for i in COLUNAS["bolas"]]
            data = data_iso(col(linha, "data"))
        except (ValueError, IndexError):
            continue  # cabeçalho ou linha incompleta
        if len(set(bolas)) != 6 or not all(1 <= b <= TOTAL_NUMEROS for b in bolas):
            continue
        ganhadores_sena = inteiro(col(linha, "ganhadores_sena"))
        registros.append({
            "concurso": concurso,
            "data_sorteio": data,
            "dezenas": bolas,  # ordem do export (crescente)
            "ganhadores_sena": ganhadores_sena,
            "rateio_sena": dinheiro(col(linha, "rateio_sena")),
            "ganhadores_quina": inteiro(col(linha, "ganhadores_quina")),
            "rateio_quina": dinheiro(col(linha, "rateio_quina")),
            "ganhadores_quadra": inteiro(col(linha, "ganhadores_quadra")),
            "rateio_quadra": dinheiro(col(linha, "rateio_quadra")),
            "acumulou": 1 if ganhadores_sena == 0 else 0,
            "valor_acumulado_sena": dinheiro(col(linha, "valor_acumulado_sena")),
            "arrecadacao_total": dinheiro(col(linha, "arrecadacao_total")),
            "estimativa_premio": dinheiro(col(linha, "estimativa_premio")),
            "acumulado_mega_virada": dinheiro(col(linha, "acumulado_mega_virada")),
            "observacao": (col(linha, "observacao") or "").strip() or None,
            "locais_sena": separar_locais(col(linha, "cidades_uf")),
        })
    if not registros:
        raise SystemExit("Nenhum concurso válido lido da planilha.")
    registros.sort(key=lambda r: r["concurso"])
    return registros


# ----------------------------------------------------------------------------
# Escrita (idempotente) — serve tanto para a planilha quanto para a futura API
# ----------------------------------------------------------------------------

@dataclass
class ResultadoImportacao:
    novos: int = 0
    atualizados: int = 0
    inalterados: int = 0

    @property
    def total(self) -> int:
        return self.novos + self.atualizados + self.inalterados


CAMPOS_CONCURSO = (
    "data_sorteio", "ganhadores_sena", "rateio_sena", "ganhadores_quina", "rateio_quina",
    "ganhadores_quadra", "rateio_quadra", "acumulou", "valor_acumulado_sena",
    "arrecadacao_total", "estimativa_premio", "acumulado_mega_virada", "observacao",
)


def _assinatura(reg: dict[str, Any]) -> tuple:
    return (tuple(reg[c] for c in CAMPOS_CONCURSO),
            tuple(reg["dezenas"]),
            tuple(l["descricao"] for l in reg.get("locais_sena", [])))


def _assinatura_banco(conn: sqlite3.Connection, concurso: int) -> tuple | None:
    c = conn.execute(f"SELECT {', '.join(CAMPOS_CONCURSO)} FROM concursos WHERE concurso = ?",
                     (concurso,)).fetchone()
    if c is None:
        return None
    dez = [r["dezena"] for r in conn.execute(
        "SELECT dezena FROM dezenas WHERE concurso = ? ORDER BY ordem", (concurso,))]
    loc = [r["descricao"] for r in conn.execute(
        "SELECT descricao FROM ganhadores_sena_local WHERE concurso = ? ORDER BY id", (concurso,))]
    return (tuple(c), tuple(dez), tuple(loc))


def upsert_concursos(conn: sqlite3.Connection, registros: Iterable[dict[str, Any]],
                     origem: str) -> ResultadoImportacao:
    """
    Insere ou atualiza concursos. Cada registro segue o formato de `ler_planilha`:
    {concurso, data_sorteio (ISO), dezenas [6 ints], ganhadores_*, rateio_*, acumulou,
     valor_acumulado_sena, arrecadacao_total, estimativa_premio, acumulado_mega_virada,
     observacao, locais_sena [{cidade, uf, descricao}]}.
    Linhas idênticas às já gravadas não são tocadas (atualizado_em preservado).
    """
    agora = datetime.now().isoformat(timespec="seconds")
    res = ResultadoImportacao()
    with conn:
        for reg in registros:
            if len(reg["dezenas"]) != NUMEROS_POR_JOGO or len(set(reg["dezenas"])) != NUMEROS_POR_JOGO:
                raise ValueError(f"concurso {reg['concurso']}: dezenas inválidas {reg['dezenas']}")
            atual = _assinatura_banco(conn, reg["concurso"])
            if atual == _assinatura(reg):
                res.inalterados += 1
                continue
            valores = {c: reg.get(c) for c in CAMPOS_CONCURSO}
            valores.update(concurso=reg["concurso"], origem=origem, atualizado_em=agora)
            colunas = ", ".join(valores)
            marcadores = ", ".join(f":{c}" for c in valores)
            conn.execute(f"INSERT OR REPLACE INTO concursos ({colunas}) VALUES ({marcadores})", valores)
            # INSERT OR REPLACE apaga filhos via ON DELETE CASCADE; regrava:
            conn.execute("DELETE FROM dezenas WHERE concurso = ?", (reg["concurso"],))
            conn.executemany("INSERT INTO dezenas(concurso, ordem, dezena) VALUES (?, ?, ?)",
                             [(reg["concurso"], i + 1, d) for i, d in enumerate(reg["dezenas"])])
            conn.execute("DELETE FROM ganhadores_sena_local WHERE concurso = ?", (reg["concurso"],))
            conn.executemany(
                "INSERT INTO ganhadores_sena_local(concurso, cidade, uf, descricao) VALUES (?, ?, ?, ?)",
                [(reg["concurso"], l.get("cidade"), l.get("uf"), l["descricao"])
                 for l in reg.get("locais_sena", [])])
            if atual is None:
                res.novos += 1
            else:
                res.atualizados += 1
    return res


def importar_planilha(conn: sqlite3.Connection, caminho: Path = PLANILHA_PADRAO) -> ResultadoImportacao:
    criar_schema(conn)
    res = upsert_concursos(conn, ler_planilha(caminho), origem="planilha")
    with conn:
        gravar_metadado(conn, "planilha_caminho", caminho)
        gravar_metadado(conn, "planilha_mtime", caminho.stat().st_mtime)
        gravar_metadado(conn, "ultima_importacao", datetime.now().isoformat(timespec="seconds"))
    return res


def planilha_mudou(conn: sqlite3.Connection, caminho: Path = PLANILHA_PADRAO) -> bool:
    """True se a planilha existe e seu mtime difere do registrado na última importação."""
    if not caminho.exists():
        return False
    gravado = ler_metadado(conn, "planilha_mtime")
    return gravado is None or abs(float(gravado) - caminho.stat().st_mtime) > 1e-6


# ----------------------------------------------------------------------------
# Leitura para o gerador
# ----------------------------------------------------------------------------

@dataclass
class Sorteio:
    concurso: int
    data: str
    bolas: tuple[int, ...]


def carregar_sorteios(conn: sqlite3.Connection) -> list[Sorteio]:
    linhas = conn.execute(
        "SELECT concurso, data_sorteio, d1, d2, d3, d4, d5, d6 FROM vw_sorteios ORDER BY concurso").fetchall()
    return [Sorteio(l["concurso"], l["data_sorteio"],
                    tuple(sorted((l["d1"], l["d2"], l["d3"], l["d4"], l["d5"], l["d6"]))))
            for l in linhas]
