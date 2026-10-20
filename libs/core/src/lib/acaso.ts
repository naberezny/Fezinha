import type { LoteriaDefinicao } from './tipos';

/**
 * Distribuição hipergeométrica: probabilidade de o sorteio trazer 0, 1, …, min(tamanho, sorteadas) dezenas de um
 * grupo fixo de `tamanho` dezenas (um jogo, as "quentes", as atrasadas…). Posição = quantidade.
 */
export function distribuicaoAcaso(def: LoteriaDefinicao, tamanho: number): number[] {
  const { universo, sorteadas } = def;
  const lnFatorial = [0];
  for (let n = 1; n <= universo; n++) lnFatorial.push(lnFatorial[n - 1] + Math.log(n));
  const lnCombinacao = (n: number, k: number) => lnFatorial[n] - lnFatorial[k] - lnFatorial[n - k];

  const maximo = Math.min(tamanho, sorteadas);
  const distribuicao = new Array<number>(maximo + 1).fill(0);
  for (let quantidade = Math.max(0, tamanho + sorteadas - universo); quantidade <= maximo; quantidade++) {
    distribuicao[quantidade] = Math.exp(
      lnCombinacao(tamanho, quantidade) +
        lnCombinacao(universo - tamanho, sorteadas - quantidade) -
        lnCombinacao(universo, sorteadas),
    );
  }
  return distribuicao;
}

/** Variância da quantidade sorteada de um grupo de `tamanho` dezenas (hipergeométrica). */
export function varianciaAcaso(def: LoteriaDefinicao, tamanho: number): number {
  const { universo: n, sorteadas: k } = def;
  return k * (tamanho / n) * ((n - tamanho) / n) * ((n - k) / (n - 1));
}

export type Veredito = 'dentro' | 'acima' | 'abaixo';

/** Dentro da margem do acaso (empate), acima ou abaixo dela. */
export function vereditoDe(observado: number, margem: number, acaso: number): Veredito {
  const diferenca = observado - acaso;
  if (Math.abs(diferenca) <= margem) return 'dentro';
  return diferenca > 0 ? 'acima' : 'abaixo';
}
