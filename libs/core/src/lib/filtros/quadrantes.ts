import type { ContextoFiltro, Filtro, LoteriaDefinicao } from '../tipos';
import { quadrante } from '../volante';

/** Exige pelo menos uma dezena em cada quadrante do volante. */
export const filtroQuadrantes: Filtro = {
  id: 'quadrantes',
  nome: 'Pelo menos uma dezena em cada quadrante',
  padraoLigado: true,
  aplicavelA(def: LoteriaDefinicao, dezenasPorJogo: number): boolean {
    return dezenasPorJogo >= def.quadrantes;
  },
  aceita(jogo: number[], ctx: ContextoFiltro): boolean {
    const cobertos = new Set<number>();
    for (const dezena of jogo) cobertos.add(quadrante(dezena, ctx.def));
    return cobertos.size === ctx.def.quadrantes;
  },
};
