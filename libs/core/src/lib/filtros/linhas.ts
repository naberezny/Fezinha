import type { ContextoFiltro, Filtro, LoteriaDefinicao } from '../tipos';
import { linha } from '../volante';

const MAXIMO_POR_LINHA = 3;

/**
 * No máximo 3 dezenas na mesma linha do volante.
 * Só se aplica quando o limite é satisfazível: o jogo cabe em `3 × linhas` (ex.: 50 dezenas num volante 10 × 10
 * não cabem, e o filtro reprovaria todo jogo; nesse caso ele é ignorado).
 */
export const filtroLinhas: Filtro = {
  id: 'linhas',
  nome: 'No máximo 3 dezenas na mesma linha',
  padraoLigado: false,
  aplicavelA(def: LoteriaDefinicao, dezenasPorJogo: number): boolean {
    return def.volante.colunas > MAXIMO_POR_LINHA && dezenasPorJogo <= MAXIMO_POR_LINHA * def.volante.linhas;
  },
  aceita(jogo: number[], ctx: ContextoFiltro): boolean {
    const contagem = new Map<number, number>();
    for (const dezena of jogo) {
      const l = linha(dezena, ctx.def);
      const total = (contagem.get(l) ?? 0) + 1;
      if (total > MAXIMO_POR_LINHA) return false;
      contagem.set(l, total);
    }
    return true;
  },
};
