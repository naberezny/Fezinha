import { concursoTeste, LOTERIA_TESTE } from '../testes/loteria-teste';
import { calcularAssertividade, concursoAlvo, conferirJogo } from './conferencia';

describe('concursoAlvo', () => {
  it('é o concurso seguinte ao da base da geração', () => {
    expect(concursoAlvo(3070)).toBe(3071);
  });
});

describe('conferirJogo', () => {
  const concurso = concursoTeste(3071, '2026-10-21', [3, 14, 22, 35, 41, 58]);

  it('lista as dezenas acertadas na ordem do jogo e a faixa atingida', () => {
    // Act
    const conferencia = conferirJogo(LOTERIA_TESTE, [58, 1, 14, 22, 9, 35], concurso);

    // Assert
    expect(conferencia).toEqual({
      concurso: 3071,
      data: '2026-10-21',
      acertos: [58, 14, 22, 35],
      faixa: { faixa: 3, acertos: 4, nome: 'Quadra' },
    });
  });

  it('não atribui faixa quando os acertos não premiam', () => {
    // Act
    const conferencia = conferirJogo(LOTERIA_TESTE, [1, 2, 3, 4, 5, 6], concurso);

    // Assert
    expect(conferencia.acertos).toEqual([3]);
    expect(conferencia.faixa).toBeUndefined();
  });
});

describe('calcularAssertividade', () => {
  const concurso = concursoTeste(10, '2026-01-01', [1, 2, 3, 4, 5, 6]);
  const conferido = (dezenas: number[]) => ({
    tamanho: dezenas.length,
    conferencia: conferirJogo(LOTERIA_TESTE, dezenas, concurso),
  });

  it('sem jogos conferidos, tudo zerado', () => {
    expect(calcularAssertividade(LOTERIA_TESTE, [])).toEqual({
      conferidos: 0,
      mediaAcertos: 0,
      mediaAcaso: 0,
      premiados: 0,
      distribuicao: [],
      melhor: 0,
    });
  });

  it('calcula média, premiados, distribuição e melhor resultado, com o acaso dos mesmos tamanhos', () => {
    // Act
    const resumo = calcularAssertividade(LOTERIA_TESTE, [
      conferido([1, 2, 3, 4, 50, 51]), // 4 acertos, quadra
      conferido([1, 40, 41, 42, 43, 44]), // 1 acerto
      conferido([30, 31, 32, 33, 34, 35, 36]), // 0 acertos, jogo de 7
    ]);

    // Assert
    expect(resumo.conferidos).toBe(3);
    expect(resumo.mediaAcertos).toBeCloseTo(5 / 3);
    expect(resumo.mediaAcaso).toBeCloseTo((0.6 + 0.6 + 0.7) / 3);
    expect(resumo.premiados).toBe(1);
    expect(resumo.distribuicao).toEqual([1, 1, 0, 0, 1]);
    expect(resumo.melhor).toBe(4);
  });
});
