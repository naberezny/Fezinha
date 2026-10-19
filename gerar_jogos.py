#!/usr/bin/env python3
"""
Gerador de jogos da Mega-Sena baseado no histórico de resultados.

Lê os concursos do banco megasena.db (fonte da verdade; veja banco.py). Se a
planilha Mega-Sena.xlsx tiver sido atualizada desde a última importação, ela é
re-importada automaticamente antes de gerar (pode desligar com --sem-sincronizar).
Calcula para cada número (1..60) o atraso (sorteios desde a última aparição),
a frequência histórica e a frequência recente, e gera jogos de 6 números
ponderados por esses indicadores.

Só usa a biblioteca padrão do Python (sqlite3, zipfile, xml), sem instalar nada.

AVISO HONESTO: cada sorteio é independente. Nenhuma estratégia baseada no
passado aumenta a probabilidade real de acertar (continua 1 em 50.063.860
por jogo). O que este script faz é escolher, de forma sistemática e
reproduzível, números "atrasados" ou "quentes" segundo o histórico, que é
o que foi pedido. Trate como critério de escolha, não como vantagem.

Uso:
    python gerar_jogos.py                       # 5 jogos, estratégia "atrasados"
    python gerar_jogos.py -n 10                 # 10 jogos
    python gerar_jogos.py -e frequentes         # números mais sorteados recentemente
    python gerar_jogos.py -e mista              # combina atraso + frequência
    python gerar_jogos.py --relatorio           # tabela completa dos 60 números
    python gerar_jogos.py --seed 42             # saída reproduzível
    python gerar_jogos.py --salvar              # grava jogos_<data>_<estrategia>.txt
"""

from __future__ import annotations

import argparse
import math
import random
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import banco
from banco import Sorteio

TOTAL_NUMEROS = 60
NUMEROS_POR_JOGO = 6
P_SAIR = NUMEROS_POR_JOGO / TOTAL_NUMEROS          # 0,10
ATRASO_ESPERADO = 1 / P_SAIR                        # 10 sorteios


# ----------------------------------------------------------------------------
# Estatísticas por número
# ----------------------------------------------------------------------------

@dataclass
class Estatistica:
    numero: int
    frequencia: int          # vezes que saiu no histórico inteiro
    freq_recente: int        # vezes que saiu na janela recente
    atraso: int              # sorteios desde a última aparição (0 = saiu no último)
    atraso_maximo: int       # maior atraso já registrado no histórico
    ultimo_concurso: int | None

    @property
    def prob_ausencia(self) -> float:
        """Probabilidade de um número ficar ausente por 'atraso' sorteios seguidos: 0,9^atraso."""
        return (1 - P_SAIR) ** self.atraso

    @property
    def atraso_relativo(self) -> float:
        """Atraso dividido pelo atraso esperado (10). >1 = 'devendo' segundo a heurística."""
        return self.atraso / ATRASO_ESPERADO


def calcular_estatisticas(sorteios: list[Sorteio], janela: int) -> list[Estatistica]:
    total = len(sorteios)
    recentes = sorteios[-janela:] if janela > 0 else []
    stats: list[Estatistica] = []
    for n in range(1, TOTAL_NUMEROS + 1):
        indices = [i for i, s in enumerate(sorteios) if n in s.bolas]
        freq = len(indices)
        freq_rec = sum(1 for s in recentes if n in s.bolas)
        if indices:
            atraso = total - 1 - indices[-1]
            ultimo = sorteios[indices[-1]].concurso
            # maior intervalo entre aparições (inclui o início do histórico e o atraso atual)
            gaps = [indices[0]] + [b - a - 1 for a, b in zip(indices, indices[1:])] + [atraso]
            atraso_max = max(gaps)
        else:
            atraso, ultimo, atraso_max = total, None, total
        stats.append(Estatistica(n, freq, freq_rec, atraso, atraso_max, ultimo))
    return stats


# ----------------------------------------------------------------------------
# Pesos e geração dos jogos
# ----------------------------------------------------------------------------

def pesos(stats: list[Estatistica], estrategia: str) -> dict[int, float]:
    """
    Converte estatísticas em peso de sorteio (quanto maior, mais chance de entrar no jogo).

    atrasados : peso cresce com o atraso (1 + atraso_relativo^2). Quem acabou de sair
                tem peso 1; quem está 20 sorteios sem sair tem peso 5.
    frequentes: peso cresce com a frequência recente (1 + freq_recente).
    mista     : média geométrica dos dois, normalizados.
    """
    if estrategia == "atrasados":
        return {s.numero: 1.0 + s.atraso_relativo ** 2 for s in stats}
    if estrategia == "frequentes":
        return {s.numero: 1.0 + s.freq_recente for s in stats}
    if estrategia == "mista":
        a = pesos(stats, "atrasados")
        f = pesos(stats, "frequentes")
        ma, mf = max(a.values()), max(f.values())
        return {n: math.sqrt((a[n] / ma) * (f[n] / mf)) + 0.05 for n in a}
    raise SystemExit(f"Estratégia desconhecida: {estrategia}")


def _jogo_aceitavel(jogo: tuple[int, ...], historico: set[tuple[int, ...]]) -> bool:
    if jogo in historico:
        return False                       # nunca repetir um resultado já sorteado
    pares = sum(1 for n in jogo if n % 2 == 0)
    if pares < 2 or pares > 4:
        return False                       # 2 a 4 pares (faixa mais comum)
    consecutivos = sum(1 for a, b in zip(jogo, jogo[1:]) if b == a + 1)
    if consecutivos >= 3:
        return False                       # evita 4+ números seguidos
    return True


def gerar_jogos(stats: list[Estatistica], sorteios: list[Sorteio], quantidade: int,
                estrategia: str, rng: random.Random, fixos: list[int]) -> list[tuple[int, ...]]:
    w = pesos(stats, estrategia)
    historico = {s.bolas for s in sorteios}
    jogos: list[tuple[int, ...]] = []
    tentativas = 0
    while len(jogos) < quantidade and tentativas < 20000:
        tentativas += 1
        escolhidos = list(fixos)
        candidatos = [n for n in w if n not in escolhidos]
        while len(escolhidos) < NUMEROS_POR_JOGO:
            n = rng.choices(candidatos, weights=[w[c] for c in candidatos], k=1)[0]
            escolhidos.append(n)
            candidatos.remove(n)
        jogo = tuple(sorted(escolhidos))
        if jogo in jogos or not _jogo_aceitavel(jogo, historico):
            continue
        jogos.append(jogo)
    if len(jogos) < quantidade:
        print(f"Aviso: só foi possível gerar {len(jogos)} jogos com os filtros atuais.", file=sys.stderr)
    return jogos


# ----------------------------------------------------------------------------
# Saída
# ----------------------------------------------------------------------------

def imprimir_resumo(sorteios: list[Sorteio], stats: list[Estatistica], janela: int, top: int) -> None:
    ultimo = sorteios[-1]
    print(f"Histórico lido: {len(sorteios)} concursos "
          f"(do {sorteios[0].concurso} ao {ultimo.concurso}, último em {ultimo.data}).")
    print(f"Último resultado: {' '.join(f'{b:02d}' for b in ultimo.bolas)}")
    print(f"Atraso esperado por número: {ATRASO_ESPERADO:.0f} sorteios (P(sair) = {P_SAIR:.0%}).\n")

    por_atraso = sorted(stats, key=lambda s: (-s.atraso, -s.frequencia))[:top]
    print(f"Top {top} mais atrasados (chance de ausência = 0,9^atraso):")
    print("  Nº  atraso  0,9^atraso  máx.hist  freq.total  últ.concurso")
    for s in por_atraso:
        print(f"  {s.numero:02d}  {s.atraso:6d}  {s.prob_ausencia:9.2%}  {s.atraso_maximo:8d}  "
              f"{s.frequencia:10d}  {s.ultimo_concurso or '-':>12}")

    por_recente = sorted(stats, key=lambda s: (-s.freq_recente, -s.frequencia))[:top]
    print(f"\nTop {top} mais frequentes nos últimos {janela} sorteios:")
    print("  " + "  ".join(f"{s.numero:02d}({s.freq_recente}x)" for s in por_recente))
    print()


def imprimir_relatorio(stats: list[Estatistica], janela: int) -> None:
    print("Nº  freq.total  freq.rec(%d)  atraso  0,9^atraso  atraso.máx  últ.concurso" % janela)
    for s in sorted(stats, key=lambda s: -s.atraso):
        print(f"{s.numero:02d}  {s.frequencia:10d}  {s.freq_recente:12d}  {s.atraso:6d}  "
              f"{s.prob_ausencia:9.2%}  {s.atraso_maximo:10d}  {s.ultimo_concurso or '-':>12}")
    print()


def formatar_jogos(jogos: list[tuple[int, ...]], stats: list[Estatistica]) -> str:
    por_num = {s.numero: s for s in stats}
    linhas = []
    for i, jogo in enumerate(jogos, 1):
        nums = " ".join(f"{n:02d}" for n in jogo)
        atrasos = ", ".join(str(por_num[n].atraso) for n in jogo)
        linhas.append(f"Jogo {i:2d}: {nums}   (atrasos: {atrasos})")
    return "\n".join(linhas)


def carregar_sorteios(caminho_banco: Path, caminho_planilha: Path, sincronizar: bool) -> list[Sorteio]:
    conn = banco.conectar(caminho_banco)
    banco.criar_schema(conn)
    if sincronizar and banco.planilha_mudou(conn, caminho_planilha):
        res = banco.importar_planilha(conn, caminho_planilha)
        print(f"Planilha sincronizada com {caminho_banco.name}: "
              f"{res.novos} novos, {res.atualizados} atualizados, {res.inalterados} inalterados.\n")
    sorteios = banco.carregar_sorteios(conn)
    conn.close()
    if not sorteios:
        raise SystemExit("Banco vazio: rode `python importar_planilha.py` ou aponte -p para a planilha.")
    return sorteios


def main() -> None:
    p = argparse.ArgumentParser(description="Gera jogos da Mega-Sena a partir do histórico da planilha.")
    p.add_argument("-n", "--jogos", type=int, default=5, help="quantidade de jogos (padrão 5)")
    p.add_argument("-e", "--estrategia", choices=["atrasados", "frequentes", "mista"], default="atrasados")
    p.add_argument("-j", "--janela", type=int, default=50, help="sorteios recentes p/ frequência (padrão 50)")
    p.add_argument("-b", "--banco", type=Path, default=banco.BANCO_PADRAO, help="arquivo SQLite (padrão megasena.db)")
    p.add_argument("-p", "--planilha", type=Path, default=banco.PLANILHA_PADRAO,
                   help="planilha a sincronizar quando mudar (padrão Mega-Sena.xlsx)")
    p.add_argument("--sem-sincronizar", action="store_true", help="não re-importa a planilha mesmo se ela mudou")
    p.add_argument("-f", "--fixos", type=int, nargs="*", default=[], help="números que todo jogo deve conter")
    p.add_argument("--top", type=int, default=12, help="tamanho dos rankings do resumo")
    p.add_argument("--seed", type=int, help="semente p/ resultado reproduzível")
    p.add_argument("--relatorio", action="store_true", help="imprime a tabela completa dos 60 números")
    p.add_argument("--salvar", action="store_true", help="grava os jogos em jogos_<data>_<estrategia>.txt")
    args = p.parse_args()

    if any(not 1 <= n <= TOTAL_NUMEROS for n in args.fixos) or len(set(args.fixos)) != len(args.fixos):
        raise SystemExit("Números fixos devem ser distintos e estar entre 1 e 60.")
    if len(args.fixos) > NUMEROS_POR_JOGO:
        raise SystemExit("No máximo 6 números fixos.")

    sorteios = carregar_sorteios(args.banco, args.planilha, not args.sem_sincronizar)
    stats = calcular_estatisticas(sorteios, args.janela)
    rng = random.Random(args.seed)

    imprimir_resumo(sorteios, stats, args.janela, args.top)
    if args.relatorio:
        imprimir_relatorio(stats, args.janela)

    jogos = gerar_jogos(stats, sorteios, args.jogos, args.estrategia, rng, sorted(args.fixos))
    texto = formatar_jogos(jogos, stats)
    print(f"Jogos gerados (estratégia: {args.estrategia}, base: concurso {sorteios[-1].concurso}):")
    print(texto)
    print("\nLembrete: sorteios são independentes; a chance real por jogo continua 1 em 50.063.860.")

    if args.salvar:
        destino = args.banco.with_name(f"jogos_{date.today():%Y%m%d}_{args.estrategia}.txt")
        destino.write_text(
            f"Base: concurso {sorteios[-1].concurso} ({sorteios[-1].data}) | estratégia: {args.estrategia}\n"
            f"{texto}\n", encoding="utf-8")
        print(f"Jogos gravados em {destino}")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()
