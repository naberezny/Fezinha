import type { LoteriaDefinicao } from '@sorteios/core';

/**
 * Lotomania: 20 dezenas sorteadas de 100 (00 a 99); a aposta é sempre de 50 dezenas;
 * volante 10 × 10; sorteios às segundas, quartas e sextas. Premia 20, 19, 18, 17, 16, 15 e 0 acertos.
 *
 * Regras do volante disponíveis: com 50 dezenas em 100, "nunca na mesma coluna" nunca se aplica
 * (50 > 10 colunas), "no máximo 3 consecutivas" reprovaria quase todo jogo e "nunca repetir
 * resultado" não faz sentido (aposta de 50 ≠ 20 sorteadas); por isso ficam fora.
 */
export const LOTOMANIA: LoteriaDefinicao = {
  id: 'lotomania',
  nome: 'Lotomania',
  cor: '#f78100',
  universo: 100,
  primeiraDezena: 0,
  sorteadas: 20,
  aposta: { min: 50, max: 50 },
  volante: { colunas: 10, linhas: 10 },
  quadrantes: 4,
  faixas: [
    { faixa: 1, acertos: 20, nome: '20 acertos' },
    { faixa: 2, acertos: 19, nome: '19 acertos' },
    { faixa: 3, acertos: 18, nome: '18 acertos' },
    { faixa: 4, acertos: 17, nome: '17 acertos' },
    { faixa: 5, acertos: 16, nome: '16 acertos' },
    { faixa: 6, acertos: 15, nome: '15 acertos' },
    { faixa: 7, acertos: 0, nome: 'Nenhum acerto' },
  ],
  diasSorteio: [1, 3, 5],
  regrasDisponiveis: ['quadrantes', 'linhas', 'pares'],
};
