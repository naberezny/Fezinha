import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapearRespostaCaixa } from './caixa-mapeador';

type Json = Record<string, unknown>;

function lerJson(caminho: string): Json {
  return JSON.parse(readFileSync(caminho, 'utf8')) as Json;
}

const FIXTURES = join(__dirname, 'fixtures');
const RAIZ = join(__dirname, '..', '..', '..', '..', '..');

/** Cópia profunda da resposta real para cada teste alterar à vontade. */
function respostaReal(nome = 'caixa-megasena-ultimo.json'): Json {
  return lerJson(join(FIXTURES, nome));
}

describe('mapearRespostaCaixa — resposta real da Caixa (concurso 3070)', () => {
  it('mapeia número, data ISO, dezenas crescentes e acumulou', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const concurso = mapearRespostaCaixa(json);

    // Assert
    expect(concurso.numero).toBe(3070);
    expect(concurso.data).toBe('2026-10-14');
    expect(concurso.dezenas).toEqual([19, 27, 29, 43, 54, 60]);
    expect(concurso.acumulou).toBe(true);
  });

  it('mapeia as 3 premiações com centavos exatos', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const { premiacoes } = mapearRespostaCaixa(json);

    // Assert
    expect(premiacoes).toEqual([
      { faixa: 1, ganhadores: 0, rateioCentavos: 0n },
      { faixa: 2, ganhadores: 91, rateioCentavos: 5276796n },
      { faixa: 3, ganhadores: 7384, rateioCentavos: 107193n },
    ]);
  });

  it('mapeia valores monetários e dados do próximo concurso', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const concurso = mapearRespostaCaixa(json);

    // Assert
    expect(concurso.valorAcumuladoCentavos).toBe(15269598822n);
    expect(concurso.estimativaProximoCentavos).toBe(17000000000n);
    expect(concurso.arrecadacaoCentavos).toBe(12050230200n);
    expect(concurso.acumuladoEspecialCentavos).toBe(9738087558n);
    expect(concurso.proximoNumero).toBe(3071);
    expect(concurso.dataProximoSorteio).toBe('2026-10-18');
  });

  it('observação vazia vira ausente e lista de ganhadores vazia vira []', () => {
    // Arrange
    const json = respostaReal();

    // Act
    const concurso = mapearRespostaCaixa(json);

    // Assert
    expect(concurso.observacao).toBeUndefined();
    expect(concurso.locaisGanhadores).toEqual([]);
  });

  it('ignora campos extras e não depende da ordem de sorteio', () => {
    // Arrange: a resposta real traz dezenasSorteadasOrdemSorteio e dezenas de controle
    const json = respostaReal();
    json['campoNovoDaCaixa'] = { qualquer: 'coisa' };
    json['listaDezenas'] = ['60', '19', '43', '27', '54', '29'];

    // Act
    const concurso = mapearRespostaCaixa(json);

    // Assert
    expect(concurso.dezenas).toEqual([19, 27, 29, 43, 54, 60]);
  });

  it('o concurso 3070 busca específico bate com o fixture legado', () => {
    // Arrange
    const real = respostaReal('caixa-megasena-3070.json');
    const legado = lerJson(join(RAIZ, 'tools', 'fixtures', 'megasena-3070.json')) as {
      concursos: Array<{
        numero: number;
        data: string;
        dezenas: number[];
        valorAcumuladoCentavos: number;
        estimativaProximoCentavos: number;
        arrecadacaoCentavos: number;
        premiacoes: Array<{ faixa: number; ganhadores: number; rateioCentavos: number }>;
      }>;
    };
    const esperado = legado.concursos.find((c) => c.numero === 3070);
    expect(esperado).toBeDefined();

    // Act
    const concurso = mapearRespostaCaixa(real);

    // Assert
    expect(concurso.dezenas).toEqual(esperado?.dezenas);
    expect(concurso.data).toBe(esperado?.data);
    expect(concurso.valorAcumuladoCentavos).toBe(15269598822n);
    expect(concurso.valorAcumuladoCentavos).toBe(BigInt(esperado?.valorAcumuladoCentavos ?? -1));
    expect(concurso.estimativaProximoCentavos).toBe(BigInt(esperado?.estimativaProximoCentavos ?? -1));
    expect(concurso.arrecadacaoCentavos).toBe(BigInt(esperado?.arrecadacaoCentavos ?? -1));
    expect(
      concurso.premiacoes.map((p) => ({ faixa: p.faixa, ganhadores: p.ganhadores, rateioCentavos: Number(p.rateioCentavos) })),
    ).toEqual(esperado?.premiacoes.map(({ faixa, ganhadores, rateioCentavos }) => ({ faixa, ganhadores, rateioCentavos })));
  });
});

describe('mapearRespostaCaixa — locais de ganhadores', () => {
  it('monta cidade, UF e descrição a partir de município e UF', () => {
    // Arrange
    const json = respostaReal();
    json['acumulado'] = false;
    json['listaMunicipioUFGanhadores'] = [
      { ganhadores: 1, municipio: 'DOURADOS', uf: 'MS', posicao: 1, serie: '' },
      { ganhadores: 2, municipio: '', uf: 'SP' },
      { ganhadores: 1, municipio: 'CANAL ELETRONICO', uf: '--' },
    ];

    // Act
    const { locaisGanhadores, acumulou } = mapearRespostaCaixa(json);

    // Assert
    expect(acumulou).toBe(false);
    expect(locaisGanhadores).toEqual([
      { cidade: 'DOURADOS', uf: 'MS', descricao: 'DOURADOS/MS', quantidade: 1 },
      { uf: 'SP', descricao: 'SP', quantidade: 2 },
      { cidade: 'CANAL ELETRONICO', descricao: 'CANAL ELETRONICO', quantidade: 1 },
    ]);
  });
});

describe('mapearRespostaCaixa — valores monetários', () => {
  it('texto "1.234,56" vira 123456n', () => {
    // Arrange
    const json = respostaReal();
    json['valorArrecadado'] = '1.234,56';

    // Act
    const concurso = mapearRespostaCaixa(json);

    // Assert
    expect(concurso.arrecadacaoCentavos).toBe(123456n);
  });

  it('número 1234.56 vira 123456n sem erro de ponto flutuante', () => {
    // Arrange
    const json = respostaReal();
    json['valorArrecadado'] = 1234.56;

    // Act
    const concurso = mapearRespostaCaixa(json);

    // Assert
    expect(concurso.arrecadacaoCentavos).toBe(123456n);
  });

  it('número com representação binária ruim (1.005 e 0.29) arredonda para o centavo certo', () => {
    // Arrange
    const json = respostaReal();
    json['valorArrecadado'] = 0.29;
    json['valorEstimadoProximoConcurso'] = 4.35;

    // Act
    const concurso = mapearRespostaCaixa(json);

    // Assert
    expect(concurso.arrecadacaoCentavos).toBe(29n);
    expect(concurso.estimativaProximoCentavos).toBe(435n);
  });

  it('texto com ponto decimal e texto sem centavos são aceitos', () => {
    // Arrange
    const json = respostaReal();
    json['valorArrecadado'] = '1234.5';
    json['valorEstimadoProximoConcurso'] = '2.000.000';

    // Act
    const concurso = mapearRespostaCaixa(json);

    // Assert
    expect(concurso.arrecadacaoCentavos).toBe(123450n);
    expect(concurso.estimativaProximoCentavos).toBe(200000000n);
  });

  it('valor ausente ou nulo vale zero', () => {
    // Arrange
    const json = respostaReal();
    delete json['valorArrecadado'];
    json['valorAcumuladoConcursoEspecial'] = null;

    // Act
    const concurso = mapearRespostaCaixa(json);

    // Assert
    expect(concurso.arrecadacaoCentavos).toBe(0n);
    expect(concurso.acumuladoEspecialCentavos).toBe(0n);
  });

  it('valor monetário ilegível gera erro citando o campo', () => {
    // Arrange
    const json = respostaReal();
    json['valorArrecadado'] = 'abc';

    // Act
    const executar = () => mapearRespostaCaixa(json);

    // Assert
    expect(executar).toThrow(/valorArrecadado/);
  });
});

describe('mapearRespostaCaixa — erros', () => {
  it('listaDezenas ausente gera erro mencionando listaDezenas', () => {
    // Arrange
    const json = respostaReal();
    delete json['listaDezenas'];

    // Act
    const executar = () => mapearRespostaCaixa(json);

    // Assert
    expect(executar).toThrow(/listaDezenas/);
    expect(executar).toThrow(/Resposta da Caixa inválida/);
  });

  it('dezena fora de 1..60 gera erro', () => {
    // Arrange
    const json = respostaReal();
    json['listaDezenas'] = ['19', '27', '29', '43', '54', '61'];

    // Act
    const executar = () => mapearRespostaCaixa(json);

    // Assert
    expect(executar).toThrow(/listaDezenas\[5\].*1\.\.60/);
  });

  it('dezena zero gera erro', () => {
    // Arrange
    const json = respostaReal();
    json['listaDezenas'] = ['00', '27', '29', '43', '54', '60'];

    // Act
    const executar = () => mapearRespostaCaixa(json);

    // Assert
    expect(executar).toThrow(/listaDezenas\[0\]/);
  });

  it('quantidade de dezenas diferente de 6 gera erro', () => {
    // Arrange
    const json = respostaReal();
    json['listaDezenas'] = ['19', '27', '29'];

    // Act
    const executar = () => mapearRespostaCaixa(json);

    // Assert
    expect(executar).toThrow(/listaDezenas.*6 dezenas/);
  });

  it('dezenas repetidas geram erro', () => {
    // Arrange
    const json = respostaReal();
    json['listaDezenas'] = ['19', '19', '29', '43', '54', '60'];

    // Act
    const executar = () => mapearRespostaCaixa(json);

    // Assert
    expect(executar).toThrow(/listaDezenas.*repetidas/);
  });

  it('data inválida gera erro citando dataApuracao', () => {
    // Arrange
    const json = respostaReal();
    json['dataApuracao'] = '31/02/2026';

    // Act
    const executar = () => mapearRespostaCaixa(json);

    // Assert
    expect(executar).toThrow(/dataApuracao/);
  });

  it('data em formato ISO (não dd/mm/aaaa) gera erro', () => {
    // Arrange
    const json = respostaReal();
    json['dataApuracao'] = '2026-10-14';

    // Act
    const executar = () => mapearRespostaCaixa(json);

    // Assert
    expect(executar).toThrow(/dataApuracao.*dd\/mm\/aaaa/);
  });

  it('dataProximoConcurso inválida gera erro, mas ausente é aceita', () => {
    // Arrange
    const invalida = respostaReal();
    invalida['dataProximoConcurso'] = '99/99/9999';
    const ausente = respostaReal();
    delete ausente['dataProximoConcurso'];
    delete ausente['numeroConcursoProximo'];

    // Act
    const executarInvalida = () => mapearRespostaCaixa(invalida);
    const concurso = mapearRespostaCaixa(ausente);

    // Assert
    expect(executarInvalida).toThrow(/dataProximoConcurso/);
    expect(concurso.dataProximoSorteio).toBeUndefined();
    expect(concurso.proximoNumero).toBeUndefined();
  });

  it('número do concurso ausente gera erro citando numero', () => {
    // Arrange
    const json = respostaReal();
    delete json['numero'];

    // Act
    const executar = () => mapearRespostaCaixa(json);

    // Assert
    expect(executar).toThrow(/"numero"/);
  });

  it('erro em item da lista de rateio cita o caminho completo', () => {
    // Arrange
    const json = respostaReal();
    json['listaRateioPremio'] = [{ faixa: 1, numeroDeGanhadores: 0, valorPremio: 'xyz' }];

    // Act
    const executar = () => mapearRespostaCaixa(json);

    // Assert
    expect(executar).toThrow(/listaRateioPremio\[0\]\.valorPremio/);
  });

  it('entrada que não é objeto gera erro em português', () => {
    // Arrange
    const entradas: unknown[] = [null, undefined, 'texto', 42, []];

    // Act / Assert
    for (const entrada of entradas) {
      expect(() => mapearRespostaCaixa(entrada)).toThrow(/Resposta da Caixa inválida/);
    }
  });

  it('o erro lançado é Error comum (não ZodError)', () => {
    // Arrange
    const json = respostaReal();
    delete json['listaDezenas'];

    // Act
    let erro: unknown;
    try {
      mapearRespostaCaixa(json);
    } catch (e) {
      erro = e;
    }

    // Assert
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).name).toBe('Error');
  });
});
