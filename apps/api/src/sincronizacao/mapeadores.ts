import type { Concurso } from '@sorteios/core';
import { mapearRespostaCaixaLotomania } from '@sorteios/loterias/lotomania';
import { mapearRespostaCaixa } from '@sorteios/loterias/mega-sena';

/** Converte a resposta JSON da Caixa em `Concurso`; lança erro descritivo se o formato for inesperado. */
export type MapeadorCaixa = (json: unknown) => Concurso;

/** Um mapeador por loteria (chave = id da loteria, que também é o segmento da URL da Caixa). */
export const mapeadoresPorLoteria: Record<string, MapeadorCaixa> = {
  megasena: mapearRespostaCaixa,
  lotomania: mapearRespostaCaixaLotomania,
};
