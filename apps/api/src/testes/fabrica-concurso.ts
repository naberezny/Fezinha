import type { Concurso } from '@sorteios/core';

/** Concurso mínimo e válido para testes; qualquer campo pode ser sobrescrito. */
export function criarConcurso(
  numero: number,
  sobrescrever: Partial<Concurso> = {},
): Concurso {
  return {
    numero,
    data: '2026-01-01',
    dezenas: [1, 2, 3, 4, 5, 6],
    acumulou: false,
    premiacoes: [
      { faixa: 1, ganhadores: 1, rateioCentavos: 5_000_000_00n },
      { faixa: 2, ganhadores: 10, rateioCentavos: 50_000_00n },
      { faixa: 3, ganhadores: 100, rateioCentavos: 1_000_00n },
    ],
    valorAcumuladoCentavos: 0n,
    estimativaProximoCentavos: 3_000_000_00n,
    arrecadacaoCentavos: 10_000_000_00n,
    acumuladoEspecialCentavos: 0n,
    observacao: undefined,
    locaisGanhadores: [
      { cidade: 'DOURADOS', uf: 'MS', descricao: 'DOURADOS/MS', quantidade: 1 },
    ],
    ...sobrescrever,
  };
}
