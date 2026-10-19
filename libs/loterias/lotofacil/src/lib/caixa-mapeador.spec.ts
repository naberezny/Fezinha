import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOTOFACIL } from './definicao';
import { mapearRespostaCaixaLotofacil } from './caixa-mapeador';

type Json = Record<string, unknown>;

const FIXTURES = join(__dirname, 'fixtures');

/** Lê a resposta real da Caixa; cada chamada devolve um objeto novo para o teste alterar à vontade. */
function respostaReal(nome = 'caixa-lotofacil-3807.json'): Json {
  return JSON.parse(readFileSync(join(FIXTURES, nome), 'utf8')) as Json;
}

describe('mapearRespostaCaixaLotofacil — resposta real da Caixa (concurso 3807)', () => {
  it('mapeia número, data ISO, 15 dezenas crescentes e acumulou', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const concurso = mapearRespostaCaixaLotofacil(json);

    // Assert
    expect(concurso.numero).toBe(3807);
    expect(concurso.data).toBe('2026-10-18');
    expect(concurso.dezenas).toEqual([1, 3, 4, 7, 10, 11, 13, 16, 17, 19, 20, 22, 23, 24, 25]);
    expect(concurso.acumulou).toBe(false);
  });

  it('mapeia as 5 premiações (15 a 11 acertos) com centavos exatos', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const { premiacoes } = mapearRespostaCaixaLotofacil(json);

    // Assert
    expect(premiacoes).toEqual([
      { faixa: 1, ganhadores: 3, rateioCentavos: 44538624n },
      { faixa: 2, ganhadores: 341, rateioCentavos: 117370n },
      { faixa: 3, ganhadores: 10878, rateioCentavos: 3500n },
      { faixa: 4, ganhadores: 115002, rateioCentavos: 1400n },
      { faixa: 5, ganhadores: 548026, rateioCentavos: 700n },
    ]);
  });

  it('as faixas mapeadas coincidem com as faixas da definição da Lotofácil', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const { premiacoes } = mapearRespostaCaixaLotofacil(json);

    // Assert
    expect(premiacoes.map((p) => p.faixa)).toEqual(LOTOFACIL.faixas.map((f) => f.faixa));
  });

  it('mapeia valores monetários (incluindo o acumulado da Lotofácil da Independência) e o próximo concurso', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const concurso = mapearRespostaCaixaLotofacil(json);

    // Assert
    expect(concurso.arrecadacaoCentavos).toBe(2033717000n);
    expect(concurso.estimativaProximoCentavos).toBe(200000000n);
    expect(concurso.valorAcumuladoCentavos).toBe(0n);
    expect(concurso.acumuladoEspecialCentavos).toBe(1232460561n);
    expect(concurso.proximoNumero).toBe(3808);
    expect(concurso.dataProximoSorteio).toBe('2026-10-19');
    expect(concurso.observacao).toBeUndefined();
  });

  it('mapeia os 3 locais de ganhadores; "CANAL ELETRONICO" com UF "--" fica sem UF', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const { locaisGanhadores } = mapearRespostaCaixaLotofacil(json);

    // Assert
    expect(locaisGanhadores).toEqual([
      { descricao: 'CANAL ELETRONICO', cidade: 'CANAL ELETRONICO', quantidade: 1 },
      { descricao: 'PORECATU/PR', cidade: 'PORECATU', uf: 'PR', quantidade: 1 },
      { descricao: 'MIRANTE DO PARANAPANEMA/SP', cidade: 'MIRANTE DO PARANAPANEMA', uf: 'SP', quantidade: 1 },
    ]);
  });
});

describe('mapearRespostaCaixaLotofacil — resposta real do último concurso', () => {
  it('mapeia 15 dezenas válidas em 1..25, 5 premiações e valores consistentes', () => {
    // Arrange
    const json = respostaReal('caixa-lotofacil-ultimo.json');

    // Act
    const concurso = mapearRespostaCaixaLotofacil(json);

    // Assert
    expect(concurso.numero).toBeGreaterThanOrEqual(3807);
    expect(concurso.dezenas).toHaveLength(15);
    expect(new Set(concurso.dezenas).size).toBe(15);
    expect(concurso.dezenas.every((d) => d >= 1 && d <= 25)).toBe(true);
    expect(concurso.premiacoes).toHaveLength(5);
    expect(concurso.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(concurso.arrecadacaoCentavos).toBeGreaterThan(0n);
  });
});

describe('mapearRespostaCaixaLotofacil — erros', () => {
  it('dezena 26 gera erro citando o intervalo 1..25', () => {
    // Arrange
    const json = respostaReal();
    (json['listaDezenas'] as string[])[14] = '26';

    // Act
    const executar = () => mapearRespostaCaixaLotofacil(json);

    // Assert
    expect(executar).toThrow(/listaDezenas\[14\].*1\.\.25/);
  });

  it('dezena 00 não existe na Lotofácil', () => {
    // Arrange
    const json = respostaReal();
    (json['listaDezenas'] as string[])[0] = '00';

    // Act
    const executar = () => mapearRespostaCaixaLotofacil(json);

    // Assert
    expect(executar).toThrow(/listaDezenas\[0\].*1\.\.25/);
  });

  it('quantidade de dezenas diferente de 15 gera erro', () => {
    // Arrange
    const json = respostaReal();
    json['listaDezenas'] = (json['listaDezenas'] as string[]).slice(0, 14);

    // Act
    const executar = () => mapearRespostaCaixaLotofacil(json);

    // Assert
    expect(executar).toThrow(/listaDezenas.*15 dezenas/);
  });

  it('dezenas repetidas geram erro', () => {
    // Arrange
    const json = respostaReal();
    const dezenas = json['listaDezenas'] as string[];
    dezenas[1] = dezenas[0];

    // Act
    const executar = () => mapearRespostaCaixaLotofacil(json);

    // Assert
    expect(executar).toThrow(/listaDezenas.*repetidas/);
  });
});
