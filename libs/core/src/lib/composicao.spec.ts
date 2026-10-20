import { concursoTeste, historicoTeste, LOTERIA_TESTE, LOTERIA_TESTE_100 } from '../testes/loteria-teste';
import { distribuicaoAcaso, varianciaAcaso, vereditoDe } from './acaso';
import { calcularComposicao } from './composicao';
import { criarRng } from './rng';
import type { Historico } from './tipos';

const soma = (valores: number[]) => valores.reduce((a, b) => a + b, 0);

/** `quantidade` concursos de 6 dezenas em 1..60 sorteados com semente fixa. */
function historicoSorteado(quantidade: number): Historico {
  const rng = criarRng(11);
  return historicoTeste(
    Array.from({ length: quantidade }, (_, i) => {
      const dezenas = new Set<number>();
      while (dezenas.size < 6) dezenas.add(1 + Math.floor(rng() * 60));
      return concursoTeste(i + 1, `${2000 + Math.floor(i / 100)}-01-01`, [...dezenas]);
    }),
  );
}

/** Mesma conta feita do jeito mais direto possível, para comparar. */
function composicaoManual(historico: Historico, janela: number) {
  const { concursos } = historico;
  const quentes: number[] = [];
  const frias: number[] = [];
  const atrasadas: number[] = [];
  const repetidas: number[] = [];
  for (let i = janela; i < concursos.length; i++) {
    const freq = new Map<number, number>(Array.from({ length: 60 }, (_, d) => [d + 1, 0]));
    for (const c of concursos.slice(i - janela, i)) for (const d of c.dezenas) freq.set(d, (freq.get(d) ?? 0) + 1);
    const ordem = [...freq.keys()].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0) || a - b);
    const ultimo = (d: number) => {
      for (let j = i - 1; j >= 0; j--) if (concursos[j].dezenas.includes(d)) return j;
      return -1;
    };
    const sorteio = concursos[i].dezenas;
    const conta = (grupo: number[]) => sorteio.filter((d) => grupo.includes(d)).length;
    quentes.push(conta(ordem.slice(0, 20)));
    frias.push(conta(ordem.slice(-20)));
    atrasadas.push(conta(ordem.filter((d) => i - 1 - ultimo(d) >= 10)));
    repetidas.push(conta(concursos[i - 1].dezenas));
  }
  const media = (v: number[]) => soma(v) / v.length;
  return { quentes: media(quentes), frias: media(frias), atrasadas: media(atrasadas), repetidas: media(repetidas) };
}

describe('distribuicaoAcaso / varianciaAcaso', () => {
  it('jogo de 6 em 60/6: soma 1, sena em 1 / 50.063.860 e variância 6 · 0,1 · 0,9 · 54/59', () => {
    // Act
    const distribuicao = distribuicaoAcaso(LOTERIA_TESTE, 6);

    // Assert
    expect(soma(distribuicao)).toBeCloseTo(1, 12);
    expect(distribuicao[6]).toBeCloseTo(1 / 50_063_860, 15);
    expect(varianciaAcaso(LOTERIA_TESTE, 6)).toBeCloseTo(6 * 0.1 * 0.9 * (54 / 59), 12);
  });

  it('grupo vazio sempre traz 0 dezenas; grupo com todas traz sempre as sorteadas', () => {
    // Act / Assert
    expect(distribuicaoAcaso(LOTERIA_TESTE, 0)).toEqual([1]);
    expect(distribuicaoAcaso(LOTERIA_TESTE, 60)[6]).toBeCloseTo(1, 12);
    expect(varianciaAcaso(LOTERIA_TESTE, 60)).toBe(0);
  });
});

describe('vereditoDe', () => {
  it('dentro da margem é empate; fora dela, acima ou abaixo do acaso', () => {
    // Act / Assert
    expect(vereditoDe(9.03, 0.04, 9)).toBe('dentro');
    expect(vereditoDe(9.04, 0.04, 9)).toBe('dentro');
    expect(vereditoDe(9.05, 0.04, 9)).toBe('acima');
    expect(vereditoDe(8.9, 0.04, 9)).toBe('abaixo');
  });
});

describe('calcularComposicao', () => {
  it('as médias por grupo batem com a conta feita à mão, concurso a concurso', () => {
    // Arrange
    const historico = historicoSorteado(150);

    // Act
    const resultado = calcularComposicao(historico, { tipo: 'tudo' }, 50);
    const manual = composicaoManual(historico, 50);

    // Assert
    expect(resultado.concursos).toBe(100);
    const media = Object.fromEntries(resultado.grupos.map((g) => [g.grupo, g.mediaObservada]));
    expect(media['quentes']).toBeCloseTo(manual.quentes, 12);
    expect(media['frias']).toBeCloseTo(manual.frias, 12);
    expect(media['atrasadas']).toBeCloseTo(manual.atrasadas, 12);
    expect(media['repetidas']).toBeCloseTo(manual.repetidas, 12);
  });

  it('o acaso de quentes e frias é 2 de 6 (terço de 20), o de repetidas é 0,6 e o das atrasadas segue o tamanho do grupo', () => {
    // Act
    const resultado = calcularComposicao(historicoSorteado(150));
    const grupo = (id: string) => resultado.grupos.find((g) => g.grupo === id);

    // Assert
    expect(resultado.tamanhoTerco).toBe(20);
    expect(resultado.atrasoMinimo).toBe(10);
    expect(grupo('quentes')).toMatchObject({ tamanhoMedio: 20, mediaAcaso: 2 });
    expect(grupo('frias')).toMatchObject({ tamanhoMedio: 20, mediaAcaso: 2 });
    expect(grupo('repetidas')?.tamanhoMedio).toBe(6);
    expect(grupo('repetidas')?.mediaAcaso).toBeCloseTo(0.6, 12);
    const atrasadas = grupo('atrasadas');
    expect(atrasadas?.mediaAcaso).toBeCloseTo(((atrasadas?.tamanhoMedio ?? 0) * 6) / 60, 12);
  });

  it('as distribuições somam o número de concursos e a margem encolhe com mais concursos', () => {
    // Act
    const curto = calcularComposicao(historicoSorteado(150));
    const longo = calcularComposicao(historicoSorteado(450));

    // Assert
    for (const g of curto.grupos) {
      expect(soma(g.distribuicaoObservada)).toBe(100);
      // A cauda sem ocorrência e com menos de 0,005 concurso esperado é cortada.
      expect(soma(g.distribuicaoAcaso)).toBeCloseTo(100, 1);
      expect(g.margem).toBeGreaterThan(0);
    }
    const margem = (r: typeof curto) => r.grupos.find((g) => g.grupo === 'quentes')?.margem ?? 0;
    expect(margem(longo)).toBeCloseTo(margem(curto) / Math.sqrt(4), 12);
  });

  it('o período escolhe quais concursos entram, sempre com os anteriores como base', () => {
    // Arrange
    const historico = historicoSorteado(300);

    // Act
    const ano = calcularComposicao(historico, { tipo: 'ano', ano: 2001 });
    const ultimos = calcularComposicao(historico, { tipo: 'ultimos', quantidade: 20 });
    const primeiros = calcularComposicao(historico, { tipo: 'ano', ano: 2000 });

    // Assert
    expect(ano.concursos).toBe(100);
    expect(ultimos.concursos).toBe(20);
    // Os 50 primeiros não têm 50 concursos antes: ficam de fora.
    expect(primeiros.concursos).toBe(50);
  });

  it('concurso igual ao anterior tem as 6 repetidas; histórico curto demais não analisa nada', () => {
    // Arrange
    const historico = historicoTeste([
      concursoTeste(1, '2026-01-01', [1, 2, 3, 4, 5, 6]),
      concursoTeste(2, '2026-01-02', [1, 2, 3, 4, 5, 6]),
    ]);

    // Act
    const resultado = calcularComposicao(historico, { tipo: 'tudo' }, 1);
    const vazio = calcularComposicao(historico, { tipo: 'tudo' }, 50);

    // Assert
    const repetidas = resultado.grupos.find((g) => g.grupo === 'repetidas');
    expect(repetidas?.mediaObservada).toBe(6);
    expect(repetidas?.distribuicaoObservada[6]).toBe(1);
    expect(vazio.concursos).toBe(0);
    expect(vazio.grupos.every((g) => g.mediaObservada === 0 && g.margem === 0)).toBe(true);
  });

  it('na loteria com 00 o terço tem 33 dezenas e a dezena 0 entra nos grupos', () => {
    // Arrange
    const rng = criarRng(3);
    const historico = historicoTeste(
      Array.from({ length: 60 }, (_, i) => {
        const dezenas = new Set<number>();
        while (dezenas.size < 20) dezenas.add(Math.floor(rng() * 100));
        return concursoTeste(i + 1, '2026-01-01', [...dezenas]);
      }),
      LOTERIA_TESTE_100,
    );

    // Act
    const resultado = calcularComposicao(historico);

    // Assert
    expect(resultado.tamanhoTerco).toBe(33);
    expect(resultado.atrasoMinimo).toBe(5);
    expect(resultado.concursos).toBe(10);
    expect(resultado.grupos.find((g) => g.grupo === 'quentes')?.mediaAcaso).toBeCloseTo(6.6, 12);
  });
});
