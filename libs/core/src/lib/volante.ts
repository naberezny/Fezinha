import { ordemNoVolante, type LoteriaDefinicao } from './tipos';

/** Posição (0-based) da dezena na sequência do volante: 0 para a primeira casa (01; o 00 da Lotomania é a última). */
function posicao(dezena: number, def: LoteriaDefinicao): number {
  return ordemNoVolante(dezena, def) - 1;
}

/** Coluna (0-based) da dezena no volante. */
export function coluna(dezena: number, def: LoteriaDefinicao): number {
  return posicao(dezena, def) % def.volante.colunas;
}

/** Linha (0-based) da dezena no volante. */
export function linha(dezena: number, def: LoteriaDefinicao): number {
  return Math.floor(posicao(dezena, def) / def.volante.colunas);
}

/**
 * Quadrante (0..3) da dezena: 0 = superior esquerdo, 1 = superior direito,
 * 2 = inferior esquerdo, 3 = inferior direito. A divisão é na metade das linhas e das colunas.
 */
export function quadrante(dezena: number, def: LoteriaDefinicao): number {
  const metadeLinhas = def.volante.linhas / 2;
  const metadeColunas = def.volante.colunas / 2;
  return (linha(dezena, def) < metadeLinhas ? 0 : 2) + (coluna(dezena, def) < metadeColunas ? 0 : 1);
}

/** Combinações C(n, k) como inteiro exato (n até ~60). */
export function combinacoes(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) {
    r = (r * (n - k + i)) / i;
  }
  return Math.round(r);
}

/** Quantas apostas simples um jogo de `dezenasPorJogo` dezenas equivale. */
export function apostasEquivalentes(dezenasPorJogo: number, def: LoteriaDefinicao): number {
  return combinacoes(dezenasPorJogo, def.sorteadas);
}

/** Total de combinações possíveis do sorteio (Mega-Sena: 50.063.860). Acima de 2^53 (Lotomania) o valor é aproximado. */
export function totalCombinacoes(def: LoteriaDefinicao): number {
  return combinacoes(def.universo, def.sorteadas);
}

/** C(n, k) exato em BigInt, para quando o resultado passa de 2^53 (ex.: C(100, 20) na Lotomania). */
export function combinacoesExatas(n: number, k: number): bigint {
  if (k < 0 || k > n) return BigInt(0);
  let r = BigInt(1);
  for (let i = BigInt(1); i <= BigInt(k); i++) {
    r = (r * (BigInt(n) - BigInt(k) + i)) / i;
  }
  return r;
}

/**
 * Chance de acertar o prêmio principal com um jogo de `dezenasPorJogo` dezenas, como "1 em N" (N arredondado).
 * Calculada em BigInt para não perder precisão quando as combinações passam de 2^53 (C(100, 20) na Lotomania).
 * Segue a tabela oficial da Mega-Sena (ex.: 12 dezenas → 1 em 54.182, de 54.181,67). Na Lotomania o quociente
 * exato é 11.372.635,885: aqui sai 11.372.636; a Caixa publica 11.372.635 (truncado).
 */
export function chanceUmEm(dezenasPorJogo: number, def: LoteriaDefinicao): number {
  const total = combinacoesExatas(def.universo, def.sorteadas);
  const apostas = combinacoesExatas(dezenasPorJogo, def.sorteadas);
  if (apostas === BigInt(0)) return 0;
  // arredondamento em inteiros: floor((2·total + apostas) / (2·apostas))
  return Number((BigInt(2) * total + apostas) / (BigInt(2) * apostas));
}
