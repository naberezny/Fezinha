import type { Concurso, Historico, LoteriaDefinicao } from '../lib/tipos';

/**
 * Definição usada SOMENTE em testes do core (o core não pode importar libs de loteria).
 * Espelha a Mega-Sena: 60 dezenas, 6 sorteadas, volante 10 × 6.
 */
export const LOTERIA_TESTE: LoteriaDefinicao = {
  id: 'teste60',
  nome: 'Loteria de teste (60/6)',
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

/** Loteria pequena (25/15, volante 5 × 5) para testar regras que mudam com a geometria. */
export const LOTERIA_TESTE_25: LoteriaDefinicao = {
  id: 'teste25',
  nome: 'Loteria de teste (25/15)',
  cor: '#930089',
  universo: 25,
  primeiraDezena: 1,
  sorteadas: 15,
  aposta: { min: 15, max: 20 },
  volante: { colunas: 5, linhas: 5 },
  quadrantes: 4,
  faixas: [{ faixa: 1, acertos: 15, nome: '15 acertos' }],
  diasSorteio: [1, 2, 3, 4, 5, 6],
  regrasDisponiveis: ['quadrantes', 'linhas', 'historico', 'pares', 'consecutivas'],
};

/**
 * Espelho da Lotomania (100/20): dezenas 00..99 (`primeiraDezena: 0`), volante 10 × 10, aposta fixa de 50.
 * Sem `colunas`, `historico` e `consecutivas` nas regras disponíveis (não fazem sentido com 50 dezenas).
 */
export const LOTERIA_TESTE_100: LoteriaDefinicao = {
  id: 'teste100',
  nome: 'Loteria de teste (100/20)',
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
    { faixa: 3, acertos: 0, nome: 'Nenhum acerto' },
  ],
  diasSorteio: [1, 3, 5],
  regrasDisponiveis: ['quadrantes', 'linhas', 'pares'],
};

/** Cria um concurso mínimo para testes. */
export function concursoTeste(numero: number, data: string, dezenas: number[], extra: Partial<Concurso> = {}): Concurso {
  return {
    numero,
    data,
    dezenas: [...dezenas].sort((a, b) => a - b),
    acumulou: true,
    premiacoes: [],
    valorAcumuladoCentavos: 0n,
    estimativaProximoCentavos: 0n,
    arrecadacaoCentavos: 0n,
    acumuladoEspecialCentavos: 0n,
    locaisGanhadores: [],
    ...extra,
  };
}

export function historicoTeste(concursos: Concurso[], loteria: LoteriaDefinicao = LOTERIA_TESTE): Historico {
  return { loteria, concursos: [...concursos].sort((a, b) => a.numero - b.numero) };
}
