import { calcularEstatisticas } from './estatisticas';
import { filtroExiste, obterFiltro } from './filtros';
import { gerarJogos } from './geracao';
import { criarRng } from './rng';
import { chaveJogo } from './tipos';
import type { ConfiguracaoGeracao, ContextoFiltro, EstatisticaDezena, Filtro, Historico } from './tipos';
import { quadrante } from './volante';
import { concursoTeste, historicoTeste, LOTERIA_TESTE } from '../testes/loteria-teste';

jest.mock('./estatisticas');
jest.mock('./filtros');

const calcularEstatisticasFalso = jest.mocked(calcularEstatisticas);
const obterFiltroFalso = jest.mocked(obterFiltro);
const filtroExisteFalso = jest.mocked(filtroExiste);

/** Estatísticas falsas: atraso = dezena % 10 no histórico inteiro; frequência varia com o período. */
function estatisticasFalsas(historico: Historico, periodo: { tipo: string }): EstatisticaDezena[] {
  return Array.from({ length: historico.loteria.universo }, (_, i) => {
    const dezena = i + 1;
    return {
      dezena,
      atraso: dezena % 10,
      frequencia: periodo.tipo === 'tudo' ? 0 : (dezena * 3) % 11,
      atrasoMaximo: dezena % 10,
      probAusencia: 1,
    };
  });
}

function filtroFalso(id: string, aceita: Filtro['aceita'] = () => true, aplicavel = true): Filtro {
  return {
    id,
    nome: id,
    padraoLigado: true,
    aplicavelA: () => aplicavel,
    aceita,
  };
}

const historico = historicoTeste([
  concursoTeste(1, '2020-01-01', [1, 2, 3, 4, 5, 6]),
  concursoTeste(2, '2020-01-04', [10, 20, 30, 40, 50, 60]),
]);

function configuracao(parcial: Partial<ConfiguracaoGeracao> = {}): ConfiguracaoGeracao {
  return {
    estrategia: 'atrasadas',
    quantidadeJogos: 10,
    dezenasPorJogo: 6,
    fixas: [],
    atrasadas: { atrasoMinimo: 10, intensidade: 2 },
    frequentes: { periodo: { tipo: 'ultimos', quantidade: 50 } },
    regras: {},
    ...parcial,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  calcularEstatisticasFalso.mockImplementation((h, periodo) => estatisticasFalsas(h, periodo));
  obterFiltroFalso.mockImplementation((id) => filtroFalso(id));
  filtroExisteFalso.mockReturnValue(true);
});

describe('gerarJogos', () => {
  describe('resultado', () => {
    it('é determinístico: mesma semente, mesmo histórico e mesma config geram os mesmos jogos', () => {
      // Arrange
      const config = configuracao({ quantidadeJogos: 20 });

      // Act
      const primeiro = gerarJogos(historico, config, criarRng(99));
      const segundo = gerarJogos(historico, config, criarRng(99));

      // Assert
      expect(segundo).toEqual(primeiro);
    });

    it('sementes diferentes geram jogos diferentes', () => {
      // Arrange
      const config = configuracao();

      // Act
      const a = gerarJogos(historico, config, criarRng(1));
      const b = gerarJogos(historico, config, criarRng(2));

      // Assert
      expect(a.jogos).not.toEqual(b.jogos);
    });

    it('honra a quantidade de jogos pedida e marca incompleto=false', () => {
      // Arrange
      const config = configuracao({ quantidadeJogos: 37 });

      // Act
      const resultado = gerarJogos(historico, config, criarRng(5));

      // Assert
      expect(resultado.jogos).toHaveLength(37);
      expect(resultado.incompleto).toBe(false);
      expect(resultado.tentativas).toBeGreaterThanOrEqual(37);
    });

    it.each(['atrasadas', 'frequentes', 'mista', 'aleatorio'] as const)(
      'gera jogos válidos com a estratégia %s',
      (estrategia) => {
        // Arrange
        const config = configuracao({ estrategia, quantidadeJogos: 5 });

        // Act
        const resultado = gerarJogos(historico, config, criarRng(3));

        // Assert
        expect(resultado.jogos).toHaveLength(5);
        for (const jogo of resultado.jogos) expect(new Set(jogo.dezenas).size).toBe(6);
      },
    );

    it('não repete jogos na mesma geração', () => {
      // Arrange: 5 fixas deixam apenas 55 jogos possíveis; pedir 50 força colisões a serem rejeitadas
      const config = configuracao({
        quantidadeJogos: 50,
        fixas: [1, 2, 3, 4, 5],
        estrategia: 'aleatorio',
      });

      // Act
      const resultado = gerarJogos(historico, config, criarRng(11));

      // Assert
      const chaves = resultado.jogos.map((j) => chaveJogo(j.dezenas));
      expect(new Set(chaves).size).toBe(chaves.length);
      expect(resultado.jogos).toHaveLength(50);
    });

    it('devolve as dezenas de cada jogo em ordem crescente, distintas e dentro do universo', () => {
      // Arrange
      const config = configuracao({
        quantidadeJogos: 15,
        dezenasPorJogo: 9,
        fixas: [58, 3],
      });

      // Act
      const { jogos } = gerarJogos(historico, config, criarRng(21));

      // Assert
      for (const jogo of jogos) {
        expect(jogo.dezenas).toEqual([...jogo.dezenas].sort((a, b) => a - b));
        expect(new Set(jogo.dezenas).size).toBe(9);
        expect(jogo.dezenas.every((d) => d >= 1 && d <= 60)).toBe(true);
      }
    });

    it('gera 20 dezenas distintas quando dezenasPorJogo é 20', () => {
      // Arrange
      const config = configuracao({
        dezenasPorJogo: 20,
        quantidadeJogos: 5,
        estrategia: 'mista',
      });

      // Act
      const { jogos } = gerarJogos(historico, config, criarRng(8));

      // Assert
      expect(jogos).toHaveLength(5);
      for (const jogo of jogos) expect(new Set(jogo.dezenas).size).toBe(20);
    });
  });

  describe('dezenas fixas', () => {
    it('inclui as fixas em todos os jogos', () => {
      // Arrange
      const config = configuracao({ fixas: [7, 42], quantidadeJogos: 25 });

      // Act
      const { jogos } = gerarJogos(historico, config, criarRng(4));

      // Assert
      expect(jogos).toHaveLength(25);
      for (const jogo of jogos) {
        expect(jogo.dezenas).toContain(7);
        expect(jogo.dezenas).toContain(42);
      }
    });

    it('com fixas.length igual a dezenasPorJogo só existe um jogo possível e o resultado fica incompleto', () => {
      // Arrange
      const config = configuracao({
        fixas: [1, 2, 3, 4, 5, 6],
        quantidadeJogos: 3,
      });

      // Act
      const resultado = gerarJogos(historico, config, criarRng(1));

      // Assert
      expect(resultado.jogos).toHaveLength(1);
      expect(resultado.jogos[0].dezenas).toEqual([1, 2, 3, 4, 5, 6]);
      expect(resultado.incompleto).toBe(true);
    });

    it('com as fixas completando o jogo faz uma única tentativa, sem esgotar o limite', () => {
      // Arrange
      const config = configuracao({
        fixas: [1, 2, 3, 4, 5, 6],
        quantidadeJogos: 5,
      });

      // Act
      const resultado = gerarJogos(historico, config, criarRng(1));

      // Assert
      expect(resultado.tentativas).toBe(1);
      expect(resultado.jogos).toHaveLength(1);
      expect(resultado.incompleto).toBe(true);
    });

    it('com as fixas completando o jogo e pedindo 1 jogo, o resultado é completo', () => {
      // Arrange
      const config = configuracao({
        fixas: [1, 2, 3, 4, 5, 6],
        quantidadeJogos: 1,
      });

      // Act
      const resultado = gerarJogos(historico, config, criarRng(1));

      // Assert
      expect(resultado.tentativas).toBe(1);
      expect(resultado.jogos).toHaveLength(1);
      expect(resultado.incompleto).toBe(false);
    });
  });

  describe('filtros', () => {
    it('marca incompleto=true, sem lançar erro, quando o filtro reprova tudo', () => {
      // Arrange
      obterFiltroFalso.mockImplementation((id) => filtroFalso(id, () => false));
      const config = configuracao({
        regras: { historico: true },
        quantidadeJogos: 4,
      });

      // Act
      const resultado = gerarJogos(historico, config, criarRng(1));

      // Assert
      expect(resultado.jogos).toEqual([]);
      expect(resultado.incompleto).toBe(true);
      expect(resultado.tentativas).toBe(20000);
    });

    it('consulta só os filtros ligados (regras com valor verdadeiro)', () => {
      // Arrange
      const config = configuracao({
        regras: { quadrantes: true, linhas: false, pares: true },
      });

      // Act
      gerarJogos(historico, config, criarRng(1));

      // Assert
      expect(obterFiltroFalso.mock.calls.map(([id]) => id)).toEqual(['quadrantes', 'pares']);
    });

    it('ignora filtros que não se aplicam à loteria e ao tamanho de jogo', () => {
      // Arrange
      obterFiltroFalso.mockImplementation((id) => filtroFalso(id, () => false, false));
      const config = configuracao({
        regras: { colunas: true },
        quantidadeJogos: 3,
      });

      // Act
      const resultado = gerarJogos(historico, config, criarRng(1));

      // Assert
      expect(resultado.jogos).toHaveLength(3);
      expect(resultado.incompleto).toBe(false);
    });

    it('só aceita jogos aprovados pelo filtro e entrega o contexto com def e chaves do histórico', () => {
      // Arrange
      const contextos: ContextoFiltro[] = [];
      obterFiltroFalso.mockImplementation((id) =>
        filtroFalso(id, (jogo, ctx) => {
          contextos.push(ctx);
          return jogo[0] <= 10;
        }),
      );
      const config = configuracao({
        regras: { colunas: true },
        quantidadeJogos: 8,
        estrategia: 'aleatorio',
      });

      // Act
      const { jogos } = gerarJogos(historico, config, criarRng(6));

      // Assert
      expect(jogos).toHaveLength(8);
      expect(jogos.every((j) => j.dezenas[0] <= 10)).toBe(true);
      expect(contextos[0].def).toBe(LOTERIA_TESTE);
      expect(contextos[0].historico).toEqual(new Set(['1-2-3-4-5-6', '10-20-30-40-50-60']));
    });

    it('recebe cada jogo em ordem crescente nos filtros', () => {
      // Arrange
      const jogosVistos: number[][] = [];
      obterFiltroFalso.mockImplementation((id) =>
        filtroFalso(id, (jogo) => {
          jogosVistos.push([...jogo]);
          return true;
        }),
      );
      const config = configuracao({
        regras: { consecutivas: true },
        fixas: [60, 2],
        quantidadeJogos: 5,
      });

      // Act
      gerarJogos(historico, config, criarRng(2));

      // Assert
      expect(jogosVistos.length).toBeGreaterThan(0);
      for (const jogo of jogosVistos) expect(jogo).toEqual([...jogo].sort((a, b) => a - b));
    });
  });

  describe('dados auxiliares do Jogo', () => {
    it('calcula pares, quadrantes e atraso médio (1 casa decimal) corretamente', () => {
      // Arrange: [1,2,31,32,59,60] -> pares 2, 32, 60; quadrantes 0, 2 e 3; atrasos (dezena % 10) 1,2,1,2,9,0
      const config = configuracao({
        fixas: [1, 2, 31, 32, 59, 60],
        quantidadeJogos: 1,
      });

      // Act
      const { jogos } = gerarJogos(historico, config, criarRng(1));

      // Assert
      expect(jogos[0]).toEqual({
        dezenas: [1, 2, 31, 32, 59, 60],
        atrasoMedio: 2.5,
        pares: 3,
        quadrantes: 3,
      });
      expect(new Set(jogos[0].dezenas.map((d) => quadrante(d, LOTERIA_TESTE))).size).toBe(jogos[0].quadrantes);
    });

    it('arredonda o atraso médio para uma casa decimal', () => {
      // Arrange: atrasos 1,2,3,4,5,7 => 22/6 = 3,666... => 3,7
      const config = configuracao({
        fixas: [1, 2, 3, 4, 5, 7],
        quantidadeJogos: 1,
      });

      // Act
      const { jogos } = gerarJogos(historico, config, criarRng(1));

      // Assert
      expect(jogos[0].atrasoMedio).toBe(3.7);
    });

    it('usa o atraso do histórico inteiro e a frequência do período configurado', () => {
      // Arrange
      const config = configuracao({
        frequentes: { periodo: { tipo: 'ano', ano: 2020 } },
      });

      // Act
      gerarJogos(historico, config, criarRng(1));

      // Assert
      expect(calcularEstatisticasFalso).toHaveBeenCalledWith(historico, {
        tipo: 'tudo',
      });
      expect(calcularEstatisticasFalso).toHaveBeenCalledWith(historico, {
        tipo: 'ano',
        ano: 2020,
      });
    });
  });

  describe('validação da configuração', () => {
    it.each([0, 51, 2.5, -1])('lança erro para quantidadeJogos %p', (quantidadeJogos) => {
      expect(() => gerarJogos(historico, configuracao({ quantidadeJogos }), criarRng(1))).toThrow(/quantidadeJogos/);
    });

    it.each([5, 21, 6.5])('lança erro para dezenasPorJogo %p fora de 6..20', (dezenasPorJogo) => {
      expect(() => gerarJogos(historico, configuracao({ dezenasPorJogo }), criarRng(1))).toThrow(/dezenasPorJogo/);
    });

    it.each([0, 61, 1.5])('lança erro para fixa %p fora de 1..60', (fixa) => {
      expect(() => gerarJogos(historico, configuracao({ fixas: [fixa] }), criarRng(1))).toThrow(/fixa/);
    });

    it('lança erro para fixas repetidas', () => {
      expect(() => gerarJogos(historico, configuracao({ fixas: [5, 5] }), criarRng(1))).toThrow(/distintas/);
    });

    it('lança erro para id de regra desconhecido, mesmo desligada', () => {
      // Arrange
      filtroExisteFalso.mockImplementation((id) => id !== 'inexistente');
      const config = configuracao({ regras: { inexistente: false } });

      // Act / Assert
      expect(() => gerarJogos(historico, config, criarRng(1))).toThrow('Regra desconhecida: inexistente');
    });

    it('lança erro quando há mais fixas do que dezenas por jogo', () => {
      const config = configuracao({
        dezenasPorJogo: 6,
        fixas: [1, 2, 3, 4, 5, 6, 7],
      });
      expect(() => gerarJogos(historico, config, criarRng(1))).toThrow(/fixas/);
    });

    it('lança erro para estratégia desconhecida', () => {
      const config = configuracao({
        estrategia: 'sorte' as ConfiguracaoGeracao['estrategia'],
      });
      expect(() => gerarJogos(historico, config, criarRng(1))).toThrow(/Estratégia desconhecida/);
    });

    it('não chama estatísticas nem filtros quando a configuração é inválida', () => {
      // Arrange / Act
      expect(() => gerarJogos(historico, configuracao({ quantidadeJogos: 0 }), criarRng(1))).toThrow();

      // Assert
      expect(calcularEstatisticasFalso).not.toHaveBeenCalled();
      expect(obterFiltroFalso).not.toHaveBeenCalled();
    });
  });
});
