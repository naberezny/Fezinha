import type { ContextoFiltro, Filtro } from '../tipos';

/** Quantidade de pares entre floor(k/3) e k - floor(k/3), inclusive. */
export const filtroPares: Filtro = {
  id: 'pares',
  nome: 'Equilíbrio entre pares e ímpares',
  padraoLigado: true,
  aplicavelA(): boolean {
    return true;
  },
  aceita(jogo: number[], _ctx: ContextoFiltro): boolean {
    const k = jogo.length;
    const minimo = Math.floor(k / 3);
    const pares = jogo.filter((dezena) => dezena % 2 === 0).length;
    return pares >= minimo && pares <= k - minimo;
  },
};
