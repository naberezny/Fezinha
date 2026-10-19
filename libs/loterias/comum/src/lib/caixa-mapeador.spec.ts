import type { LoteriaDefinicao } from '@sorteios/core';
import { criarMapeadorCaixa } from './caixa-mapeador';

type Json = Record<string, unknown>;

/** Definições mínimas só para o teste: a lib `comum` não depende das libs de cada loteria. */
const BASE: LoteriaDefinicao = {
  id: 'teste',
  nome: 'Teste',
  cor: '#209869',
  universo: 60,
  primeiraDezena: 1,
  sorteadas: 6,
  aposta: { min: 6, max: 20 },
  volante: { colunas: 10, linhas: 6 },
  quadrantes: 4,
  faixas: [{ faixa: 1, acertos: 6, nome: 'Sena' }],
  diasSorteio: [3],
  regrasDisponiveis: [],
};
const COM_ZERO: LoteriaDefinicao = {
  ...BASE,
  universo: 100,
  primeiraDezena: 0,
  sorteadas: 4,
  volante: { colunas: 10, linhas: 10 },
};

function resposta(dezenas: Array<string | number>): Json {
  return {
    numero: 10,
    dataApuracao: '05/01/2026',
    listaDezenas: dezenas,
    acumulado: false,
    listaRateioPremio: [
      { descricaoFaixa: 'a', faixa: 1, numeroDeGanhadores: 2, valorPremio: 1234.56 },
      { descricaoFaixa: 'b', faixa: 2, numeroDeGanhadores: 30, valorPremio: '10,05' },
    ],
    valorArrecadado: 1000,
    valorAcumuladoProximoConcurso: 0,
    valorEstimadoProximoConcurso: '2.000.000',
    valorAcumuladoConcursoEspecial: null,
    campoDesconhecido: true,
  };
}

describe('criarMapeadorCaixa', () => {
  it('a quantidade de dezenas esperada vem de def.sorteadas', () => {
    // Arrange
    const mapearBase = criarMapeadorCaixa(BASE);
    const mapearZero = criarMapeadorCaixa(COM_ZERO);

    // Act / Assert
    expect(mapearBase(resposta(['01', '02', '03', '04', '05', '06'])).dezenas).toHaveLength(6);
    expect(mapearZero(resposta(['01', '02', '03', '04'])).dezenas).toHaveLength(4);
    expect(() => mapearBase(resposta(['01', '02', '03', '04']))).toThrow(/esperadas 6 dezenas, recebidas 4/);
    expect(() => mapearZero(resposta(['01', '02', '03', '04', '05', '06']))).toThrow(/esperadas 4 dezenas, recebidas 6/);
  });

  it('"00" é rejeitada quando a primeira dezena é 1 e aceita quando é 0', () => {
    // Arrange
    const mapearBase = criarMapeadorCaixa(BASE);
    const mapearZero = criarMapeadorCaixa(COM_ZERO);

    // Act / Assert
    expect(() => mapearBase(resposta(['00', '02', '03', '04', '05', '06']))).toThrow(/listaDezenas\[0\].*1\.\.60/);
    expect(mapearZero(resposta(['04', '00', '99', '50'])).dezenas).toEqual([0, 4, 50, 99]);
  });

  it('o limite superior vem de ultimaDezena (60 numa, 99 noutra)', () => {
    // Arrange
    const mapearBase = criarMapeadorCaixa(BASE);
    const mapearZero = criarMapeadorCaixa(COM_ZERO);

    // Act / Assert
    expect(() => mapearBase(resposta(['01', '02', '03', '04', '05', '61']))).toThrow(/1\.\.60/);
    expect(() => mapearZero(resposta(['01', '02', '03', '100']))).toThrow(/0\.\.99/);
    expect(mapearBase(resposta(['01', '02', '03', '04', '05', '60'])).dezenas[5]).toBe(60);
  });

  it('mapeia as premiações pela faixa numérica, convertendo valores para centavos, e tolera campos extras', () => {
    // Arrange
    const mapear = criarMapeadorCaixa(BASE);

    // Act
    const concurso = mapear(resposta(['01', '02', '03', '04', '05', '06']));

    // Assert
    expect(concurso.premiacoes).toEqual([
      { faixa: 1, ganhadores: 2, rateioCentavos: 123456n },
      { faixa: 2, ganhadores: 30, rateioCentavos: 1005n },
    ]);
    expect(concurso.data).toBe('2026-01-05');
    expect(concurso.acumulou).toBe(false);
    expect(concurso.arrecadacaoCentavos).toBe(100000n);
    expect(concurso.estimativaProximoCentavos).toBe(200000000n);
    expect(concurso.acumuladoEspecialCentavos).toBe(0n);
  });

  it('lista de rateio ausente vira premiações vazias', () => {
    // Arrange
    const mapear = criarMapeadorCaixa(BASE);
    const json = resposta(['01', '02', '03', '04', '05', '06']);
    delete json['listaRateioPremio'];

    // Act
    const concurso = mapear(json);

    // Assert
    expect(concurso.premiacoes).toEqual([]);
  });

  it('cada mapeador é independente: criar um com outra definição não altera o anterior', () => {
    // Arrange
    const mapearBase = criarMapeadorCaixa(BASE);
    criarMapeadorCaixa(COM_ZERO);

    // Act
    const executar = () => mapearBase(resposta(['00', '02', '03', '04', '05', '06']));

    // Assert
    expect(executar).toThrow(/1\.\.60/);
  });
});
