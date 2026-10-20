import { concursoTeste, historicoTeste, LOTERIA_TESTE, LOTERIA_TESTE_100 } from '../testes/loteria-teste';
import { criarRng } from './rng';
import { acasoDoJogo, ESTRATEGIAS_TESTADAS, executarTesteEstrategias, testarEstrategias } from './teste-estrategias';
import type { Historico } from './tipos';

/** Histórico sorteado com semente fixa: `quantidade` concursos de 6 dezenas em 1..60. */
function historicoSorteado(quantidade: number): Historico {
  const rng = criarRng(42);
  const concursos = Array.from({ length: quantidade }, (_, i) => {
    const dezenas = new Set<number>();
    while (dezenas.size < 6) dezenas.add(1 + Math.floor(rng() * 60));
    return concursoTeste(i + 1, '2026-01-01', [...dezenas]);
  });
  return historicoTeste(concursos);
}

const soma = (valores: number[]) => valores.reduce((a, b) => a + b, 0);

describe('acasoDoJogo', () => {
  it('jogo de 6 em 60/6: média 0,6 acerto e chance de quadra ou mais de 0,0435%', () => {
    // Act
    const acaso = acasoDoJogo(LOTERIA_TESTE, 6);

    // Assert
    expect(acaso.mediaAcertos).toBeCloseTo(0.6, 10);
    expect(soma(acaso.distribuicao)).toBeCloseTo(1, 10);
    expect(acaso.distribuicao).toHaveLength(7);
    expect(acaso.distribuicao[6]).toBeCloseTo(1 / 50_063_860, 15);
    expect(acaso.probPremio).toBeCloseTo((15 * 1431 + 6 * 54 + 1) / 50_063_860, 12);
  });

  it('na loteria 100/20 com aposta de 50 a faixa de 0 acertos também conta como prêmio', () => {
    // Act
    const acaso = acasoDoJogo(LOTERIA_TESTE_100, 50);

    // Assert
    expect(acaso.mediaAcertos).toBe(10);
    expect(acaso.distribuicao).toHaveLength(21);
    expect(acaso.distribuicao[0]).toBeGreaterThan(0);
    expect(acaso.probPremio).toBeCloseTo(acaso.distribuicao[0] + acaso.distribuicao[19] + acaso.distribuicao[20], 15);
  });
});

describe('testarEstrategias', () => {
  it('testa os últimos N concursos com todas as estratégias e contabiliza cada jogo', () => {
    // Arrange
    const historico = historicoSorteado(120);

    // Act
    const resultado = testarEstrategias(historico, { concursos: 40, dezenasPorJogo: 6, jogosPorConcurso: 3 });

    // Assert
    expect(resultado.concursosTestados).toBe(40);
    expect(resultado.primeiroConcurso).toBe(81);
    expect(resultado.ultimoConcurso).toBe(120);
    expect(resultado.estrategias.map((e) => e.estrategia)).toEqual([...ESTRATEGIAS_TESTADAS]);
    for (const estrategia of resultado.estrategias) {
      expect(estrategia.jogos).toBe(120);
      expect(soma(estrategia.distribuicao)).toBe(120);
      const acertos = soma(estrategia.distribuicao.map((jogos, quantidade) => jogos * quantidade));
      expect(estrategia.mediaAcertos).toBeCloseTo(acertos / 120, 10);
      expect(estrategia.margem).toBeGreaterThan(0);
    }
  });

  it('a mesma semente repete o resultado; outra semente muda os jogos', () => {
    // Arrange
    const historico = historicoSorteado(80);
    const opcoes = { concursos: 30, dezenasPorJogo: 6 };

    // Act
    const primeiro = testarEstrategias(historico, { ...opcoes, semente: 7 });
    const repetido = testarEstrategias(historico, { ...opcoes, semente: 7 });
    const outro = testarEstrategias(historico, { ...opcoes, semente: 8 });

    // Assert
    expect(repetido).toEqual(primeiro);
    expect(outro.estrategias.map((e) => e.distribuicao)).not.toEqual(primeiro.estrategias.map((e) => e.distribuicao));
  });

  it('pedir mais concursos do que existem testa o histórico inteiro; zero não testa nenhum', () => {
    // Arrange
    const historico = historicoSorteado(10);

    // Act
    const todos = testarEstrategias(historico, { concursos: 500, dezenasPorJogo: 6, jogosPorConcurso: 1 });
    const nenhum = testarEstrategias(historico, { concursos: 0, dezenasPorJogo: 6 });

    // Assert
    expect(todos.concursosTestados).toBe(10);
    expect(todos.primeiroConcurso).toBe(1);
    expect(nenhum.concursosTestados).toBe(0);
    expect(nenhum.primeiroConcurso).toBeUndefined();
    expect(nenhum.estrategias.every((e) => e.jogos === 0 && e.mediaAcertos === 0 && e.margem === 0)).toBe(true);
  });

  it('jogos com mais dezenas que as sorteadas limitam os acertos às sorteadas', () => {
    // Arrange
    const historico = historicoSorteado(30);

    // Act
    const resultado = testarEstrategias(historico, { concursos: 10, dezenasPorJogo: 20, jogosPorConcurso: 2 });

    // Assert
    expect(resultado.acaso.mediaAcertos).toBe(2);
    for (const estrategia of resultado.estrategias) expect(estrategia.distribuicao).toHaveLength(7);
  });

  it('dezenas por jogo fora da aposta da loteria gera erro', () => {
    // Arrange
    const historico = historicoSorteado(5);

    // Act
    const executar = () => testarEstrategias(historico, { concursos: 5, dezenasPorJogo: 5 });

    // Assert
    expect(executar).toThrow(/dezenasPorJogo deve ser um inteiro entre 6 e 20/);
  });
});

describe('executarTesteEstrategias', () => {
  it('devolve o progresso crescente entre 0 e 1 antes do resultado', () => {
    // Arrange
    const execucao = executarTesteEstrategias(historicoSorteado(120), { concursos: 100, dezenasPorJogo: 6, jogosPorConcurso: 1 });
    const progresso: number[] = [];

    // Act
    let passo = execucao.next();
    while (!passo.done) {
      progresso.push(passo.value);
      passo = execucao.next();
    }

    // Assert
    expect(progresso).toEqual([0.25, 0.5, 0.75]);
    expect(passo.value.concursosTestados).toBe(100);
  });
});
