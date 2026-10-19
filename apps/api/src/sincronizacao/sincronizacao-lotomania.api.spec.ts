import { INestApplication } from '@nestjs/common';
import type { Concurso } from '@sorteios/core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { ConcursosRepositorio } from '../loterias/concursos.repositorio';
import { criarAppDeTeste } from '../testes/app-teste';
import {
  type BancoTemporario,
  criarBancoTemporario,
} from '../testes/banco-temporario';
import {
  encerrarCaixaSimulada,
  iniciarCaixaSimulada,
  limparCaixaSimulada,
  simularCaixa,
  urlCaixaSimulada,
} from '../testes/caixa-simulada';
import {
  CONFIG_SINCRONIZACAO,
  CONFIG_SINCRONIZACAO_PADRAO,
} from './configuracao';

/**
 * O mapeador real da Lotomania mora em `libs/loterias/lotomania` (outra frente). Aqui ele é trocado por um
 * mapeador mínimo, só o bastante para o fixture da Caixa, para testar a fiação da API (registro, rota,
 * gravação da dezena 00) sem depender dele.
 */
jest.mock('@sorteios/loterias/lotomania', () => ({
  mapearRespostaCaixaLotomania: (json: Record<string, unknown>): Concurso => {
    const paraIso = (br: string) => br.split('/').reverse().join('-');
    const faixas = json['listaRateioPremio'] as {
      faixa: number;
      numeroDeGanhadores: number;
      valorPremio: number;
    }[];
    return {
      numero: json['numero'] as number,
      data: paraIso(json['dataApuracao'] as string),
      dezenas: (json['listaDezenas'] as string[])
        .map(Number)
        .sort((a, b) => a - b),
      acumulou: json['acumulado'] as boolean,
      premiacoes: faixas.map((f) => ({
        faixa: f.faixa,
        ganhadores: f.numeroDeGanhadores,
        rateioCentavos: BigInt(Math.round(f.valorPremio * 100)),
      })),
      valorAcumuladoCentavos: 0n,
      estimativaProximoCentavos: 0n,
      arrecadacaoCentavos: 0n,
      acumuladoEspecialCentavos: 0n,
      dataProximoSorteio: paraIso(json['dataProximoConcurso'] as string),
      locaisGanhadores: [],
    };
  },
}));

jest.setTimeout(60_000);

const CHAVE = 'chave-de-teste';

const respostaBase = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'libs',
      'loterias',
      'lotomania',
      'src',
      'lib',
      'fixtures',
      'caixa-lotomania-2987.json',
    ),
    'utf-8',
  ),
) as Record<string, unknown>;

/** Resposta real da Caixa (concurso 2987) com o número trocado; a 1ª dezena do 2988 em diante é "00". */
const corpoLotomania = (numero: number) => ({
  ...respostaBase,
  numero,
  dataProximoConcurso: '19/10/2026',
  listaDezenas:
    numero > 2987
      ? ['00', ...(respostaBase['listaDezenas'] as string[]).slice(1)]
      : respostaBase['listaDezenas'],
});

describe('Sincronização da Lotomania com a Caixa', () => {
  let banco: BancoTemporario;
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const repositorio = () => app.get(ConcursosRepositorio);

  beforeAll(() => iniciarCaixaSimulada());
  afterAll(() => encerrarCaixaSimulada());

  beforeEach(async () => {
    process.env['CAIXA_API_URL'] = urlCaixaSimulada();
    process.env['CHAVE_ADMIN'] = CHAVE;
    banco = await criarBancoTemporario();
    app = await criarAppDeTeste(banco.url, {
      marcarSincronizada: false,
      substituir: [
        {
          provide: CONFIG_SINCRONIZACAO,
          useValue: {
            ...CONFIG_SINCRONIZACAO_PADRAO,
            pausaTentativasMs: 0,
            pausaEntreConcursosMs: 0,
            esperaAposErroMs: 0,
          },
        },
      ],
    });
  });

  afterEach(async () => {
    limparCaixaSimulada();
    delete process.env['CAIXA_API_URL'];
    delete process.env['CHAVE_ADMIN'];
    await app?.close();
    await banco?.remover();
  });

  it('POST /sincronizar com o banco vazio grava só o último concurso e a dezena 00 volta do banco', async () => {
    // Arrange
    const chamadas = simularCaixa({
      loteria: 'lotomania',
      ultimo: 2988,
      corpoDe: corpoLotomania,
    });

    // Act
    const resposta = await http()
      .post('/loterias/lotomania/sincronizar')
      .set('X-Chave-Admin', CHAVE)
      .expect(201);

    // Assert
    expect(resposta.body).toEqual({
      novos: 1,
      atualizados: 0,
      inalterados: 0,
      ultimoConcurso: 2988,
    });
    expect(chamadas).toEqual(['/lotomania/', '/lotomania/2988']);
    const gravado = await repositorio().obter('lotomania', 2988);
    expect(gravado?.dezenas).toHaveLength(20);
    expect(gravado?.dezenas[0]).toBe(0);
    expect(gravado?.premiacoes).toHaveLength(7);
    const estado = await http().get('/loterias/lotomania/sincronizacao').expect(200);
    expect(estado.body).toMatchObject({
      loteriaId: 'lotomania',
      ultimoConcurso: 2988,
      proximoSorteioEm: '2026-10-19T23:00:00Z',
      ultimoErro: null,
    });
  });

  it('com o 2987 já gravado e a Caixa no 2987: 0 novos, último 2987', async () => {
    // Arrange
    simularCaixa({ loteria: 'lotomania', ultimo: 2987, corpoDe: corpoLotomania });
    await http()
      .post('/loterias/lotomania/sincronizar?de=2987&ate=2987')
      .set('X-Chave-Admin', CHAVE)
      .expect(201);
    const chamadas = simularCaixa({
      loteria: 'lotomania',
      ultimo: 2987,
      corpoDe: corpoLotomania,
    });

    // Act
    const resposta = await http()
      .post('/loterias/lotomania/sincronizar')
      .set('X-Chave-Admin', CHAVE)
      .expect(201);

    // Assert
    expect(resposta.body).toEqual({
      novos: 0,
      atualizados: 0,
      inalterados: 0,
      ultimoConcurso: 2987,
    });
    expect(chamadas).toEqual(['/lotomania/']);
  });

  it('a sincronização da Lotomania não toca a Mega-Sena', async () => {
    // Arrange
    simularCaixa({ loteria: 'lotomania', ultimo: 2988, corpoDe: corpoLotomania });

    // Act
    await http()
      .post('/loterias/lotomania/sincronizar')
      .set('X-Chave-Admin', CHAVE)
      .expect(201);

    // Assert
    expect(await repositorio().total('megasena')).toBe(0);
    expect(await repositorio().total('lotomania')).toBe(1);
  });
});
