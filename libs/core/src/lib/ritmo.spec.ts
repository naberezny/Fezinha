import { concursoTeste, historicoTeste, LOTERIA_TESTE, LOTERIA_TESTE_100 } from '../testes/loteria-teste';
import { AcompanhamentoRitmo, calcularRitmo } from './ritmo';
import type { Historico } from './tipos';

/**
 * 6 concursos (índices 0..5):
 *  0 | 1 2 3 4 5 6
 *  1 | 1 7 8 9 10 11      → dezena 1 volta depois de 1 concurso (ausência 0)
 *  2 | 2 12 13 14 15 16   → dezena 2 volta depois de 2 (ausência 1)
 *  3 | 1 18 19 20 21 22   → dezena 1 volta depois de 2 (ausência 1)
 *  4 | 2 23 24 25 26 27   → dezena 2 volta depois de 2 (ausência 1)
 *  5 | 28 29 30 31 32 33
 */
function criarHistorico(): Historico {
  return historicoTeste([
    concursoTeste(1, '2026-01-01', [1, 2, 3, 4, 5, 6]),
    concursoTeste(2, '2026-01-02', [1, 7, 8, 9, 10, 11]),
    concursoTeste(3, '2026-01-03', [2, 12, 13, 14, 15, 16]),
    concursoTeste(4, '2026-01-04', [1, 18, 19, 20, 21, 22]),
    concursoTeste(5, '2026-01-05', [2, 23, 24, 25, 26, 27]),
    concursoTeste(6, '2026-01-06', [28, 29, 30, 31, 32, 33]),
  ]);
}

function ritmoDe(dezena: number) {
  const ritmo = calcularRitmo(criarHistorico()).find((r) => r.dezena === dezena);
  if (!ritmo) throw new Error(`sem ritmo para ${dezena}`);
  return ritmo;
}

describe('calcularRitmo', () => {
  it('devolve uma entrada por dezena válida, na ordem do volante', () => {
    // Act
    const ritmo = calcularRitmo(criarHistorico());

    // Assert
    expect(ritmo.map((r) => r.dezena)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
  });

  it('mede intervalo médio, desvio, maior ausência e atraso da dezena', () => {
    // Act
    const um = ritmoDe(1);
    const dois = ritmoDe(2);

    // Assert
    expect(um).toMatchObject({ aparicoes: 3, intervaloMedio: 1.5, intervaloDesvio: 0.5, maiorAusencia: 1, atraso: 2 });
    expect(dois).toMatchObject({ aparicoes: 3, intervaloMedio: 2, intervaloDesvio: 0, maiorAusencia: 1, atraso: 1 });
  });

  it('passouDe é a fração das ausências encerradas mais curtas que o atraso atual', () => {
    // Act / Assert
    // Dezena 1: ausências 0 e 1, fora há 2 → passou das duas.
    expect(ritmoDe(1).passouDe).toBe(1);
    // Dezena 2: ausências 1 e 1, fora há 1 → nenhuma foi mais curta.
    expect(ritmoDe(2).passouDe).toBe(0);
  });

  it('com uma só aparição não há intervalo: média e desvio ausentes, passouDe 0', () => {
    // Act
    const tres = ritmoDe(3);

    // Assert
    expect(tres.aparicoes).toBe(1);
    expect(tres.intervaloMedio).toBeUndefined();
    expect(tres.intervaloDesvio).toBeUndefined();
    expect(tres.maiorAusencia).toBe(0);
    expect(tres.atraso).toBe(5);
    expect(tres.passouDe).toBe(0);
  });

  it('dezena que nunca saiu tem atraso igual ao total de concursos', () => {
    // Act
    const sessenta = ritmoDe(60);

    // Assert
    expect(sessenta).toMatchObject({ aparicoes: 0, atraso: 6, maiorAusencia: 0, passouDe: 0 });
  });

  it('na loteria com 00 a dezena 0 entra por último', () => {
    // Arrange
    const historico = historicoTeste([concursoTeste(1, '2026-01-01', [0, 1, 2])], LOTERIA_TESTE_100);

    // Act
    const ritmo = calcularRitmo(historico);

    // Assert
    expect(ritmo).toHaveLength(100);
    expect(ritmo[99]).toMatchObject({ dezena: 0, aparicoes: 1, atraso: 0 });
  });
});

describe('AcompanhamentoRitmo', () => {
  it('concurso a concurso chega ao mesmo resultado que calcularRitmo', () => {
    // Arrange
    const historico = criarHistorico();
    const acompanhamento = new AcompanhamentoRitmo(LOTERIA_TESTE);

    // Act
    for (const concurso of historico.concursos) acompanhamento.adicionar(concurso.dezenas);

    // Assert
    expect(acompanhamento.listar()).toEqual(calcularRitmo(historico));
  });

  it('o atraso e o passouDe mudam a cada concurso registrado', () => {
    // Arrange
    const acompanhamento = new AcompanhamentoRitmo(LOTERIA_TESTE);
    acompanhamento.adicionar([1, 2, 3, 4, 5, 6]);
    acompanhamento.adicionar([1, 7, 8, 9, 10, 11]);

    // Act
    const antes = acompanhamento.passouDe(1);
    acompanhamento.adicionar([12, 13, 14, 15, 16, 17]);
    const depois = acompanhamento.passouDe(1);

    // Assert
    expect(antes).toBe(0);
    expect(acompanhamento.atraso(1)).toBe(1);
    expect(depois).toBe(1);
  });
});
