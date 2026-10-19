import type { ContextoFiltro, Filtro, LoteriaDefinicao } from '../tipos';
import { chaveJogo } from '../tipos';

/** Reprova jogos idênticos a um resultado já sorteado. */
export const filtroHistorico: Filtro = {
  id: 'historico',
  nome: 'Nunca repetir um resultado já sorteado',
  padraoLigado: true,
  aplicavelA(def: LoteriaDefinicao, dezenasPorJogo: number): boolean {
    return dezenasPorJogo === def.sorteadas;
  },
  aceita(jogo: number[], ctx: ContextoFiltro): boolean {
    return !ctx.historico.has(chaveJogo(jogo));
  },
};
