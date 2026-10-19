import { LOTERIA_TESTE, LOTERIA_TESTE_25 } from '../../testes/loteria-teste';
import type { ContextoFiltro, LoteriaDefinicao } from '../tipos';
import { chaveJogo } from '../tipos';
import { quadrante } from '../volante';
import {
  aplicarFiltros,
  filtroColunas,
  filtroConsecutivas,
  filtroHistorico,
  filtroLinhas,
  filtroPares,
  filtroQuadrantes,
  filtrosPadrao,
  obterFiltro,
} from './index';

function ctx(def: LoteriaDefinicao = LOTERIA_TESTE, historico: string[] = []): ContextoFiltro {
  return { def, historico: new Set(historico) };
}

/** Jogo de k dezenas com exatamente `pares` pares, em ordem crescente (60/6). */
function jogoComPares(k: number, pares: number): number[] {
  const evens = Array.from({ length: pares }, (_, i) => (i + 1) * 2);
  const odds = Array.from({ length: k - pares }, (_, i) => 41 + i * 2);
  return [...evens, ...odds].sort((a, b) => a - b);
}

describe('filtro quadrantes', () => {
  it('é aplicável quando k >= quadrantes', () => {
    expect(filtroQuadrantes.aplicavelA(LOTERIA_TESTE, 6)).toBe(true);
    expect(filtroQuadrantes.aplicavelA(LOTERIA_TESTE, 3)).toBe(false);
    expect(filtroQuadrantes.aplicavelA(LOTERIA_TESTE_25, 15)).toBe(true);
  });

  it('aceita jogo com dezenas nos quatro quadrantes (60/6)', () => {
    // 1 (q0), 9 (q1), 41 (q2), 50 (q3)
    expect(filtroQuadrantes.aceita([1, 9, 41, 50, 52, 58], ctx())).toBe(true);
  });

  it('reprova jogo que deixa um quadrante vazio', () => {
    expect(filtroQuadrantes.aceita([1, 2, 3, 4, 5, 11], ctx())).toBe(false);
    expect(filtroQuadrantes.aceita([1, 9, 12, 19, 41, 42], ctx())).toBe(false);
  });

  it('usa a fórmula do volante 5x5 (metade = 2,5): dezena 13 (linha 2, coluna 2) cai no quadrante 0', () => {
    const def = LOTERIA_TESTE_25;
    expect(quadrante(13, def)).toBe(0);
    expect(quadrante(1, def)).toBe(0);
    expect(quadrante(5, def)).toBe(1);
    expect(quadrante(21, def)).toBe(2);
    expect(quadrante(25, def)).toBe(3);
    expect(filtroQuadrantes.aceita([1, 5, 21, 25], ctx(def))).toBe(true);
    expect(filtroQuadrantes.aceita([1, 5, 13, 21], ctx(def))).toBe(false);
  });
});

describe('filtro colunas', () => {
  it('é aplicável só quando k <= colunas', () => {
    expect(filtroColunas.aplicavelA(LOTERIA_TESTE, 6)).toBe(true);
    expect(filtroColunas.aplicavelA(LOTERIA_TESTE, 10)).toBe(true);
    expect(filtroColunas.aplicavelA(LOTERIA_TESTE, 11)).toBe(false);
    expect(filtroColunas.aplicavelA(LOTERIA_TESTE_25, 15)).toBe(false);
  });

  it('aceita jogo com todas as colunas distintas', () => {
    expect(filtroColunas.aceita([1, 12, 23, 34, 45, 56], ctx())).toBe(true);
  });

  it('reprova jogo com duas dezenas na mesma coluna', () => {
    expect(filtroColunas.aceita([1, 11, 23, 34, 45, 56], ctx())).toBe(false);
  });
});

describe('filtro linhas', () => {
  it('é desligado por padrão e aplicável só com mais de 3 colunas', () => {
    expect(filtroLinhas.padraoLigado).toBe(false);
    expect(filtroLinhas.aplicavelA(LOTERIA_TESTE, 6)).toBe(true);
    expect(filtroLinhas.aplicavelA(LOTERIA_TESTE_25, 15)).toBe(true);
    expect(filtroLinhas.aplicavelA({ ...LOTERIA_TESTE, volante: { colunas: 3, linhas: 20 } }, 6)).toBe(false);
  });

  it('aceita até 3 dezenas na mesma linha', () => {
    expect(filtroLinhas.aceita([1, 2, 3, 11, 12, 13], ctx())).toBe(true);
  });

  it('reprova 4 dezenas na mesma linha', () => {
    expect(filtroLinhas.aceita([1, 2, 3, 4, 21, 31], ctx())).toBe(false);
  });
});

describe('filtro historico', () => {
  it('é aplicável só quando k === sorteadas', () => {
    expect(filtroHistorico.aplicavelA(LOTERIA_TESTE, 6)).toBe(true);
    expect(filtroHistorico.aplicavelA(LOTERIA_TESTE, 7)).toBe(false);
    expect(filtroHistorico.aplicavelA(LOTERIA_TESTE_25, 15)).toBe(true);
  });

  it('reprova jogo igual a resultado já sorteado', () => {
    const sorteado = [3, 10, 22, 35, 47, 59];
    expect(filtroHistorico.aceita(sorteado, ctx(LOTERIA_TESTE, [chaveJogo(sorteado)]))).toBe(false);
  });

  it('aceita jogo inédito, mesmo com histórico preenchido', () => {
    const contexto = ctx(LOTERIA_TESTE, [chaveJogo([3, 10, 22, 35, 47, 59])]);
    expect(filtroHistorico.aceita([3, 10, 22, 35, 47, 58], contexto)).toBe(true);
  });
});

describe('filtro pares', () => {
  it('é sempre aplicável', () => {
    expect(filtroPares.aplicavelA(LOTERIA_TESTE, 6)).toBe(true);
    expect(filtroPares.aplicavelA(LOTERIA_TESTE_25, 15)).toBe(true);
  });

  it('k=6: aceita 2 a 4 pares e reprova 0, 1, 5 e 6', () => {
    expect(filtroPares.aceita(jogoComPares(6, 2), ctx())).toBe(true);
    expect(filtroPares.aceita(jogoComPares(6, 3), ctx())).toBe(true);
    expect(filtroPares.aceita(jogoComPares(6, 4), ctx())).toBe(true);
    expect(filtroPares.aceita(jogoComPares(6, 0), ctx())).toBe(false);
    expect(filtroPares.aceita(jogoComPares(6, 1), ctx())).toBe(false);
    expect(filtroPares.aceita(jogoComPares(6, 5), ctx())).toBe(false);
    expect(filtroPares.aceita(jogoComPares(6, 6), ctx())).toBe(false);
  });

  it('k=9: aceita 3 a 6 pares', () => {
    expect(filtroPares.aceita(jogoComPares(9, 3), ctx())).toBe(true);
    expect(filtroPares.aceita(jogoComPares(9, 6), ctx())).toBe(true);
    expect(filtroPares.aceita(jogoComPares(9, 2), ctx())).toBe(false);
    expect(filtroPares.aceita(jogoComPares(9, 7), ctx())).toBe(false);
  });

  it('k=20: aceita 6 a 14 pares', () => {
    expect(filtroPares.aceita(jogoComPares(20, 6), ctx())).toBe(true);
    expect(filtroPares.aceita(jogoComPares(20, 14), ctx())).toBe(true);
    expect(filtroPares.aceita(jogoComPares(20, 5), ctx())).toBe(false);
    expect(filtroPares.aceita(jogoComPares(20, 15), ctx())).toBe(false);
  });
});

describe('filtro consecutivas', () => {
  it('é sempre aplicável', () => {
    expect(filtroConsecutivas.aplicavelA(LOTERIA_TESTE, 6)).toBe(true);
    expect(filtroConsecutivas.aplicavelA(LOTERIA_TESTE_25, 15)).toBe(true);
  });

  it('aceita sequência de 3 e sequência interrompida antes do 4º', () => {
    expect(filtroConsecutivas.aceita([5, 6, 7, 20, 30, 40], ctx())).toBe(true);
    expect(filtroConsecutivas.aceita([5, 6, 7, 9, 30, 40], ctx())).toBe(true);
  });

  it('reprova sequência de 4 ou mais, inclusive na borda do universo', () => {
    expect(filtroConsecutivas.aceita([5, 6, 7, 8, 30, 40], ctx())).toBe(false);
    expect(filtroConsecutivas.aceita([1, 2, 3, 4, 5, 6], ctx())).toBe(false);
    expect(filtroConsecutivas.aceita([57, 58, 59, 60], ctx())).toBe(false);
    expect(filtroConsecutivas.aceita([10, 20, 30, 40, 50, 60], ctx())).toBe(true);
  });
});

describe('filtrosPadrao e obterFiltro', () => {
  it('devolve os seis filtros na ordem de exibição', () => {
    expect(filtrosPadrao().map((f) => f.id)).toEqual(['quadrantes', 'colunas', 'linhas', 'historico', 'pares', 'consecutivas']);
  });

  it('devolve um novo array a cada chamada', () => {
    expect(filtrosPadrao()).not.toBe(filtrosPadrao());
  });

  it('marca como ligados por padrão todos menos linhas', () => {
    const ligados = filtrosPadrao()
      .filter((f) => f.padraoLigado)
      .map((f) => f.id);
    expect(ligados).toEqual(['quadrantes', 'colunas', 'historico', 'pares', 'consecutivas']);
  });

  it('obtém um filtro pelo id', () => {
    expect(obterFiltro('pares')).toBe(filtroPares);
  });

  it('lança erro para filtro desconhecido', () => {
    expect(() => obterFiltro('xyz')).toThrow('Filtro desconhecido: xyz');
  });
});

describe('aplicarFiltros', () => {
  it('ignora filtro não aplicável (colunas com k=11 no 60/6)', () => {
    // 11 dezenas em 10 colunas: sempre há coluna repetida, mas o filtro não se aplica
    const jogo = [1, 2, 12, 13, 23, 24, 34, 35, 45, 46, 56];
    expect(aplicarFiltros(jogo, ctx(), ['colunas'])).toBe(true);
  });

  it('só aplica os filtros cujo id foi pedido', () => {
    const jogo = [5, 6, 7, 8, 31, 42];
    expect(aplicarFiltros(jogo, ctx(), ['consecutivas'])).toBe(false);
    expect(aplicarFiltros(jogo, ctx(), ['colunas'])).toBe(true);
    expect(aplicarFiltros(jogo, ctx(), [])).toBe(true);
  });

  it('reprova quando qualquer filtro pedido e aplicável reprova', () => {
    const jogo = [1, 12, 23, 34, 45, 56];
    const contexto = ctx(LOTERIA_TESTE, [chaveJogo(jogo)]);
    expect(aplicarFiltros(jogo, contexto, ['colunas', 'historico'])).toBe(false);
    expect(aplicarFiltros(jogo, contexto, ['colunas'])).toBe(true);
  });
});
