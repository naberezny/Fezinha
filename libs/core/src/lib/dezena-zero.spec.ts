import { concursoTeste, historicoTeste, LOTERIA_TESTE, LOTERIA_TESTE_100 } from '../testes/loteria-teste';
import { calcularEstatisticas, distribuicaoPares, recortarPeriodo } from './estatisticas';
import { aplicarFiltros, filtroColunas, filtroConsecutivas, filtroLinhas, filtroPares, filtroQuadrantes } from './filtros';
import { gerarJogos } from './geracao';
import { calcularPesos } from './pesos';
import { criarRng } from './rng';
import { compararDezenas, dezenaNaOrdem, dezenasDe, dezenaValida, formatarDezena, ordemNoVolante, ultimaDezena } from './tipos';
import type { ConfiguracaoGeracao, ContextoFiltro, EstatisticaDezena, Historico } from './tipos';
import { apostasEquivalentes, coluna, linha, quadrante } from './volante';

/**
 * Suíte da loteria com a dezena 00 (espelho da Lotomania: 00..99, 20 sorteadas, aposta fixa de 50).
 * Garante que nenhuma parte do core assume que a primeira dezena é 1.
 */

const def = LOTERIA_TESTE_100;

/** Dezenas `inicio..inicio+19` (20 dezenas, como um sorteio da Lotomania). */
function sorteio(inicio: number): number[] {
  return Array.from({ length: 20 }, (_, i) => inicio + i);
}

/**
 *  1 | 2026-01-05 | 00..19
 *  2 | 2026-01-07 | 01..20
 *  3 | 2026-01-09 | 02..21
 */
function criarHistorico(): Historico {
  return historicoTeste(
    [
      concursoTeste(1, '2026-01-05', sorteio(0)),
      concursoTeste(2, '2026-01-07', sorteio(1)),
      concursoTeste(3, '2026-01-09', sorteio(2)),
    ],
    def,
  );
}

function configuracao(parcial: Partial<ConfiguracaoGeracao> = {}): ConfiguracaoGeracao {
  return {
    estrategia: 'aleatorio',
    quantidadeJogos: 5,
    dezenasPorJogo: 50,
    fixas: [],
    atrasadas: { atrasoMinimo: 5, intensidade: 2 },
    frequentes: { periodo: { tipo: 'tudo' } },
    regras: {},
    ...parcial,
  };
}

function contexto(): ContextoFiltro {
  return { def, historico: new Set() };
}

/** Ordem do volante da Lotomania: 01..99 e o 00 por último. */
const ORDEM_VOLANTE = [...Array.from({ length: 99 }, (_, i) => i + 1), 0];

function daDezena(estatisticas: EstatisticaDezena[], dezena: number): EstatisticaDezena {
  return estatisticas.find((e) => e.dezena === dezena)!;
}

describe('helpers de dezena (primeiraDezena 0)', () => {
  it('dezenasDe segue o volante (01..99, 00 por último) e ultimaDezena é 99', () => {
    expect(dezenasDe(def)).toEqual(ORDEM_VOLANTE);
    expect(ultimaDezena(def)).toBe(99);
  });

  it('ordemNoVolante põe o 00 na casa 100 e dezenaNaOrdem é o inverso', () => {
    expect(ordemNoVolante(1, def)).toBe(1);
    expect(ordemNoVolante(99, def)).toBe(99);
    expect(ordemNoVolante(0, def)).toBe(100);
    expect(dezenaNaOrdem(100, def)).toBe(0);
    expect(dezenaNaOrdem(1, def)).toBe(1);
    expect(dezenaNaOrdem(60, LOTERIA_TESTE)).toBe(60);
  });

  it('compararDezenas ordena com o 00 por último na Lotomania e numericamente na Mega-Sena', () => {
    expect([0, 50, 1, 99].sort(compararDezenas(def))).toEqual([1, 50, 99, 0]);
    expect([60, 1, 30].sort(compararDezenas(LOTERIA_TESTE))).toEqual([1, 30, 60]);
  });

  it('dezenaValida aceita 0 e 99 e rejeita 100, -1 e fracionários', () => {
    expect(dezenaValida(0, def)).toBe(true);
    expect(dezenaValida(99, def)).toBe(true);
    expect(dezenaValida(100, def)).toBe(false);
    expect(dezenaValida(-1, def)).toBe(false);
    expect(dezenaValida(1.5, def)).toBe(false);
  });

  it('na Mega-Sena (primeiraDezena 1) o zero continua inválido', () => {
    expect(dezenaValida(0, LOTERIA_TESTE)).toBe(false);
    expect(dezenaValida(60, LOTERIA_TESTE)).toBe(true);
    expect(ultimaDezena(LOTERIA_TESTE)).toBe(60);
  });

  it('formatarDezena usa 2 dígitos', () => {
    expect(formatarDezena(0)).toBe('00');
    expect(formatarDezena(7)).toBe('07');
    expect(formatarDezena(99)).toBe('99');
  });
});

describe('estatísticas com a dezena 00', () => {
  it('devolve uma entrada por dezena, na ordem do volante (01..99, 00)', () => {
    const estatisticas = calcularEstatisticas(criarHistorico(), { tipo: 'tudo' });

    expect(estatisticas).toHaveLength(100);
    expect(estatisticas.map((e) => e.dezena)).toEqual(ORDEM_VOLANTE);
  });

  it('frequência, atraso e último concurso da dezena 00', () => {
    const estatisticas = calcularEstatisticas(criarHistorico(), { tipo: 'tudo' });
    const zero = daDezena(estatisticas, 0);

    expect(zero.frequencia).toBe(1);
    expect(zero.atraso).toBe(2);
    expect(zero.atrasoMaximo).toBe(2);
    expect(zero.ultimoConcurso).toBe(1);
    expect(zero.ultimaData).toBe('2026-01-05');
  });

  it('probAusencia é 0,8 ^ atraso (1 - 20/100)', () => {
    const estatisticas = calcularEstatisticas(criarHistorico(), { tipo: 'tudo' });

    expect(daDezena(estatisticas, 0).probAusencia).toBeCloseTo(Math.pow(0.8, 2), 12);
    expect(daDezena(estatisticas, 99).probAusencia).toBeCloseTo(Math.pow(0.8, 3), 12);
    expect(daDezena(estatisticas, 21).probAusencia).toBe(1);
  });

  it('dezena que nunca saiu tem atraso igual ao total de concursos e sem último concurso', () => {
    const nunca = daDezena(calcularEstatisticas(criarHistorico(), { tipo: 'tudo' }), 99);

    expect(nunca.frequencia).toBe(0);
    expect(nunca.atraso).toBe(3);
    expect(nunca.atrasoMaximo).toBe(3);
    expect(nunca.ultimoConcurso).toBeUndefined();
  });

  it('dezena 00 que saiu no último concurso tem atraso 0 e o recorte do período afeta só a frequência', () => {
    const historico = historicoTeste(
      [concursoTeste(1, '2026-01-05', sorteio(1)), concursoTeste(2, '2026-01-07', sorteio(0))],
      def,
    );

    const tudo = daDezena(calcularEstatisticas(historico, { tipo: 'tudo' }), 0);
    const ultimo = daDezena(calcularEstatisticas(historico, { tipo: 'ultimos', quantidade: 1 }), 0);
    const semZero = daDezena(calcularEstatisticas(historico, { tipo: 'ultimos', quantidade: 0 }), 0);

    expect(tudo.atraso).toBe(0);
    expect(tudo.frequencia).toBe(1);
    expect(tudo.atrasoMaximo).toBe(1);
    expect(ultimo.frequencia).toBe(1);
    expect(semZero.frequencia).toBe(0);
    expect(semZero.atraso).toBe(0);
    expect(recortarPeriodo(historico, { tipo: 'ultimos', quantidade: 1 }).concursos).toHaveLength(1);
  });

  it('a dezena 00 conta como par na distribuição de pares', () => {
    // 00..19 tem 10 pares; 01..20 tem 10 pares; 02..21 tem 10 pares
    const distribuicao = distribuicaoPares(criarHistorico());

    expect(distribuicao).toHaveLength(21);
    expect(distribuicao[10]).toEqual({ pares: 10, total: 3 });
  });
});

describe('pesos com a dezena 00', () => {
  function lista(): EstatisticaDezena[] {
    return calcularEstatisticas(criarHistorico(), { tipo: 'tudo' });
  }

  it('devolve um peso para cada dezena de 0 a 99', () => {
    const estatisticas = lista();

    const pesos = calcularPesos(estatisticas, estatisticas, configuracao(), def);

    expect([...pesos.keys()]).toEqual(ORDEM_VOLANTE);
    expect(pesos.get(0)).toBe(1);
  });

  it('a dezena 00 participa do atraso máximo e da normalização da estratégia mista', () => {
    const estatisticas = lista();

    const pesos = calcularPesos(estatisticas, estatisticas, configuracao({ estrategia: 'mista' }), def);

    // dezena 0: atraso 2, frequência 1; maiorAtraso = 3 (nunca saiu), maiorFrequencia = 3 (dezenas 2..19)
    expect(pesos.get(0)).toBeCloseTo(Math.sqrt((2 / 3) * (1 / 3)) + 0.05, 12);
  });

  it('lança erro citando a dezena 00 quando falta nas estatísticas', () => {
    const semZero = lista().filter((e) => e.dezena !== 0);

    expect(() => calcularPesos(semZero, semZero, configuracao(), def)).toThrow(/falta a dezena 0 \(esperado 0\.\.99\)/);
  });
});

describe('volante 10 × 10 com a dezena 00 (01..99, 00 por último, como no bilhete)', () => {
  it('01 fica na coluna 0, linha 0, quadrante 0', () => {
    expect(coluna(1, def)).toBe(0);
    expect(linha(1, def)).toBe(0);
    expect(quadrante(1, def)).toBe(0);
  });

  it('10 fecha a primeira linha, no quadrante 1 (superior direito)', () => {
    expect(coluna(10, def)).toBe(9);
    expect(linha(10, def)).toBe(0);
    expect(quadrante(10, def)).toBe(1);
  });

  it('00 é a última casa: coluna 9, linha 9, quadrante 3 (inferior direito)', () => {
    expect(coluna(0, def)).toBe(9);
    expect(linha(0, def)).toBe(9);
    expect(quadrante(0, def)).toBe(3);
  });

  it('99 fica na linha 9, coluna 8 e no quadrante 3', () => {
    expect(linha(99, def)).toBe(9);
    expect(coluna(99, def)).toBe(8);
    expect(quadrante(99, def)).toBe(3);
  });

  it('55 fica na linha 5, coluna 4 e no quadrante 2; 50 fecha a linha 4, no quadrante 1', () => {
    expect(linha(55, def)).toBe(5);
    expect(coluna(55, def)).toBe(4);
    expect(quadrante(55, def)).toBe(2);
    expect(quadrante(50, def)).toBe(1);
  });

  it('91 fica no quadrante 2 (inferior esquerdo) e 45 no quadrante 0', () => {
    expect(quadrante(91, def)).toBe(2);
    expect(quadrante(45, def)).toBe(0);
  });

  it('na Mega-Sena o volante continua começando em 1 (01 → coluna 0, linha 0; 60 → coluna 9, linha 5)', () => {
    expect(coluna(1, LOTERIA_TESTE)).toBe(0);
    expect(linha(1, LOTERIA_TESTE)).toBe(0);
    expect(coluna(60, LOTERIA_TESTE)).toBe(9);
    expect(linha(60, LOTERIA_TESTE)).toBe(5);
  });

  it('50 dezenas equivalem a C(50, 20) apostas simples', () => {
    expect(apostasEquivalentes(50, def)).toBe(47129212243960);
  });
});

describe('filtros na loteria 100/20', () => {
  it('pares: a dezena 00 conta como par', () => {
    // 0..49 → 25 pares; sem pares excessivos
    const jogo = Array.from({ length: 50 }, (_, i) => i);

    expect(filtroPares.aceita(jogo, contexto())).toBe(true);
    // só ímpares + um zero: 1 par entre 50 → reprova (mínimo floor(50/3) = 16)
    const quaseSoImpares = [0, ...Array.from({ length: 49 }, (_, i) => 2 * i + 1)];
    expect(filtroPares.aceita(quaseSoImpares, contexto())).toBe(false);
  });

  it('quadrantes: aceita jogo com a dezena 00 cobrindo o quadrante 3 e reprova sem ele', () => {
    expect(filtroQuadrantes.aceita([1, 10, 91, 0], contexto())).toBe(true);
    expect(filtroQuadrantes.aceita([1, 10, 91, 2], contexto())).toBe(false);
  });

  it('colunas não é aplicável com 50 dezenas (50 > 10 colunas)', () => {
    expect(filtroColunas.aplicavelA(def, 50)).toBe(false);
  });

  it('linhas não é aplicável com 50 dezenas (3 × 10 linhas = 30 < 50), mas é com 30', () => {
    expect(filtroLinhas.aplicavelA(def, 50)).toBe(false);
    expect(filtroLinhas.aplicavelA(def, 30)).toBe(true);
  });

  it('linhas usa a última linha (91..99, 00) para a dezena 00', () => {
    expect(filtroLinhas.aceita([0, 91, 92, 93], contexto())).toBe(false);
    expect(filtroLinhas.aceita([0, 1, 2, 3], contexto())).toBe(true);
  });

  it('aplicarFiltros ignora ids fora de regrasDisponiveis (consecutivas, colunas, historico)', () => {
    const jogo = Array.from({ length: 50 }, (_, i) => i); // 50 consecutivas: reprovaria em `consecutivas`

    expect(filtroConsecutivas.aceita(jogo, contexto())).toBe(false);
    expect(aplicarFiltros(jogo, contexto(), ['consecutivas'])).toBe(true);
    expect(aplicarFiltros(jogo, contexto(), ['colunas', 'historico'])).toBe(true);
  });

  it('aplicarFiltros ainda aplica um id disponível', () => {
    const quaseSoImpares = [0, ...Array.from({ length: 49 }, (_, i) => 2 * i + 1)];

    expect(aplicarFiltros(quaseSoImpares, contexto(), ['pares'])).toBe(false);
  });
});

describe('geração de 50 dezenas em 100 (aposta fixa)', () => {
  it('a aposta é sempre de 50 dezenas (min === max === 50)', () => {
    expect(def.aposta.min).toBe(50);
    expect(def.aposta.max).toBe(50);
  });

  it('gera jogos com 50 dezenas distintas, todas em 0..99, na ordem do volante (00 por último)', () => {
    const resultado = gerarJogos(criarHistorico(), configuracao({ quantidadeJogos: 8 }), criarRng(42));

    expect(resultado.jogos).toHaveLength(8);
    expect(resultado.incompleto).toBe(false);
    for (const jogo of resultado.jogos) {
      expect(jogo.dezenas).toHaveLength(50);
      expect(new Set(jogo.dezenas).size).toBe(50);
      expect(jogo.dezenas.every((d) => Number.isInteger(d) && d >= 0 && d <= 99)).toBe(true);
      expect(jogo.dezenas).toEqual([...jogo.dezenas].sort(compararDezenas(def)));
    }
  });

  it('é determinístico para a mesma semente', () => {
    const a = gerarJogos(criarHistorico(), configuracao(), criarRng(7));
    const b = gerarJogos(criarHistorico(), configuracao(), criarRng(7));

    expect(a).toEqual(b);
  });

  it('a dezena 00 aparece em algum jogo quando o sorteio é livre', () => {
    const { jogos } = gerarJogos(criarHistorico(), configuracao({ quantidadeJogos: 30 }), criarRng(3));

    expect(jogos.some((j) => j.dezenas.includes(0))).toBe(true);
  });

  it('as 4 estratégias funcionam com a dezena 00 no universo', () => {
    for (const estrategia of ['atrasadas', 'frequentes', 'mista', 'aleatorio'] as const) {
      const { jogos } = gerarJogos(criarHistorico(), configuracao({ estrategia, quantidadeJogos: 3 }), criarRng(11));

      expect(jogos).toHaveLength(3);
      for (const jogo of jogos) expect(jogo.dezenas.every((d) => d >= 0 && d <= 99)).toBe(true);
    }
  });

  it('com quadrantes ligado, todo jogo cobre os 4 quadrantes e calcula pares e atraso com a dezena 00', () => {
    const { jogos } = gerarJogos(
      criarHistorico(),
      configuracao({ regras: { quadrantes: true, pares: true }, quantidadeJogos: 6 }),
      criarRng(5),
    );

    expect(jogos).toHaveLength(6);
    for (const jogo of jogos) {
      expect(jogo.quadrantes).toBe(4);
      expect(jogo.pares).toBe(jogo.dezenas.filter((d) => d % 2 === 0).length);
      expect(jogo.pares).toBeGreaterThanOrEqual(16);
      expect(jogo.pares).toBeLessThanOrEqual(34);
    }
  });

  it('aceita a dezena 00 como fixa e a inclui em todos os jogos', () => {
    const { jogos } = gerarJogos(criarHistorico(), configuracao({ fixas: [0, 99], quantidadeJogos: 5 }), criarRng(9));

    expect(jogos).toHaveLength(5);
    for (const jogo of jogos) {
      expect(jogo.dezenas[48]).toBe(99);
      expect(jogo.dezenas[49]).toBe(0);
    }
  });

  it('rejeita fixa 100 e fixa negativa com mensagem 0..99', () => {
    expect(() => gerarJogos(criarHistorico(), configuracao({ fixas: [100] }), criarRng(1))).toThrow(
      /Dezena fixa inválida: 100 \(esperado 0\.\.99\)/,
    );
    expect(() => gerarJogos(criarHistorico(), configuracao({ fixas: [-1] }), criarRng(1))).toThrow(/Dezena fixa inválida/);
  });

  it('rejeita dezenasPorJogo diferente de 50', () => {
    expect(() => gerarJogos(criarHistorico(), configuracao({ dezenasPorJogo: 49 }), criarRng(1))).toThrow(/entre 50 e 50/);
    expect(() => gerarJogos(criarHistorico(), configuracao({ dezenasPorJogo: 51 }), criarRng(1))).toThrow(/entre 50 e 50/);
  });

  it('regras fora de regrasDisponiveis (consecutivas, colunas, historico) ligadas são ignoradas, não reprovam nem lançam erro', () => {
    const base = gerarJogos(criarHistorico(), configuracao({ quantidadeJogos: 4 }), criarRng(21));
    const comRegrasIgnoradas = gerarJogos(
      criarHistorico(),
      configuracao({ quantidadeJogos: 4, regras: { consecutivas: true, colunas: true, historico: true } }),
      criarRng(21),
    );

    expect(comRegrasIgnoradas.incompleto).toBe(false);
    expect(comRegrasIgnoradas).toEqual(base);
  });

  it('regra que não é filtro nenhum continua lançando erro', () => {
    expect(() => gerarJogos(criarHistorico(), configuracao({ regras: { inexistente: true } }), criarRng(1))).toThrow(
      'Regra desconhecida: inexistente',
    );
  });

  it('linhas ligada com 50 dezenas é ignorada (inaplicável) em vez de reprovar tudo', () => {
    const { jogos, incompleto } = gerarJogos(
      criarHistorico(),
      configuracao({ regras: { linhas: true }, quantidadeJogos: 3 }),
      criarRng(2),
    );

    expect(incompleto).toBe(false);
    expect(jogos).toHaveLength(3);
  });
});
