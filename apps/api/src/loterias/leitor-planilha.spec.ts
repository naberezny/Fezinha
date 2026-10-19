import { LOTOMANIA } from '@sorteios/loterias/lotomania/definicao';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena';
import ExcelJS from 'exceljs';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  dataIso,
  dinheiroEmCentavos,
  inteiro,
  lerPlanilha,
  mapearLinhas,
  separarLocais,
} from '../carga/leitor-planilha';
import { caminhoFixture, lerFixture } from '../carga/leitor-fixture';

// A carga histórica vive em apps/api/src/carga: seus testes rodam aqui, no projeto `api`.
describe('leitor da planilha da Caixa', () => {
  describe('conversões', () => {
    it.each([
      ['R$2.307.162,23', 230_716_223n],
      ['R$ 0,00', 0n],
      ['', 0n],
      [null, 0n],
      [1542.5, 154_250n],
      ['R$ 150.000.000,00', 15_000_000_000n],
    ])('dinheiroEmCentavos(%p) = %p', (entrada, esperado) => {
      // Act / Assert
      expect(dinheiroEmCentavos(entrada)).toBe(esperado);
    });

    it.each([
      ['1.234', 1234],
      ['2,0', 2],
      ['', 0],
      [null, 0],
      [7, 7],
      ['abc', 0],
    ])('inteiro(%p) = %p', (entrada, esperado) => {
      // Act / Assert
      expect(inteiro(entrada)).toBe(esperado);
    });

    it.each([
      ['11/03/1996', '1996-03-11'],
      ['1996-03-11', '1996-03-11'],
      [new Date(Date.UTC(1996, 2, 11)), '1996-03-11'],
      [35_135, '1996-03-11'],
    ])('dataIso(%p) = %p', (entrada, esperado) => {
      // Act / Assert
      expect(dataIso(entrada)).toBe(esperado);
    });

    it('dataIso lança erro para data vazia ou desconhecida', () => {
      // Act / Assert
      expect(() => dataIso(null)).toThrow('data vazia');
      expect(() => dataIso('ontem')).toThrow('data não reconhecida');
    });

    it('separarLocais separa cidade/UF, só UF e canal eletrônico, agrupando repetições', () => {
      // Act
      const locais = separarLocais(
        'MIRANTE DO PARANAPANEMA/SP; RJ; CANAL ELETRONICO; RJ',
      );

      // Assert
      expect(locais).toEqual([
        {
          cidade: 'MIRANTE DO PARANAPANEMA',
          uf: 'SP',
          descricao: 'MIRANTE DO PARANAPANEMA/SP',
          quantidade: 1,
        },
        { cidade: undefined, uf: 'RJ', descricao: 'RJ', quantidade: 2 },
        {
          cidade: 'CANAL ELETRONICO',
          uf: undefined,
          descricao: 'CANAL ELETRONICO',
          quantidade: 1,
        },
      ]);
      expect(separarLocais(null)).toEqual([]);
    });
  });

  describe('lerPlanilha', () => {
    const pasta = resolve(__dirname, '..', '..', 'tmp');
    const caminho = join(pasta, `planilha-${randomUUID()}.xlsx`);

    beforeAll(async () => {
      mkdirSync(pasta, { recursive: true });
      const livro = new ExcelJS.Workbook();
      const aba = livro.addWorksheet('MEGA SENA');
      aba.addRow([
        'Concurso',
        'Data do Sorteio',
        'Bola1',
        'Bola2',
        'Bola3',
        'Bola4',
        'Bola5',
        'Bola6',
        'Ganhadores 6 acertos',
        'Cidade / UF',
        'Rateio 6 acertos',
        'Ganhadores 5 acertos',
        'Rateio 5 acertos',
        'Ganhadores 4 acertos',
        'Rateio 4 acertos',
        'Acumulado 6 acertos',
        'Arrecadação Total',
        'Estimativa prêmio',
        'Acumulado Sorteio Especial Mega da Virada',
        'Observação',
      ]);
      aba.addRow([
        2,
        '18/03/1996',
        49,
        37,
        39,
        41,
        43,
        9,
        1,
        'DOURADOS/MS',
        'R$2.307.162,23',
        65,
        'R$14.424,02',
        4488,
        'R$208,91',
        'R$0,00',
        'R$0,00',
        'R$0,00',
        'R$0,00',
        '',
      ]);
      aba.addRow([
        1,
        '11/03/1996',
        4,
        5,
        30,
        33,
        41,
        52,
        0,
        '',
        'R$0,00',
        17,
        'R$39.158,92',
        2016,
        'R$330,21',
        'R$1.714.650,23',
        'R$0,00',
        'R$0,00',
        'R$0,00',
        'Acumulou',
      ]);
      aba.addRow(['linha incompleta']);
      aba.addRow([3, '25/03/1996', 1, 1, 2, 3, 4, 5, 0, '', 'R$0,00']); // dezena repetida: inválida
      await livro.xlsx.writeFile(caminho);
    });

    afterAll(() => rmSync(caminho, { force: true }));

    it('lê os concursos válidos em ordem crescente, ignorando cabeçalho e linhas inválidas', async () => {
      // Act
      const concursos = await lerPlanilha(caminho, MEGA_SENA);

      // Assert
      expect(concursos.map((c) => c.numero)).toEqual([1, 2]);
    });

    it('mapeia datas, dezenas ordenadas, rateios em centavos e situação de acúmulo', async () => {
      // Act
      const [primeiro, segundo] = await lerPlanilha(caminho, MEGA_SENA);

      // Assert
      expect(primeiro).toMatchObject({
        data: '1996-03-11',
        dezenas: [4, 5, 30, 33, 41, 52],
        acumulou: true,
        observacao: 'Acumulou',
        valorAcumuladoCentavos: 171_465_023n,
        locaisGanhadores: [],
      });
      expect(segundo).toMatchObject({
        data: '1996-03-18',
        dezenas: [9, 37, 39, 41, 43, 49],
        acumulou: false,
        observacao: undefined,
        locaisGanhadores: [
          {
            cidade: 'DOURADOS',
            uf: 'MS',
            descricao: 'DOURADOS/MS',
            quantidade: 1,
          },
        ],
      });
      expect(segundo.premiacoes).toEqual([
        { faixa: 1, ganhadores: 1, rateioCentavos: 230_716_223n },
        { faixa: 2, ganhadores: 65, rateioCentavos: 1_442_402n },
        { faixa: 3, ganhadores: 4488, rateioCentavos: 20_891n },
      ]);
    });

    it('lança erro quando não há nenhum concurso válido', async () => {
      // Arrange
      const vazio = join(pasta, `vazia-${randomUUID()}.xlsx`);
      const livro = new ExcelJS.Workbook();
      livro.addWorksheet('MEGA SENA').addRow(['Concurso', 'Data']);
      await livro.xlsx.writeFile(vazio);

      // Act / Assert
      try {
        await expect(lerPlanilha(vazio, MEGA_SENA)).rejects.toThrow(
          'Nenhum concurso válido',
        );
      } finally {
        rmSync(vazio, { force: true });
      }
    });
  });
});

describe('leitor da planilha da Caixa dirigido pela definição (Lotomania)', () => {
  const pasta = resolve(__dirname, '..', '..', 'tmp');
  const caminho = join(pasta, `planilha-lotomania-${randomUUID()}.xlsx`);
  const raiz = resolve(__dirname, '..', '..', '..', '..');
  const planilhaReal = join(raiz, 'Lotomania.xlsx');
  const planilhaMegaSena = join(raiz, 'Mega-Sena.xlsx');

  const cabecalho = [
    'Concurso',
    'Data Sorteio',
    ...Array.from({ length: 20 }, (_v, i) => `Bola${i + 1}`),
    'Ganhadores 20 acertos',
    'Cidade / UF',
    'Rateio 20 acertos',
    ...[19, 18, 17, 16, 15].flatMap((n) => [
      `Ganhadores ${n} acertos`,
      `Rateio ${n} acertos`,
    ]),
    'Ganhadores Nenhum Número',
    'Rateio Nenhum Número',
    'Acumulado 20 acertos',
    'Arrecadação Total',
    'Estimativa Prêmio',
    'Observação',
  ];

  type Faixa = [string | number, string];
  const SEM_PREMIO: Faixa = [0, 'R$0,00'];

  /** Linha no layout da Lotomania; `faixas` = [ganhadores, rateio] de 19, 18, 17, 16, 15 e nenhum acerto. */
  function linha(
    numero: number,
    data: string,
    bolas: string[],
    vinte: Faixa,
    faixas: Faixa[],
    cauda: [string, string, string, string],
    cidade = '',
  ) {
    return [numero, data, ...bolas, vinte[0], cidade, vinte[1], ...faixas.flat(), ...cauda];
  }

  const bolas1 = [
    '00', '06', '11', '14', '16', '21', '22', '25', '32', '33',
    '34', '46', '61', '70', '73', '78', '88', '89', '90', '95',
  ];
  const bolas2987 = [
    '07', '12', '20', '29', '31', '32', '39', '43', '44', '48',
    '50', '52', '60', '61', '69', '84', '85', '90', '91', '99',
  ];
  const seisSemPremio: Faixa[] = Array.from({ length: 6 }, () => SEM_PREMIO);

  beforeAll(async () => {
    mkdirSync(pasta, { recursive: true });
    const livro = new ExcelJS.Workbook();
    const aba = livro.addWorksheet('LOTOMANIA');
    aba.addRow(cabecalho);
    aba.addRow(
      linha(
        2987,
        '14/10/2026',
        bolas2987,
        SEM_PREMIO,
        [
          [6, 'R$65.953,91'],
          [95, 'R$2.603,44'],
          [955, 'R$258,98'],
          [5300, 'R$46,66'],
          [23297, 'R$10,61'],
          SEM_PREMIO,
        ],
        ['R$11.781.648,23', 'R$8.068.611,00', 'R$13.000.000,00', ''],
      ),
    );
    aba.addRow(
      linha(
        1,
        '02/10/1999',
        bolas1,
        SEM_PREMIO,
        [
          [1, 'R$118.746,87'],
          [46, 'R$2.581,46'],
          [446, 'R$132,62'],
          [2716, 'R$21,78'],
          ['-', '-'],
          SEM_PREMIO,
        ],
        ['R$178.120,31', 'R$0,00', 'R$0,00', 'Sorteio no Caminhão da Sorte.'],
      ),
    );
    // 20 acertos com ganhadores em duas cidades: não acumulou.
    aba.addRow(
      linha(
        3,
        '16/10/1999',
        bolas1,
        [2, 'R$500.000,00'],
        seisSemPremio,
        ['R$0,00', 'R$0,00', 'R$0,00', ''],
        'RECIFE/PE; SAO PAULO/SP',
      ),
    );
    // Inválidas: dezena 100 (fora de 00..99), dezena repetida e linha incompleta.
    aba.addRow(
      linha(
        4,
        '18/10/1999',
        [...bolas1.slice(0, 19), '100'],
        SEM_PREMIO,
        seisSemPremio,
        ['R$0,00', 'R$0,00', 'R$0,00', ''],
      ),
    );
    aba.addRow(
      linha(
        5,
        '20/10/1999',
        [...bolas1.slice(0, 19), '00'],
        SEM_PREMIO,
        seisSemPremio,
        ['R$0,00', 'R$0,00', 'R$0,00', ''],
      ),
    );
    aba.addRow(['linha incompleta']);
    await livro.xlsx.writeFile(caminho);
  });

  afterAll(() => rmSync(caminho, { force: true }));

  it('lê os concursos válidos em ordem crescente, ignorando dezena fora do volante e repetida', async () => {
    // Act
    const concursos = await lerPlanilha(caminho, LOTOMANIA);

    // Assert
    expect(concursos.map((c) => c.numero)).toEqual([1, 3, 2987]);
  });

  it('concurso 1: dezena 00 válida, "-" vira 0 e a faixa "Nenhum acerto" é a 7', async () => {
    // Act
    const [primeiro] = await lerPlanilha(caminho, LOTOMANIA);

    // Assert
    expect(primeiro).toMatchObject({
      numero: 1,
      data: '1999-10-02',
      acumulou: true,
      observacao: 'Sorteio no Caminhão da Sorte.',
      valorAcumuladoCentavos: 17_812_031n,
      estimativaProximoCentavos: 0n,
      arrecadacaoCentavos: 0n,
      acumuladoEspecialCentavos: 0n,
      locaisGanhadores: [],
    });
    expect(primeiro.dezenas).toEqual([
      0, 6, 11, 14, 16, 21, 22, 25, 32, 33, 34, 46, 61, 70, 73, 78, 88, 89, 90,
      95,
    ]);
    expect(primeiro.premiacoes).toEqual([
      { faixa: 1, ganhadores: 0, rateioCentavos: 0n },
      { faixa: 2, ganhadores: 1, rateioCentavos: 11_874_687n },
      { faixa: 3, ganhadores: 46, rateioCentavos: 258_146n },
      { faixa: 4, ganhadores: 446, rateioCentavos: 13_262n },
      { faixa: 5, ganhadores: 2716, rateioCentavos: 2_178n },
      { faixa: 6, ganhadores: 0, rateioCentavos: 0n },
      { faixa: 7, ganhadores: 0, rateioCentavos: 0n },
    ]);
  });

  it('concurso 2987: 7 faixas pelos cabeçalhos, acumulado e estimativa em centavos', async () => {
    // Act
    const concursos = await lerPlanilha(caminho, LOTOMANIA);
    const ultimo = concursos[concursos.length - 1];

    // Assert
    expect(ultimo).toMatchObject({
      numero: 2987,
      data: '2026-10-14',
      acumulou: true,
      observacao: undefined,
      valorAcumuladoCentavos: 1_178_164_823n,
      arrecadacaoCentavos: 806_861_100n,
      estimativaProximoCentavos: 1_300_000_000n,
    });
    expect(ultimo.dezenas).toEqual([
      7, 12, 20, 29, 31, 32, 39, 43, 44, 48, 50, 52, 60, 61, 69, 84, 85, 90,
      91, 99,
    ]);
    expect(ultimo.premiacoes).toEqual([
      { faixa: 1, ganhadores: 0, rateioCentavos: 0n },
      { faixa: 2, ganhadores: 6, rateioCentavos: 6_595_391n },
      { faixa: 3, ganhadores: 95, rateioCentavos: 260_344n },
      { faixa: 4, ganhadores: 955, rateioCentavos: 25_898n },
      { faixa: 5, ganhadores: 5300, rateioCentavos: 4_666n },
      { faixa: 6, ganhadores: 23_297, rateioCentavos: 1_061n },
      { faixa: 7, ganhadores: 0, rateioCentavos: 0n },
    ]);
  });

  it('com ganhadores dos 20 acertos o concurso não acumulou e os locais são lidos', async () => {
    // Act
    const concursos = await lerPlanilha(caminho, LOTOMANIA);
    const terceiro = concursos.find((c) => c.numero === 3);

    // Assert
    expect(terceiro?.acumulou).toBe(false);
    expect(terceiro?.premiacoes[0]).toEqual({
      faixa: 1,
      ganhadores: 2,
      rateioCentavos: 50_000_000n,
    });
    expect(terceiro?.locaisGanhadores.map((l) => l.descricao)).toEqual([
      'RECIFE/PE',
      'SAO PAULO/SP',
    ]);
  });

  it('falta de uma coluna Bola é erro claro, não um resultado silenciosamente errado', () => {
    // Arrange
    const semBola20 = cabecalho.filter((c) => c !== 'Bola20');

    // Act / Assert
    expect(() => mapearLinhas([semBola20], LOTOMANIA)).toThrow(
      /Nenhum concurso válido.*Bola20/,
    );
  });

  (existsSync(planilhaReal) ? it : it.skip)(
    'a planilha oficial Lotomania.xlsx produz exatamente o fixture congelado (2987 concursos)',
    async () => {
      // Act
      const daPlanilha = await lerPlanilha(planilhaReal, LOTOMANIA);

      // Assert
      expect(daPlanilha).toHaveLength(2987);
      expect(daPlanilha).toEqual(lerFixture(caminhoFixture('lotomania')));
    },
  );

  (existsSync(planilhaMegaSena) ? it : it.skip)(
    'a planilha oficial Mega-Sena.xlsx continua produzindo exatamente o fixture (3070 concursos)',
    async () => {
      // Act
      const daPlanilha = await lerPlanilha(planilhaMegaSena, MEGA_SENA);

      // Assert
      expect(daPlanilha).toHaveLength(3070);
      expect(daPlanilha).toEqual(lerFixture(caminhoFixture('megasena')));
    },
  );
});
