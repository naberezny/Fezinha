import { acasoDoJogo } from './teste-estrategias';
import type { Concurso, FaixaPremiacao, LoteriaDefinicao } from './tipos';

/** Resultado da conferência de um jogo com um concurso já sorteado. */
export interface ConferenciaJogo {
  concurso: number;
  /** ISO yyyy-mm-dd. */
  data: string;
  /** Dezenas do jogo que saíram no concurso, na ordem do jogo. */
  acertos: number[];
  /** Faixa mais alta atingida pela quantidade de acertos; `undefined` quando não premia. */
  faixa?: FaixaPremiacao;
}

/**
 * Concurso em que um jogo salvo é conferido: o seguinte ao último concurso conhecido na hora da geração
 * (`concursoBase`), ou seja, o primeiro sorteio que o jogo ainda não "viu".
 */
export function concursoAlvo(concursoBase: number): number {
  return concursoBase + 1;
}

/** Confere `dezenas` com o resultado de `concurso`. */
export function conferirJogo(def: LoteriaDefinicao, dezenas: number[], concurso: Concurso): ConferenciaJogo {
  const sorteadas = new Set(concurso.dezenas);
  const acertos = dezenas.filter((d) => sorteadas.has(d));
  const faixa = def.faixas.filter((f) => f.acertos === acertos.length).sort((a, b) => a.faixa - b.faixa)[0];
  return { concurso: concurso.numero, data: concurso.data, acertos, faixa };
}

/** Assertividade de um conjunto de jogos já conferidos, comparada ao que o acaso daria aos mesmos jogos. */
export interface Assertividade {
  conferidos: number;
  /** Média de acertos por jogo conferido (0 quando não há nenhum). */
  mediaAcertos: number;
  /** Média de acertos que o acaso daria a jogos do mesmo tamanho. */
  mediaAcaso: number;
  /** Jogos que atingiram alguma faixa de premiação. */
  premiados: number;
  /** Quantos jogos fizeram cada quantidade de acertos (posição = acertos). */
  distribuicao: number[];
  /** Maior quantidade de acertos de um jogo. */
  melhor: number;
}

/** Resume jogos conferidos: cada item é o tamanho do jogo e a conferência dele. */
export function calcularAssertividade(
  def: LoteriaDefinicao,
  jogos: { tamanho: number; conferencia: ConferenciaJogo }[],
): Assertividade {
  const distribuicao: number[] = [];
  let somaAcertos = 0;
  let somaAcaso = 0;
  let premiados = 0;
  let melhor = 0;
  const acasoPorTamanho = new Map<number, number>();
  for (const { tamanho, conferencia } of jogos) {
    const quantidade = conferencia.acertos.length;
    somaAcertos += quantidade;
    if (!acasoPorTamanho.has(tamanho)) acasoPorTamanho.set(tamanho, acasoDoJogo(def, tamanho).mediaAcertos);
    somaAcaso += acasoPorTamanho.get(tamanho) ?? 0;
    if (conferencia.faixa) premiados++;
    melhor = Math.max(melhor, quantidade);
    while (distribuicao.length <= quantidade) distribuicao.push(0);
    distribuicao[quantidade]++;
  }
  const conferidos = jogos.length;
  return {
    conferidos,
    mediaAcertos: conferidos ? somaAcertos / conferidos : 0,
    mediaAcaso: conferidos ? somaAcaso / conferidos : 0,
    premiados,
    distribuicao,
    melhor,
  };
}
