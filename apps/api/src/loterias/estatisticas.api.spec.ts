import { INestApplication } from '@nestjs/common';
import * as core from '@sorteios/core';
import request from 'supertest';
import { LoteriasService } from './loterias.service';
import { carregarFixtureNoBanco, criarAppDeTeste } from '../testes/app-teste';
import {
  type BancoTemporario,
  criarBancoTemporario,
} from '../testes/banco-temporario';

// O cálculo é da lib `core` (testado lá). Aqui só se prova o contrato HTTP: parâmetros repassados e forma da resposta.
jest.mock('@sorteios/core', () => ({
  ...jest.requireActual('@sorteios/core'),
  recortarPeriodo: jest.fn(),
  calcularEstatisticas: jest.fn(),
  distribuicaoPares: jest.fn(),
  distribuicaoSoma: jest.fn(),
  resumoPorAno: jest.fn(),
  frequenciaPorMes: jest.fn(),
}));

const mockado = <T extends (...args: never[]) => unknown>(funcao: T) =>
  funcao as unknown as jest.Mock;

describe('GET /loterias/:id/estatisticas', () => {
  let banco: BancoTemporario;
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    banco = await criarBancoTemporario();
    app = await criarAppDeTeste(banco.url);
    await carregarFixtureNoBanco(app, 100);
  });

  afterAll(async () => {
    await app.close();
    await banco.remover();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // O serviço guarda o resultado por histórico em cache: invalidar para cada teste recalcular.
    app.get(LoteriasService).invalidar('megasena');
    mockado(core.recortarPeriodo).mockImplementation(
      (historico: core.Historico) => ({
        loteria: historico.loteria,
        concursos: historico.concursos.slice(-50),
      }),
    );
    mockado(core.calcularEstatisticas).mockReturnValue([
      {
        dezena: 10,
        frequencia: 7,
        atraso: 3,
        atrasoMaximo: 40,
        ultimoConcurso: 3067,
        ultimaData: '2026-10-06',
        probAusencia: 0.729,
      },
      {
        dezena: 11,
        frequencia: 0,
        atraso: 100,
        atrasoMaximo: 100,
        probAusencia: 0.0000265,
      },
    ]);
    mockado(core.distribuicaoPares).mockReturnValue([
      { pares: 2, total: 12 },
      { pares: 3, total: 38 },
    ]);
    mockado(core.distribuicaoSoma).mockReturnValue([{ inicio: 120, total: 9 }]);
    mockado(core.resumoPorAno).mockReturnValue([
      {
        ano: 2026,
        concursos: 100,
        acumulados: 60,
        ganhadores: 40,
        maiorPremioCentavos: 123_456_789_012n,
      },
    ]);
    mockado(core.frequenciaPorMes).mockReturnValue([
      { anoMes: '2026-10', dezena: 10, total: 2 },
    ]);
  });

  it('devolve o contrato completo e converte BigInt em number', async () => {
    // Act
    const resposta = await http()
      .get('/loterias/megasena/estatisticas?periodo=ultimos:50')
      .expect(200);

    // Assert
    expect(resposta.body).toEqual({
      periodo: 'ultimos:50',
      concursosNoPeriodo: 50,
      dezenas: [
        {
          dezena: 10,
          frequencia: 7,
          atraso: 3,
          atrasoMaximo: 40,
          ultimoConcurso: 3067,
          ultimaData: '2026-10-06',
          probAusencia: 0.729,
        },
        {
          dezena: 11,
          frequencia: 0,
          atraso: 100,
          atrasoMaximo: 100,
          probAusencia: 0.0000265,
        },
      ],
      pares: [
        { pares: 2, total: 12 },
        { pares: 3, total: 38 },
      ],
      soma: [{ inicio: 120, total: 9 }],
      porAno: [
        {
          ano: 2026,
          concursos: 100,
          acumulados: 60,
          ganhadores: 40,
          maiorPremioCentavos: 123_456_789_012,
        },
      ],
      porMes: [{ anoMes: '2026-10', dezena: 10, total: 2 }],
    });
    expect(resposta.text).not.toContain('bigint');
  });

  it('repassa ao core o período, a faixa de soma (20) e a janela do mapa de calor (12 meses)', async () => {
    // Act
    await http()
      .get('/loterias/megasena/estatisticas?periodo=ano:2026')
      .expect(200);

    // Assert
    const historicoPassado = mockado(core.calcularEstatisticas).mock
      .calls[0][0] as core.Historico;
    expect(historicoPassado.concursos).toHaveLength(100);
    expect(historicoPassado.loteria.id).toBe('megasena');
    expect(mockado(core.calcularEstatisticas).mock.calls[0][1]).toEqual({
      tipo: 'ano',
      ano: 2026,
    });
    expect(mockado(core.distribuicaoSoma).mock.calls[0][1]).toBe(20);
    expect(mockado(core.frequenciaPorMes).mock.calls[0][1]).toBe(12);
  });

  it.each([
    ['ultimos:100', { tipo: 'ultimos', quantidade: 100 }],
    ['tudo', { tipo: 'tudo' }],
    [undefined, { tipo: 'ultimos', quantidade: 50 }],
  ])('interpreta o período %s', async (periodo, esperado) => {
    // Act
    const resposta = await http()
      .get('/loterias/megasena/estatisticas')
      .query(periodo ? { periodo } : {})
      .expect(200);

    // Assert
    expect(mockado(core.calcularEstatisticas).mock.calls[0][1]).toEqual(
      esperado,
    );
    expect(resposta.body.periodo).toBe(periodo ?? 'ultimos:50');
  });

  it.each(['ultimos:0', 'ultimos:abc', 'ano:1', 'semana:3', 'tudo:1'])(
    'rejeita o período inválido %s com 400',
    async (periodo) => {
      // Act
      const resposta = await http()
        .get('/loterias/megasena/estatisticas')
        .query({ periodo })
        .expect(400);

      // Assert
      expect(resposta.body.message).toContain('Período inválido');
    },
  );

  it('reaproveita o resultado enquanto o histórico em cache não for invalidado', async () => {
    // Act
    await http()
      .get('/loterias/megasena/estatisticas?periodo=ultimos:20')
      .expect(200);
    await http()
      .get('/loterias/megasena/estatisticas?periodo=ultimos:20')
      .expect(200);

    // Assert
    expect(mockado(core.calcularEstatisticas)).toHaveBeenCalledTimes(1);
  });
});
