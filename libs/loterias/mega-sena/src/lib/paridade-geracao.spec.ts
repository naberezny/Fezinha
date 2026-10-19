import { chaveJogo, criarRng, gerarJogos, obterFiltro } from '@sorteios/core';
import type { ConfiguracaoGeracao, ContextoFiltro } from '@sorteios/core';
import { carregarHistoricoFixture } from '../testes/fixture';

const REGRAS_PADRAO: Record<string, boolean> = {
  quadrantes: true,
  colunas: true,
  linhas: false,
  historico: true,
  pares: true,
  consecutivas: true,
};

function configuracao(parcial: Partial<ConfiguracaoGeracao> = {}): ConfiguracaoGeracao {
  return {
    estrategia: 'atrasadas',
    quantidadeJogos: 5,
    dezenasPorJogo: 6,
    fixas: [],
    atrasadas: { atrasoMinimo: 10, intensidade: 2 },
    frequentes: { periodo: { tipo: 'ultimos', quantidade: 50 } },
    regras: { ...REGRAS_PADRAO },
    ...parcial,
  };
}

function media(valores: number[]): number {
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

describe('paridade da geração de jogos (histórico real da Mega-Sena)', () => {
  const historico = carregarHistoricoFixture();
  const contexto: ContextoFiltro = {
    def: historico.loteria,
    historico: new Set(historico.concursos.map((c) => chaveJogo(c.dezenas))),
  };

  it('gera 5 jogos de 6 dezenas distintas, em ordem crescente, dentro do universo', () => {
    // Arrange
    const config = configuracao();

    // Act
    const resultado = gerarJogos(historico, config, criarRng(1));

    // Assert
    expect(resultado.incompleto).toBe(false);
    expect(resultado.jogos).toHaveLength(5);
    for (const jogo of resultado.jogos) {
      expect(jogo.dezenas).toHaveLength(6);
      expect(new Set(jogo.dezenas).size).toBe(6);
      expect(jogo.dezenas).toEqual([...jogo.dezenas].sort((a, b) => a - b));
      expect(jogo.dezenas.every((d) => d >= 1 && d <= 60)).toBe(true);
    }
  });

  it('todos os jogos passam em todos os filtros ligados', () => {
    // Arrange
    const config = configuracao();
    const ligados = Object.entries(config.regras)
      .filter(([, ligado]) => ligado)
      .map(([id]) => obterFiltro(id));

    // Act
    const { jogos } = gerarJogos(historico, config, criarRng(1));

    // Assert
    expect(ligados.map((f) => f.id)).toEqual(['quadrantes', 'colunas', 'historico', 'pares', 'consecutivas']);
    for (const jogo of jogos) {
      for (const filtro of ligados) {
        if (filtro.aplicavelA(historico.loteria, config.dezenasPorJogo)) {
          expect({ filtro: filtro.id, jogo: jogo.dezenas, aceito: filtro.aceita(jogo.dezenas, contexto) }).toEqual({
            filtro: filtro.id,
            jogo: jogo.dezenas,
            aceito: true,
          });
        }
      }
    }
  });

  it('não repete nenhum resultado já sorteado e não repete jogos entre si', () => {
    // Arrange
    const config = configuracao({ quantidadeJogos: 20 });

    // Act
    const { jogos } = gerarJogos(historico, config, criarRng(1));

    // Assert
    const chaves = jogos.map((j) => chaveJogo(j.dezenas));
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const chave of chaves) expect(contexto.historico.has(chave)).toBe(false);
  });

  it('a estratégia atrasadas favorece dezenas atrasadas: atraso médio maior que o de jogos aleatórios (mesma semente)', () => {
    // Arrange
    const atrasadas = configuracao({ estrategia: 'atrasadas' });
    const aleatorios = configuracao({ estrategia: 'aleatorio' });

    // Act
    const jogosAtrasadas = gerarJogos(historico, atrasadas, criarRng(1)).jogos;
    const jogosAleatorios = gerarJogos(historico, aleatorios, criarRng(1)).jogos;

    // Assert
    expect(media(jogosAtrasadas.map((j) => j.atrasoMedio))).toBeGreaterThan(
      media(jogosAleatorios.map((j) => j.atrasoMedio)),
    );
  });

  it('é determinístico com o histórico real', () => {
    // Arrange
    const config = configuracao({ estrategia: 'mista' });

    // Act
    const a = gerarJogos(historico, config, criarRng(1));
    const b = gerarJogos(historico, config, criarRng(1));

    // Assert
    expect(b).toEqual(a);
  });

  it('50 jogos de 20 dezenas no modo mista terminam em menos de 500 ms', () => {
    // Arrange
    const config = configuracao({ estrategia: 'mista', quantidadeJogos: 50, dezenasPorJogo: 20 });
    const inicio = performance.now();

    // Act
    const resultado = gerarJogos(historico, config, criarRng(1));
    const duracaoMs = performance.now() - inicio;

    // Assert
    expect(resultado.jogos).toHaveLength(50);
    expect(duracaoMs).toBeLessThan(500);
  });
});
