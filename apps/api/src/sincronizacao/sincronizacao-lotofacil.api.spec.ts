import { INestApplication } from '@nestjs/common';
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
      'lotofacil',
      'src',
      'lib',
      'fixtures',
      'caixa-lotofacil-3807.json',
    ),
    'utf-8',
  ),
) as Record<string, unknown>;

/** Resposta real da Caixa (concurso 3807) com o número trocado. Usa o mapeador real da Lotofácil. */
const corpoLotofacil = (numero: number) => ({
  ...respostaBase,
  numero,
  numeroConcursoProximo: numero + 1,
});

describe('Sincronização da Lotofácil com a Caixa', () => {
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

  it('POST /sincronizar com o banco vazio grava só o último concurso, com locais de ganhadores', async () => {
    // Arrange
    const chamadas = simularCaixa({
      loteria: 'lotofacil',
      ultimo: 3807,
      corpoDe: corpoLotofacil,
    });

    // Act
    const resposta = await http()
      .post('/loterias/lotofacil/sincronizar')
      .set('X-Chave-Admin', CHAVE)
      .expect(201);

    // Assert
    expect(resposta.body).toEqual({
      novos: 1,
      atualizados: 0,
      inalterados: 0,
      ultimoConcurso: 3807,
    });
    expect(chamadas).toEqual(['/lotofacil/', '/lotofacil/3807']);
    const gravado = await repositorio().obter('lotofacil', 3807);
    expect(gravado?.dezenas).toHaveLength(15);
    expect(gravado?.premiacoes).toHaveLength(5);
    expect(gravado?.locaisGanhadores.map((l) => l.descricao)).toEqual([
      'CANAL ELETRONICO',
      'PORECATU/PR',
      'MIRANTE DO PARANAPANEMA/SP',
    ]);
    const estado = await http()
      .get('/loterias/lotofacil/sincronizacao')
      .expect(200);
    expect(estado.body).toMatchObject({
      loteriaId: 'lotofacil',
      ultimoConcurso: 3807,
      proximoSorteioEm: '2026-10-19T23:00:00Z',
      ultimoErro: null,
    });
  });

  it('POST /sincronizar?de=3805&ate=3807 reimporta o intervalo e não toca as outras loterias', async () => {
    // Arrange
    const chamadas = simularCaixa({
      loteria: 'lotofacil',
      ultimo: 3807,
      corpoDe: corpoLotofacil,
    });

    // Act
    const resposta = await http()
      .post('/loterias/lotofacil/sincronizar?de=3805&ate=3807')
      .set('X-Chave-Admin', CHAVE)
      .expect(201);

    // Assert
    expect(resposta.body).toMatchObject({ novos: 3, ultimoConcurso: 3807 });
    expect(chamadas).toEqual([
      '/lotofacil/3805',
      '/lotofacil/3806',
      '/lotofacil/3807',
    ]);
    expect(await repositorio().total('lotofacil')).toBe(3);
    expect(await repositorio().total('megasena')).toBe(0);
    expect(await repositorio().total('lotomania')).toBe(0);
  });
});
