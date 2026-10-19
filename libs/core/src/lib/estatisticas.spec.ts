import { concursoTeste, historicoTeste, LOTERIA_TESTE } from '../testes/loteria-teste';
import {
  calcularEstatisticas,
  distribuicaoPares,
  distribuicaoSoma,
  frequenciaPorMes,
  recortarPeriodo,
  resumoPorAno,
} from './estatisticas';
import type { Historico } from './tipos';

/**
 * Histórico pequeno e previsível (4 concursos, 3 meses, 2 anos):
 *  1 | 2025-11-10 | 1 2 3 4 5 6       | acumulou
 *  2 | 2025-12-05 | 1 7 8 9 10 11     | 1 ganhador, 5000
 *  3 | 2026-01-15 | 2 12 13 14 15 16  | 2 ganhadores, 3000 (+ quina ignorada)
 *  4 | 2026-01-20 | 2 17 18 19 20 21  | acumulou
 */
function criarHistorico(): Historico {
  return historicoTeste([
    concursoTeste(1, '2025-11-10', [1, 2, 3, 4, 5, 6]),
    concursoTeste(2, '2025-12-05', [1, 7, 8, 9, 10, 11], {
      acumulou: false,
      premiacoes: [{ faixa: 1, ganhadores: 1, rateioCentavos: 5000n }],
    }),
    concursoTeste(3, '2026-01-15', [2, 12, 13, 14, 15, 16], {
      acumulou: false,
      premiacoes: [
        { faixa: 1, ganhadores: 2, rateioCentavos: 3000n },
        { faixa: 2, ganhadores: 50, rateioCentavos: 9999n },
      ],
    }),
    concursoTeste(4, '2026-01-20', [2, 17, 18, 19, 20, 21]),
  ]);
}

describe('recortarPeriodo', () => {
  it('devolve os últimos N concursos em ordem crescente', () => {
    const historico = criarHistorico();

    const recorte = recortarPeriodo(historico, { tipo: 'ultimos', quantidade: 2 });

    expect(recorte.concursos.map((c) => c.numero)).toEqual([3, 4]);
    expect(recorte.loteria).toBe(historico.loteria);
  });

  it('devolve todos os concursos quando N é maior que o total', () => {
    const recorte = recortarPeriodo(criarHistorico(), { tipo: 'ultimos', quantidade: 100 });

    expect(recorte.concursos.map((c) => c.numero)).toEqual([1, 2, 3, 4]);
  });

  it('devolve vazio quando N é zero', () => {
    const recorte = recortarPeriodo(criarHistorico(), { tipo: 'ultimos', quantidade: 0 });

    expect(recorte.concursos).toEqual([]);
  });

  it('filtra pelo ano da data', () => {
    const recorte = recortarPeriodo(criarHistorico(), { tipo: 'ano', ano: 2025 });

    expect(recorte.concursos.map((c) => c.numero)).toEqual([1, 2]);
  });

  it('devolve vazio para um ano sem concursos', () => {
    const recorte = recortarPeriodo(criarHistorico(), { tipo: 'ano', ano: 1999 });

    expect(recorte.concursos).toEqual([]);
  });

  it('devolve tudo no período "tudo", sem reaproveitar o array de entrada', () => {
    const historico = criarHistorico();

    const recorte = recortarPeriodo(historico, { tipo: 'tudo' });

    expect(recorte.concursos).toEqual(historico.concursos);
    expect(recorte.concursos).not.toBe(historico.concursos);
  });
});

describe('calcularEstatisticas', () => {
  it('devolve uma entrada por dezena de 1 até o universo, ordenada', () => {
    const estatisticas = calcularEstatisticas(criarHistorico(), { tipo: 'tudo' });

    expect(estatisticas).toHaveLength(60);
    expect(estatisticas.map((e) => e.dezena)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
  });

  it('conta a frequência no período recortado', () => {
    const historico = criarHistorico();

    const tudo = calcularEstatisticas(historico, { tipo: 'tudo' });
    const ultimos2 = calcularEstatisticas(historico, { tipo: 'ultimos', quantidade: 2 });
    const ano2025 = calcularEstatisticas(historico, { tipo: 'ano', ano: 2025 });

    expect(tudo[1 - 1].frequencia).toBe(2);
    expect(tudo[2 - 1].frequencia).toBe(3);
    expect(ultimos2[1 - 1].frequencia).toBe(0);
    expect(ultimos2[2 - 1].frequencia).toBe(2);
    expect(ultimos2[12 - 1].frequencia).toBe(1);
    expect(ano2025[1 - 1].frequencia).toBe(2);
    expect(ano2025[2 - 1].frequencia).toBe(1);
  });

  it('calcula atraso 0 para dezena do último concurso', () => {
    const estatisticas = calcularEstatisticas(criarHistorico(), { tipo: 'tudo' });

    expect(estatisticas[2 - 1].atraso).toBe(0);
    expect(estatisticas[21 - 1].atraso).toBe(0);
    expect(estatisticas[2 - 1].ultimoConcurso).toBe(4);
    expect(estatisticas[2 - 1].ultimaData).toBe('2026-01-20');
  });

  it('conta o atraso em concursos desde a última aparição', () => {
    const estatisticas = calcularEstatisticas(criarHistorico(), { tipo: 'tudo' });

    expect(estatisticas[1 - 1].atraso).toBe(2);
    expect(estatisticas[3 - 1].atraso).toBe(3);
    expect(estatisticas[12 - 1].atraso).toBe(1);
    expect(estatisticas[3 - 1].ultimoConcurso).toBe(1);
    expect(estatisticas[3 - 1].ultimaData).toBe('2025-11-10');
  });

  it('usa o histórico inteiro no atraso, independentemente do período', () => {
    const historico = criarHistorico();

    const tudo = calcularEstatisticas(historico, { tipo: 'tudo' });
    const ultimo = calcularEstatisticas(historico, { tipo: 'ultimos', quantidade: 1 });

    expect(ultimo.map((e) => e.atraso)).toEqual(tudo.map((e) => e.atraso));
    expect(ultimo.map((e) => e.atrasoMaximo)).toEqual(tudo.map((e) => e.atrasoMaximo));
    expect(ultimo[1 - 1].frequencia).toBe(0);
  });

  it('trata dezena nunca sorteada: atraso igual ao total e sem último concurso', () => {
    const estatisticas = calcularEstatisticas(criarHistorico(), { tipo: 'tudo' });

    const dezena60 = estatisticas[60 - 1];

    expect(dezena60.frequencia).toBe(0);
    expect(dezena60.atraso).toBe(4);
    expect(dezena60.atrasoMaximo).toBe(4);
    expect(dezena60.ultimoConcurso).toBeUndefined();
    expect(dezena60.ultimaData).toBeUndefined();
  });

  it('inclui o trecho inicial (antes da 1ª aparição) no atraso máximo', () => {
    const estatisticas = calcularEstatisticas(criarHistorico(), { tipo: 'tudo' });

    // dezena 12 só saiu no concurso 3 (índice 2): 2 concursos antes, 1 depois.
    expect(estatisticas[12 - 1].atrasoMaximo).toBe(2);
    // dezena 21 só saiu no último (índice 3): 3 concursos antes, 0 depois.
    expect(estatisticas[21 - 1].atrasoMaximo).toBe(3);
  });

  it('inclui o intervalo entre aparições e o atraso atual no atraso máximo', () => {
    const estatisticas = calcularEstatisticas(criarHistorico(), { tipo: 'tudo' });

    // dezena 1: índices 0 e 1 → intervalos 0, 0 e atraso atual 2.
    expect(estatisticas[1 - 1].atrasoMaximo).toBe(2);
    // dezena 2: índices 0, 2, 3 → intervalos 0, 1, 0 e atraso atual 0.
    expect(estatisticas[2 - 1].atrasoMaximo).toBe(1);
    // dezena 3: índice 0 → atraso atual 3 domina.
    expect(estatisticas[3 - 1].atrasoMaximo).toBe(3);
  });

  it('calcula probAusencia como (1 - sorteadas/universo)^atraso', () => {
    const estatisticas = calcularEstatisticas(criarHistorico(), { tipo: 'tudo' });

    expect(estatisticas[2 - 1].probAusencia).toBeCloseTo(1, 12);
    expect(estatisticas[1 - 1].probAusencia).toBeCloseTo(Math.pow(0.9, 2), 12);
    expect(estatisticas[3 - 1].probAusencia).toBeCloseTo(Math.pow(0.9, 3), 12);
    expect(estatisticas[60 - 1].probAusencia).toBeCloseTo(Math.pow(0.9, 4), 12);
  });

  it('respeita a loteria do histórico (universo e sorteadas)', () => {
    const historico = historicoTeste([concursoTeste(1, '2026-01-01', [1, 2, 3, 4, 5, 6])], {
      ...LOTERIA_TESTE,
      universo: 10,
      sorteadas: 5,
    });

    const estatisticas = calcularEstatisticas(historico, { tipo: 'tudo' });

    expect(estatisticas).toHaveLength(10);
    expect(estatisticas[10 - 1].probAusencia).toBeCloseTo(Math.pow(0.5, 1), 12);
  });

  it('devolve zeros para histórico vazio', () => {
    const estatisticas = calcularEstatisticas(historicoTeste([]), { tipo: 'tudo' });

    expect(estatisticas).toHaveLength(60);
    expect(estatisticas.every((e) => e.frequencia === 0 && e.atraso === 0 && e.atrasoMaximo === 0)).toBe(true);
    expect(estatisticas.every((e) => e.probAusencia === 1)).toBe(true);
  });
});

describe('frequenciaPorMes', () => {
  it('considera apenas os últimos N meses presentes no histórico', () => {
    const linhas = frequenciaPorMes(criarHistorico(), 2);

    expect(new Set(linhas.map((l) => l.anoMes))).toEqual(new Set(['2025-12', '2026-01']));
  });

  it('soma ocorrências da dezena dentro do mês', () => {
    const linhas = frequenciaPorMes(criarHistorico(), 1);

    expect(linhas.find((l) => l.dezena === 2)).toEqual({ anoMes: '2026-01', dezena: 2, total: 2 });
    expect(linhas.find((l) => l.dezena === 12)).toEqual({ anoMes: '2026-01', dezena: 12, total: 1 });
  });

  it('devolve apenas linhas com total maior que zero, ordenadas por mês e dezena', () => {
    const linhas = frequenciaPorMes(criarHistorico(), 12);

    expect(linhas.every((l) => l.total > 0)).toBe(true);
    const ordenadas = [...linhas].sort((a, b) => a.anoMes.localeCompare(b.anoMes) || a.dezena - b.dezena);
    expect(linhas).toEqual(ordenadas);
    expect(linhas.filter((l) => l.anoMes === '2025-11')).toHaveLength(6);
    expect(linhas.filter((l) => l.anoMes === '2025-12')).toHaveLength(6);
    expect(linhas.filter((l) => l.anoMes === '2026-01')).toHaveLength(11);
  });

  it('usa meses distintos presentes no histórico, não meses corridos do calendário', () => {
    const historico = historicoTeste([
      concursoTeste(1, '2025-01-10', [1, 2, 3, 4, 5, 6]),
      concursoTeste(2, '2026-03-10', [7, 8, 9, 10, 11, 12]),
    ]);

    const linhas = frequenciaPorMes(historico, 2);

    expect(new Set(linhas.map((l) => l.anoMes))).toEqual(new Set(['2025-01', '2026-03']));
  });

  it('devolve vazio quando meses é zero ou o histórico é vazio', () => {
    expect(frequenciaPorMes(criarHistorico(), 0)).toEqual([]);
    expect(frequenciaPorMes(historicoTeste([]), 12)).toEqual([]);
  });
});

describe('distribuicaoPares', () => {
  it('devolve uma linha para cada valor de 0 até sorteadas, mesmo com total zero', () => {
    const distribuicao = distribuicaoPares(criarHistorico());

    expect(distribuicao.map((d) => d.pares)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('conta quantos concursos tiveram cada quantidade de pares', () => {
    const distribuicao = distribuicaoPares(criarHistorico());

    // c1: 2,4,6 = 3 | c2: 8,10 = 2 | c3: 2,12,14,16 = 4 | c4: 2,18,20 = 3
    expect(distribuicao.map((d) => d.total)).toEqual([0, 0, 1, 2, 1, 0, 0]);
  });

  it('soma o total de concursos', () => {
    const distribuicao = distribuicaoPares(criarHistorico());

    expect(distribuicao.reduce((soma, d) => soma + d.total, 0)).toBe(4);
  });
});

describe('distribuicaoSoma', () => {
  it('agrupa as somas das dezenas em faixas, só com total maior que zero', () => {
    // somas: 21, 46, 72, 97
    const faixas = distribuicaoSoma(criarHistorico(), 10);

    expect(faixas).toEqual([
      { inicio: 20, total: 1 },
      { inicio: 40, total: 1 },
      { inicio: 70, total: 1 },
      { inicio: 90, total: 1 },
    ]);
  });

  it('acumula concursos na mesma faixa e ordena por início', () => {
    const faixas = distribuicaoSoma(criarHistorico(), 50);

    expect(faixas).toEqual([
      { inicio: 0, total: 2 },
      { inicio: 50, total: 2 },
    ]);
  });

  it('usa o limite inferior inclusivo da faixa', () => {
    // soma = 1+2+3+4+5+10 = 25 → faixa de 5 começa em 25.
    const historico = historicoTeste([concursoTeste(1, '2026-01-01', [1, 2, 3, 4, 5, 10])]);

    expect(distribuicaoSoma(historico, 5)).toEqual([{ inicio: 25, total: 1 }]);
  });
});

describe('resumoPorAno', () => {
  it('agrupa por ano em ordem crescente com concursos e acumulados', () => {
    const resumo = resumoPorAno(criarHistorico());

    expect(resumo.map((r) => r.ano)).toEqual([2025, 2026]);
    expect(resumo.map((r) => r.concursos)).toEqual([2, 2]);
    expect(resumo.map((r) => r.acumulados)).toEqual([1, 1]);
  });

  it('soma ganhadores e pega o maior prêmio apenas da faixa 1', () => {
    const resumo = resumoPorAno(criarHistorico());

    expect(resumo[0]).toMatchObject({ ano: 2025, ganhadores: 1, maiorPremioCentavos: 5000n });
    expect(resumo[1]).toMatchObject({ ano: 2026, ganhadores: 2, maiorPremioCentavos: 3000n });
  });

  it('usa 0n como maior prêmio quando não há premiação da faixa 1', () => {
    const historico = historicoTeste([concursoTeste(1, '2020-05-05', [1, 2, 3, 4, 5, 6])]);

    expect(resumoPorAno(historico)).toEqual([
      { ano: 2020, concursos: 1, acumulados: 1, ganhadores: 0, maiorPremioCentavos: 0n },
    ]);
  });

  it('devolve vazio para histórico vazio', () => {
    expect(resumoPorAno(historicoTeste([]))).toEqual([]);
  });
});

describe('imutabilidade', () => {
  it('não altera o histórico de entrada em nenhuma função', () => {
    const historico = criarHistorico();
    const copia = structuredClone(historico);

    recortarPeriodo(historico, { tipo: 'ultimos', quantidade: 2 });
    calcularEstatisticas(historico, { tipo: 'tudo' });
    frequenciaPorMes(historico, 12);
    distribuicaoPares(historico);
    distribuicaoSoma(historico, 10);
    resumoPorAno(historico);

    expect(historico).toEqual(copia);
  });
});
