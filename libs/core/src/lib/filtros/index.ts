import type { ContextoFiltro, Filtro } from '../tipos';
import { filtroColunas } from './colunas';
import { filtroConsecutivas } from './consecutivas';
import { filtroHistorico } from './historico';
import { filtroLinhas } from './linhas';
import { filtroPares } from './pares';
import { filtroQuadrantes } from './quadrantes';

export { filtroColunas, filtroConsecutivas, filtroHistorico, filtroLinhas, filtroPares, filtroQuadrantes };

/** Todos os filtros conhecidos, na ordem de exibição: quadrantes, colunas, linhas, historico, pares, consecutivas. */
export function filtrosPadrao(): Filtro[] {
  return [filtroQuadrantes, filtroColunas, filtroLinhas, filtroHistorico, filtroPares, filtroConsecutivas];
}

/** Verdadeiro quando existe um filtro com esse id. */
export function filtroExiste(id: string): boolean {
  return filtrosPadrao().some((f) => f.id === id);
}

export function obterFiltro(id: string): Filtro {
  const filtro = filtrosPadrao().find((f) => f.id === id);
  if (!filtro) throw new Error(`Filtro desconhecido: ${id}`);
  return filtro;
}

/**
 * Aplica apenas os filtros cujo id está em `ids` e que são aplicáveis ao jogo.
 * Filtro não aplicável é ignorado (não reprova), assim como id fora de `ctx.def.regrasDisponiveis`.
 */
export function aplicarFiltros(jogo: number[], ctx: ContextoFiltro, ids: string[]): boolean {
  return filtrosPadrao()
    .filter(
      (f) => ids.includes(f.id) && ctx.def.regrasDisponiveis.includes(f.id) && f.aplicavelA(ctx.def, jogo.length),
    )
    .every((f) => f.aceita(jogo, ctx));
}
