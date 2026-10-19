import type { LoteriaDefinicao } from '@sorteios/core';

/** Mega-Sena: 6 dezenas sorteadas de 60; aposta de 6 a 20 dezenas; volante 10 × 6; terça, quinta e sábado. */
export const MEGA_SENA: LoteriaDefinicao = {
  id: 'megasena',
  nome: 'Mega-Sena',
  cor: '#209869',
  universo: 60,
  primeiraDezena: 1,
  sorteadas: 6,
  aposta: { min: 6, max: 20 },
  volante: { colunas: 10, linhas: 6 },
  quadrantes: 4,
  faixas: [
    { faixa: 1, acertos: 6, nome: 'Sena' },
    { faixa: 2, acertos: 5, nome: 'Quina' },
    { faixa: 3, acertos: 4, nome: 'Quadra' },
  ],
  diasSorteio: [2, 4, 6],
  regrasDisponiveis: ['quadrantes', 'colunas', 'linhas', 'historico', 'pares', 'consecutivas'],
};
