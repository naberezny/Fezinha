import { INestApplication } from '@nestjs/common';
import { calcularEstatisticas, distribuicaoPares } from '@sorteios/core';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena';
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

/**
 * Carga completa dos 3.070 concursos do fixture (a mesma que `pnpm carga:megasena`) e verificações
 * de paridade com o legado. Lenta por natureza: uma carga e uma repetição, no mesmo banco temporário.
 */
describe('carga histórica da Mega-Sena (3.070 concursos)', () => {
  jest.setTimeout(300_000);

  let banco: BancoTemporario;
  let app: INestApplication;
  let prisma: PrismaService;
  let primeiraCarga: Awaited<ReturnType<typeof carregarFixtureNoBanco>>;

  beforeAll(async () => {
    banco = criarBancoTemporario();
    app = await criarAppDeTeste(banco.url);
    prisma = app.get(PrismaService);
    primeiraCarga = await carregarFixtureNoBanco(app);
  });

  afterAll(async () => {
    await app.close();
    banco.remover();
  });

  it('grava 3070 concursos novos, 18.420 dezenas e 903 locais', async () => {
    // Assert
    expect(primeiraCarga).toEqual({
      novos: 3070,
      atualizados: 0,
      inalterados: 0,
      ultimoConcurso: 3070,
    });
    expect(await app.get(ConcursosRepositorio).ultimoNumero('megasena')).toBe(
      3070,
    );
    expect(await prisma.dezena.count()).toBe(18_420);
    expect(await prisma.localGanhador.count()).toBe(903);
    expect(await prisma.premiacao.count()).toBe(3070 * 3);
  });

  it('é idempotente: repetir a carga devolve 3070 inalterados e não altera as contagens', async () => {
    // Act
    const segunda = await carregarConcursos(
      app.get(ConcursosRepositorio),
      MEGA_SENA,
      concursosDoFixture(),
      'planilha',
    );

    // Assert
    expect(segunda).toEqual({
      novos: 0,
      atualizados: 0,
      inalterados: 3070,
      ultimoConcurso: 3070,
    });
    expect(await prisma.concurso.count()).toBe(3070);
    expect(await prisma.dezena.count()).toBe(18_420);
    expect(await prisma.localGanhador.count()).toBe(903);
  });

  it('o histórico lido do banco reproduz exatamente o fixture', async () => {
    // Act
    const doBanco = await app.get(ConcursosRepositorio).historico('megasena');

    // Assert
    expect(doBanco).toEqual(concursosDoFixture());
  });

  describe('HTTP sobre a base completa', () => {
    it('GET /resultados?limite=8 devolve o 3070 primeiro entre 3070 concursos', async () => {
      // Act
      const { body } = await request(app.getHttpServer())
        .get('/loterias/megasena/resultados?limite=8')
        .expect(200);

      // Assert
      expect(body.total).toBe(3070);
      expect(body.itens[0].numero).toBe(3070);
      expect(body.itens).toHaveLength(8);
    });

    it('GET /historico tem 3070 concursos e ETag "3070-3070"', async () => {
      // Act
      const resposta = await request(app.getHttpServer())
        .get('/loterias/megasena/historico')
        .expect(200);

      // Assert
      expect(resposta.headers['etag']).toBe('"3070-3070"');
      expect(resposta.body.concursos).toHaveLength(3070);
    });

    it('GET /estatisticas?periodo=tudo bate com o legado (frequências, atrasos e pares)', async () => {
      // Act
      const { body } = await request(app.getHttpServer())
        .get('/loterias/megasena/estatisticas?periodo=tudo')
        .expect(200);

      // Assert
      const dezena = (n: number) =>
        body.dezenas.find((d: { dezena: number }) => d.dezena === n);
      expect(body.concursosNoPeriodo).toBe(3070);
      expect(dezena(10).frequencia).toBe(359);
      expect(dezena(26).frequencia).toBe(250);
      expect(dezena(34).atraso).toBe(43);
      expect(dezena(45).atraso).toBe(40);
      expect(dezena(32).atraso).toBe(39);
      expect(body.pares).toEqual(
        expect.arrayContaining([
          { pares: 0, total: 40 },
          { pares: 1, total: 271 },
          { pares: 2, total: 738 },
          { pares: 3, total: 944 },
          { pares: 4, total: 747 },
          { pares: 5, total: 292 },
          { pares: 6, total: 38 },
        ]),
      );
    });

    it('GET /estatisticas?periodo=ultimos:50 coincide com o core calculado direto sobre o fixture', async () => {
      // Arrange
      const historico = { loteria: MEGA_SENA, concursos: concursosDoFixture() };
      const periodo = { tipo: 'ultimos', quantidade: 50 } as const;

      // Act
      const { body } = await request(app.getHttpServer())
        .get('/loterias/megasena/estatisticas?periodo=ultimos:50')
        .expect(200);

      // Assert
      expect(body.concursosNoPeriodo).toBe(50);
      expect(
        body.dezenas.map(
          (d: { dezena: number; frequencia: number; atraso: number }) => [
            d.dezena,
            d.frequencia,
            d.atraso,
          ],
        ),
      ).toEqual(
        calcularEstatisticas(historico, periodo).map((d) => [
          d.dezena,
          d.frequencia,
          d.atraso,
        ]),
      );
      const paresDe50 = distribuicaoPares({
        loteria: MEGA_SENA,
        concursos: historico.concursos.slice(-50),
      });
      expect(body.pares).toEqual(
        paresDe50.map((p) => ({ pares: p.pares, total: p.total })),
      );
    });
  });
});
