import type { LoteriaDefinicao } from '@sorteios/core';

/**
 * Lotofácil: 15 dezenas sorteadas de 25 (01 a 25); aposta de 15 a 20 dezenas; volante 5 × 5.
 * Premia 15, 14, 13, 12 e 11 acertos.
 *
 * Sorteios: segunda a sexta e mais um no fim de semana. Desde junho de 2026 a Caixa alterna sábado e domingo
 * (e pula feriados), por isso `diasSorteio` lista os 7 dias; a data exata do próximo vem da API da Caixa.
 *
 * Sem regras do volante nem filtros estatísticos: sorteando 15 de 25, quase todo jogo já passa em todos. Medido em
 * 200 mil jogos ao acaso, "quadrantes", "pares" e "nunca repetir resultado" juntos descartam só 3,5% dos jogos de 15
 * dezenas e menos de 1% dos de 17 ou mais; nenhum resultado da Lotofácil se repetiu em 3.807 concursos. As demais
 * regras reprovam os próprios resultados reais: "no máximo 3 consecutivas" só aceita 13% deles, "no máximo 3 por
 * linha" 2,8%, e "colunas" não cabe (15 dezenas em 5 colunas). Sem a regra "quadrantes", o volante também não
 * mostra as divisórias.
 */
export const LOTOFACIL: LoteriaDefinicao = {
  id: 'lotofacil',
  nome: 'Lotofácil',
  cor: '#930089',
  universo: 25,
  primeiraDezena: 1,
  sorteadas: 15,
  aposta: { min: 15, max: 20 },
  volante: { colunas: 5, linhas: 5 },
  quadrantes: 4,
  faixas: [
    { faixa: 1, acertos: 15, nome: '15 acertos' },
    { faixa: 2, acertos: 14, nome: '14 acertos' },
    { faixa: 3, acertos: 13, nome: '13 acertos' },
    { faixa: 4, acertos: 12, nome: '12 acertos' },
    { faixa: 5, acertos: 11, nome: '11 acertos' },
  ],
  diasSorteio: [0, 1, 2, 3, 4, 5, 6],
  regrasDisponiveis: [],
};
