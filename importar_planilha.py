#!/usr/bin/env python3
"""
Importa (ou re-sincroniza) a planilha Mega-Sena.xlsx para o banco megasena.db.

Idempotente: pode rodar quantas vezes quiser; só grava o que mudou.

Uso:
    python importar_planilha.py                 # Mega-Sena.xlsx -> megasena.db (mesma pasta)
    python importar_planilha.py -p outra.xlsx -b outro.db
    python importar_planilha.py --resumo        # imprime estatísticas após importar
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import banco


def imprimir_resumo(conn) -> None:
    c = conn.execute("SELECT COUNT(*) n, MIN(concurso) a, MAX(concurso) b, MIN(data_sorteio) d0, MAX(data_sorteio) d1 "
                     "FROM concursos").fetchone()
    print(f"Concursos no banco: {c['n']} ({c['a']} a {c['b']}, {c['d0']} a {c['d1']})")
    print(f"Dezenas registradas: {conn.execute('SELECT COUNT(*) FROM dezenas').fetchone()[0]}")
    print(f"Locais de ganhadores da sena: {conn.execute('SELECT COUNT(*) FROM ganhadores_sena_local').fetchone()[0]}")
    print(f"Origens: " + ", ".join(f"{r['origem']}={r['n']}" for r in conn.execute(
        "SELECT origem, COUNT(*) n FROM concursos GROUP BY origem")))
    print("\nTop 10 dezenas mais sorteadas (histórico):")
    for r in conn.execute("SELECT dezena, total FROM vw_frequencia_dezenas ORDER BY total DESC, dezena LIMIT 10"):
        print(f"  {r['dezena']:02d}: {r['total']}x")
    print("Top 10 menos sorteadas (histórico):")
    for r in conn.execute("SELECT dezena, total FROM vw_frequencia_dezenas ORDER BY total, dezena LIMIT 10"):
        print(f"  {r['dezena']:02d}: {r['total']}x")
    print("Top 10 mais atrasadas:")
    for r in conn.execute("SELECT dezena, atraso, ultimo_concurso FROM vw_atraso_dezenas ORDER BY atraso DESC LIMIT 10"):
        print(f"  {r['dezena']:02d}: {r['atraso']} concursos (último: {r['ultimo_concurso']})")


def main() -> None:
    p = argparse.ArgumentParser(description="Importa a planilha da Mega-Sena para o SQLite.")
    p.add_argument("-p", "--planilha", type=Path, default=banco.PLANILHA_PADRAO)
    p.add_argument("-b", "--banco", type=Path, default=banco.BANCO_PADRAO)
    p.add_argument("--resumo", action="store_true", help="imprime estatísticas após importar")
    args = p.parse_args()

    conn = banco.conectar(args.banco)
    res = banco.importar_planilha(conn, args.planilha)
    print(f"Importação concluída em {args.banco}: "
          f"{res.novos} novos, {res.atualizados} atualizados, {res.inalterados} inalterados "
          f"({res.total} lidos da planilha).")
    if args.resumo:
        print()
        imprimir_resumo(conn)
    conn.close()


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()
