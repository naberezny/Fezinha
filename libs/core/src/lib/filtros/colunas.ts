import type { ContextoFiltro, Filtro, LoteriaDefinicao } from '../tipos';
import { coluna } from '../volante';

/** Nenhuma coluna do volante pode ter mais de uma dezena. */
export const filtroColunas: Filtro = {
  id: 'colunas',
  nome: 'Dezenas nunca na mesma coluna',
  padraoLigado: true,
  aplicavelA(def: LoteriaDefinicao, dezenasPorJogo: number): boolean {
    return dezenasPorJogo <= def.volante.colunas;
  },
  aceita(jogo: number[], ctx: ContextoFiltro): boolean {
    const usadas = new Set<number>();
    for (const dezena of jogo) {
      const c = coluna(dezena, ctx.def);
      if (usadas.has(c)) return false;
      usadas.add(c);
    }
    return true;
  },
};
