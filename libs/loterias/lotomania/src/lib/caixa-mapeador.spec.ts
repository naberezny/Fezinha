import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOTOMANIA } from './definicao';
import { mapearRespostaCaixaLotomania } from './caixa-mapeador';

type Json = Record<string, unknown>;

const FIXTURES = join(__dirname, 'fixtures');

/** Lê a resposta real da Caixa; cada chamada devolve um objeto novo para o teste alterar à vontade. */
function respostaReal(nome = 'caixa-lotomania-2987.json'): Json {
  return JSON.parse(readFileSync(join(FIXTURES, nome), 'utf8')) as Json;
}

/** Concurso 1 (02/10/1999), montado à mão sobre o molde da resposta real: traz a dezena 00. */
function respostaConcursoUm(): Json {
  const json = respostaReal();
  json['numero'] = 1;
  json['dataApuracao'] = '02/10/1999';
  json['listaDezenas'] = ['00', '06', '11', '14', '16', '21', '22', '25', '32', '33', '34', '46', '61', '70', '73', '78', '88', '89', '90', '95'];
  delete json['dezenasSorteadasOrdemSorteio'];
  delete json['numeroConcursoProximo'];
  delete json['dataProximoConcurso'];
  return json;
}

describe('mapearRespostaCaixaLotomania — resposta real da Caixa (concurso 2987)', () => {
  it('mapeia número, data ISO, 20 dezenas crescentes e acumulou', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const concurso = mapearRespostaCaixaLotomania(json);

    // Assert
    expect(concurso.numero).toBe(2987);
    expect(concurso.data).toBe('2026-10-14');
    expect(concurso.dezenas).toEqual([7, 12, 20, 29, 31, 32, 39, 43, 44, 48, 50, 52, 60, 61, 69, 84, 85, 90, 91, 99]);
    expect(concurso.dezenas).toHaveLength(20);
    expect(concurso.acumulou).toBe(true);
  });

  it('mapeia as 7 premiações (20 a 15 acertos e nenhum acerto) com centavos exatos', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const { premiacoes } = mapearRespostaCaixaLotomania(json);

    // Assert
    expect(premiacoes).toEqual([
      { faixa: 1, ganhadores: 0, rateioCentavos: 0n },
      { faixa: 2, ganhadores: 6, rateioCentavos: 6595391n },
      { faixa: 3, ganhadores: 95, rateioCentavos: 260344n },
      { faixa: 4, ganhadores: 955, rateioCentavos: 25898n },
      { faixa: 5, ganhadores: 5300, rateioCentavos: 4666n },
      { faixa: 6, ganhadores: 23297, rateioCentavos: 1061n },
      { faixa: 7, ganhadores: 0, rateioCentavos: 0n },
    ]);
  });

  it('as faixas mapeadas coincidem com as faixas da definição da Lotomania', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const { premiacoes } = mapearRespostaCaixaLotomania(json);

    // Assert
    expect(premiacoes.map((p) => p.faixa)).toEqual(LOTOMANIA.faixas.map((f) => f.faixa));
  });

  it('mapeia valores monetários e dados do próximo concurso', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const concurso = mapearRespostaCaixaLotomania(json);

    // Assert
    expect(concurso.arrecadacaoCentavos).toBe(806861100n);
    expect(concurso.estimativaProximoCentavos).toBe(1300000000n);
    expect(concurso.valorAcumuladoCentavos).toBe(1178164823n);
    expect(concurso.acumuladoEspecialCentavos).toBe(0n);
    expect(concurso.proximoNumero).toBe(2988);
    expect(concurso.dataProximoSorteio).toBe('2026-10-16');
  });

  it('observação vazia vira ausente e lista de ganhadores vazia vira []', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const concurso = mapearRespostaCaixaLotomania(json);

    // Assert
    expect(concurso.observacao).toBeUndefined();
    expect(concurso.locaisGanhadores).toEqual([]);
  });

  it('ignora campos extras e não depende da ordem das dezenas', () => {
    // Arrange: a resposta real traz dezenasSorteadasOrdemSorteio e campos de controle
    const json = respostaReal();
    json['campoNovoDaCaixa'] = { qualquer: 'coisa' };
    json['listaDezenas'] = [...(json['listaDezenas'] as string[])].reverse();

    // Act
    const concurso = mapearRespostaCaixaLotomania(json);

    // Assert
    expect(concurso.dezenas[0]).toBe(7);
    expect(concurso.dezenas[19]).toBe(99);
  });
});

describe('mapearRespostaCaixaLotomania — resposta real do último concurso', () => {
  it('mapeia 20 dezenas válidas em 0..99, 7 premiações e valores consistentes', () => {
    // Arrange
    const json = respostaReal('caixa-lotomania-ultimo.json');

    // Act
    const concurso = mapearRespostaCaixaLotomania(json);

    // Assert
    expect(concurso.numero).toBeGreaterThanOrEqual(2987);
    expect(concurso.dezenas).toHaveLength(20);
    expect(new Set(concurso.dezenas).size).toBe(20);
    expect(concurso.dezenas.every((d) => d >= 0 && d <= 99)).toBe(true);
    expect(concurso.premiacoes).toHaveLength(7);
    expect(concurso.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(concurso.arrecadacaoCentavos).toBeGreaterThan(0n);
  });
});

describe('mapearRespostaCaixaLotomania — dezena 00 (concurso 1, 02/10/1999)', () => {
  it('"00" vira a dezena 0 e fica em primeiro lugar na ordem crescente', () => {
    // Arrange
    const json = respostaConcursoUm();

    // Act
    const concurso = mapearRespostaCaixaLotomania(json);

    // Assert
    expect(concurso.numero).toBe(1);
    expect(concurso.data).toBe('1999-10-02');
    expect(concurso.dezenas).toEqual([0, 6, 11, 14, 16, 21, 22, 25, 32, 33, 34, 46, 61, 70, 73, 78, 88, 89, 90, 95]);
    expect(concurso.dezenas[0]).toBe(0);
    expect(concurso.proximoNumero).toBeUndefined();
    expect(concurso.dataProximoSorteio).toBeUndefined();
  });

  it('aceita a dezena 0 também como número e fora de ordem', () => {
    // Arrange
    const json = respostaConcursoUm();
    json['listaDezenas'] = [95, 6, 11, 14, 16, 21, 22, 25, 32, 33, 34, 46, 61, 70, 73, 78, 88, 89, 90, 0];

    // Act
    const concurso = mapearRespostaCaixaLotomania(json);

    // Assert
    expect(concurso.dezenas[0]).toBe(0);
    expect(concurso.dezenas[19]).toBe(95);
  });

  it('00 repetida gera erro de dezenas repetidas', () => {
    // Arrange
    const json = respostaConcursoUm();
    const dezenas = json['listaDezenas'] as string[];
    dezenas[1] = '00';

    // Act
    const executar = () => mapearRespostaCaixaLotomania(json);

    // Assert
    expect(executar).toThrow(/listaDezenas.*repetidas/);
  });
});

describe('mapearRespostaCaixaLotomania — erros', () => {
  it('dezena 100 gera erro citando o intervalo 0..99', () => {
    // Arrange
    const json = respostaReal();
    (json['listaDezenas'] as string[])[19] = '100';

    // Act
    const executar = () => mapearRespostaCaixaLotomania(json);

    // Assert
    expect(executar).toThrow(/listaDezenas\[19\].*0\.\.99/);
  });

  it('dezena negativa ou não numérica gera erro', () => {
    // Arrange
    const negativa = respostaReal();
    (negativa['listaDezenas'] as unknown[])[0] = -1;
    const texto = respostaReal();
    (texto['listaDezenas'] as unknown[])[0] = 'AB';

    // Act / Assert
    expect(() => mapearRespostaCaixaLotomania(negativa)).toThrow(/listaDezenas\[0\]/);
    expect(() => mapearRespostaCaixaLotomania(texto)).toThrow(/listaDezenas\[0\]/);
  });

  it('quantidade de dezenas diferente de 20 gera erro', () => {
    // Arrange
    const json = respostaReal();
    json['listaDezenas'] = (json['listaDezenas'] as string[]).slice(0, 19);

    // Act
    const executar = () => mapearRespostaCaixaLotomania(json);

    // Assert
    expect(executar).toThrow(/listaDezenas.*20 dezenas/);
  });

  it('listaDezenas ausente gera erro mencionando listaDezenas', () => {
    // Arrange
    const json = respostaReal();
    delete json['listaDezenas'];

    // Act
    const executar = () => mapearRespostaCaixaLotomania(json);

    // Assert
    expect(executar).toThrow(/listaDezenas/);
    expect(executar).toThrow(/Resposta da Caixa inválida/);
  });

  it('entrada que não é objeto gera erro em português', () => {
    // Arrange
    const entradas: unknown[] = [null, undefined, 'texto', 42, []];

    // Act / Assert
    for (const entrada of entradas) {
      expect(() => mapearRespostaCaixaLotomania(entrada)).toThrow(/Resposta da Caixa inválida/);
    }
  });

  it('o erro lançado é Error comum (não ZodError)', () => {
    // Arrange
    const json = respostaReal();
    delete json['listaDezenas'];

    // Act
    let erro: unknown;
    try {
      mapearRespostaCaixaLotomania(json);
    } catch (e) {
      erro = e;
    }

    // Assert
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).name).toBe('Error');
  });
});
