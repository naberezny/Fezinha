import type { ContextoFiltro, Filtro } from '../tipos';

const MAXIMO_SEQUENCIA = 3;

/** Reprova sequências de 4 ou mais dezenas consecutivas (jogo em ordem crescente). */
export const filtroConsecutivas: Filtro = {
  id: 'consecutivas',
  nome: 'No máximo 3 dezenas consecutivas',
  padraoLigado: true,
  aplicavelA(): boolean {
    return true;
  },
  aceita(jogo: number[], _ctx: ContextoFiltro): boolean {
    let sequencia = 1;
    for (let i = 1; i < jogo.length; i++) {
      sequencia = jogo[i] === jogo[i - 1] + 1 ? sequencia + 1 : 1;
      if (sequencia > MAXIMO_SEQUENCIA) return false;
    }
    return true;
  },
};
