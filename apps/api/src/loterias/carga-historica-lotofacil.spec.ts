import { INestApplication } from '@nestjs/common';
import { LOTOFACIL } from '@sorteios/loterias/lotofacil/definicao';
import request from 'supertest';
import { carregarConcursos } from '../carga/carga';
import { ConcursosRepositorio } from './concursos.repositorio';
import { PrismaService } from '../prisma/prisma.service';
import {
  carregarFixtureNoBanco,
  concursosDoFixture,
  criarAppDeTeste,
} from '../testes/app-teste';
import {
  type BancoTemporario,
  criarBancoTemporario,
} from '../testes/banco-temporario';

const todosOsConcursos = () => concursosDoFixture(undefined, LOTOFACIL);

/**
 * Carga completa dos 3.807 concursos do fixture da Lotofácil (a mesma que `pnpm carga:lotofacil`)
 * e as rotas HTTP sobre a base completa. Lenta por natureza: uma carga e uma repetição, no mesmo banco temporário.
 */
describe('carga histórica da Lotofácil (3.807 concursos)', () => {
  jest.setTimeout(600_000);

  let banco: BancoTemporario;
  let app: INestApplication;
  let prisma: PrismaService;
  let primeiraCarga: Awaited<ReturnType<typeof carregarFixtureNoBanco>>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    banco = await criarBancoTemporario();
    app = await criarAppDeTeste(banco.url);
    prisma = app.get(PrismaService);
    primeiraCarga = await carregarFixtureNoBanco(app, undefined, LOTOFACIL);
  });

  afterAll(async () => {
    await app.close();
    await banco.remover();
  });

  it('grava 3807 concursos novos, 57.105 dezenas e 5 premiações por concurso', async () => {
    // Assert
    expect(primeiraCarga).toEqual({
      novos: 3807,
      atualizados: 0,
      inalterados: 0,
      ultimoConcurso: 3807,
    });
    const where = { concurso: { loteriaId: 'lotofacil' } };
    expect(
      await prisma.concurso.count({ where: { loteriaId: 'lotofacil' } }),
    ).toBe(3807);
    expect(await prisma.dezena.count({ where })).toBe(57_105);
    expect(await prisma.premiacao.count({ where })).toBe(3807 * 5);
    expect(await prisma.localGanhador.count({ where })).toBe(10_585);
  });

  it('é idempotente: repetir a carga devolve 3807 inalterados e não altera as contagens', async () => {
    // Act
    const segunda = await carregarConcursos(
      app.get(ConcursosRepositorio),
      LOTOFACIL,
      todosOsConcursos(),
      'planilha',
    );

    // Assert
    expect(segunda).toEqual({
      novos: 0,
      atualizados: 0,
      inalterados: 3807,
      ultimoConcurso: 3807,
    });
    expect(
      await prisma.dezena.count({
        where: { concurso: { loteriaId: 'lotofacil' } },
      }),
    ).toBe(57_105);
  });

  it('o histórico lido do banco reproduz exatamente o fixture', async () => {
    // Act
    const doBanco = await app.get(ConcursosRepositorio).historico('lotofacil');

    // Assert
    expect(doBanco).toEqual(todosOsConcursos());
  });

  describe('HTTP sobre a base completa', () => {
    it('GET /resultados/3807 devolve 15 dezenas, 5 faixas, acumulado da Independência e os locais dos ganhadores', async () => {
      // Act
      const { body } = await http()
        .get('/loterias/lotofacil/resultados/3807')
        .expect(200);

      // Assert
      expect(body.dezenas).toEqual([
        1, 3, 4, 7, 10, 11, 13, 16, 17, 19, 20, 22, 23, 24, 25,
      ]);
      expect(body.premiacoes[0]).toEqual({
        faixa: 1,
        ganhadores: 3,
        rateioCentavos: 44_538_624,
      });
      expect(body.premiacoes).toHaveLength(5);
      expect(body.acumuladoEspecialCentavos).toBe(1_232_460_561);
      expect(body.locaisGanhadores).toEqual([
        {
          cidade: 'CANAL ELETRONICO',
          descricao: 'CANAL ELETRONICO',
          quantidade: 1,
        },
        {
          cidade: 'PORECATU',
          uf: 'PR',
          descricao: 'PORECATU/PR',
          quantidade: 1,
        },
        {
          cidade: 'MIRANTE DO PARANAPANEMA',
          uf: 'SP',
          descricao: 'MIRANTE DO PARANAPANEMA/SP',
          quantidade: 1,
        },
      ]);
    });

    it('GET /historico tem 3807 concursos e ETag "3807-3807"', async () => {
      // Act
      const resposta = await http()
        .get('/loterias/lotofacil/historico')
        .expect(200);

      // Assert
      expect(resposta.headers['etag']).toBe('"3807-3807"');
      expect(resposta.body.loteria).toMatchObject({
        id: 'lotofacil',
        universo: 25,
      });
      expect(resposta.body.concursos).toHaveLength(3807);
    });

    it('GET /estatisticas?periodo=tudo tem as 25 dezenas e frequências somando 15 × concursos', async () => {
      // Act
      const { body } = await http()
        .get('/loterias/lotofacil/estatisticas?periodo=tudo')
        .expect(200);

      // Assert
      const dezenas = body.dezenas.map((d: { dezena: number }) => d.dezena);
      expect(body.concursosNoPeriodo).toBe(3807);
      expect(dezenas).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
      const soma = body.dezenas.reduce(
        (total: number, d: { frequencia: number }) => total + d.frequencia,
        0,
      );
      expect(soma).toBe(3807 * 15);
    });

    it('as outras loterias seguem vazias: a carga da Lotofácil não as toca', async () => {
      // Act
      const repositorio = app.get(ConcursosRepositorio);

      // Assert
      expect(await repositorio.total('megasena')).toBe(0);
      expect(await repositorio.total('lotomania')).toBe(0);
    });
  });
});
