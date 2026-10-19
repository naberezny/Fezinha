import { INestApplication } from '@nestjs/common';
import { LOTOMANIA } from '@sorteios/loterias/lotomania/definicao';
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

const todosOsConcursos = () => concursosDoFixture(undefined, LOTOMANIA);

/**
 * Carga completa dos 2.987 concursos do fixture da Lotomania (a mesma que `pnpm carga:lotomania`),
 * com a dezena 00 indo e voltando do SQLite, e as rotas HTTP sobre a base completa.
 * Lenta por natureza: uma carga e uma repetição, no mesmo banco temporário.
 */
describe('carga histórica da Lotomania (2.987 concursos)', () => {
  jest.setTimeout(600_000);

  let banco: BancoTemporario;
  let app: INestApplication;
  let prisma: PrismaService;
  let primeiraCarga: Awaited<ReturnType<typeof carregarFixtureNoBanco>>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    banco = criarBancoTemporario();
    app = await criarAppDeTeste(banco.url);
    prisma = app.get(PrismaService);
    primeiraCarga = await carregarFixtureNoBanco(app, undefined, LOTOMANIA);
  });

  afterAll(async () => {
    await app.close();
    banco.remover();
  });

  it('grava 2987 concursos novos, 59.740 dezenas e 7 premiações por concurso', async () => {
    // Assert
    expect(primeiraCarga).toEqual({
      novos: 2987,
      atualizados: 0,
      inalterados: 0,
      ultimoConcurso: 2987,
    });
    const where = { concurso: { loteriaId: 'lotomania' } };
    expect(await app.get(ConcursosRepositorio).ultimoNumero('lotomania')).toBe(
      2987,
    );
    expect(await prisma.concurso.count({ where: { loteriaId: 'lotomania' } })).toBe(
      2987,
    );
    expect(await prisma.dezena.count({ where })).toBe(2987 * 20);
    expect(await prisma.dezena.count({ where })).toBe(59_740);
    expect(await prisma.premiacao.count({ where })).toBe(2987 * 7);
  });

  it('a dezena 0 vai e volta do SQLite (existe no banco e no histórico lido)', async () => {
    // Act
    const noBanco = await prisma.dezena.count({
      where: { dezena: 0, concurso: { loteriaId: 'lotomania' } },
    });
    const doBanco = await app.get(ConcursosRepositorio).obter('lotomania', 1);

    // Assert
    expect(noBanco).toBe(
      todosOsConcursos().filter((c) => c.dezenas.includes(0)).length,
    );
    expect(noBanco).toBeGreaterThan(0);
    expect(doBanco?.dezenas).toEqual([
      0, 6, 11, 14, 16, 21, 22, 25, 32, 33, 34, 46, 61, 70, 73, 78, 88, 89, 90,
      95,
    ]);
  });

  it('é idempotente: repetir a carga devolve 2987 inalterados e não altera as contagens', async () => {
    // Act
    const segunda = await carregarConcursos(
      app.get(ConcursosRepositorio),
      LOTOMANIA,
      todosOsConcursos(),
      'planilha',
    );

    // Assert
    expect(segunda).toEqual({
      novos: 0,
      atualizados: 0,
      inalterados: 2987,
      ultimoConcurso: 2987,
    });
    const where = { concurso: { loteriaId: 'lotomania' } };
    expect(await prisma.concurso.count({ where: { loteriaId: 'lotomania' } })).toBe(
      2987,
    );
    expect(await prisma.dezena.count({ where })).toBe(59_740);
  });

  it('o histórico lido do banco reproduz exatamente o fixture', async () => {
    // Act
    const doBanco = await app.get(ConcursosRepositorio).historico('lotomania');

    // Assert
    expect(doBanco).toEqual(todosOsConcursos());
  });

  describe('HTTP sobre a base completa', () => {
    it('GET /loterias lista as duas loterias com primeiraDezena', async () => {
      // Act
      const { body } = await http().get('/loterias').expect(200);

      // Assert
      expect(
        body.map((l: { id: string; primeiraDezena: number }) => [
          l.id,
          l.primeiraDezena,
        ]),
      ).toEqual([
        ['megasena', 1],
        ['lotomania', 0],
      ]);
    });

    it('GET /resultados?limite=2 devolve o 2987 primeiro, 2 itens com 20 dezenas e total 2987', async () => {
      // Act
      const { body } = await http()
        .get('/loterias/lotomania/resultados?limite=2')
        .expect(200);

      // Assert
      expect(body.total).toBe(2987);
      expect(body.itens.map((i: { numero: number }) => i.numero)).toEqual([
        2987, 2986,
      ]);
      for (const item of body.itens) expect(item.dezenas).toHaveLength(20);
      expect(body.itens[0].dezenas).toEqual([
        7, 12, 20, 29, 31, 32, 39, 43, 44, 48, 50, 52, 60, 61, 69, 84, 85, 90,
        91, 99,
      ]);
      expect(body.itens[0].premiacoes).toHaveLength(7);
    });

    it('GET /resultados/1 devolve a dezena 0 e as premiações com "-" lido como 0', async () => {
      // Act
      const { body } = await http()
        .get('/loterias/lotomania/resultados/1')
        .expect(200);

      // Assert
      expect(body.dezenas[0]).toBe(0);
      expect(body.premiacoes[5]).toEqual({
        faixa: 6,
        ganhadores: 0,
        rateioCentavos: 0,
      });
      expect(body.premiacoes[1]).toEqual({
        faixa: 2,
        ganhadores: 1,
        rateioCentavos: 11_874_687,
      });
    });

    it('GET /historico tem 2987 concursos, loteria com primeiraDezena 0 e ETag "2987-2987"', async () => {
      // Act
      const resposta = await http()
        .get('/loterias/lotomania/historico')
        .expect(200);

      // Assert
      expect(resposta.headers['etag']).toBe('"2987-2987"');
      expect(resposta.body.loteria).toMatchObject({
        id: 'lotomania',
        primeiraDezena: 0,
      });
      expect(resposta.body.concursos).toHaveLength(2987);
    });

    it('GET /estatisticas?periodo=tudo tem 100 dezenas (0..99), com a dezena 0 presente', async () => {
      // Act
      const { body } = await http()
        .get('/loterias/lotomania/estatisticas?periodo=tudo')
        .expect(200);

      // Assert
      const dezenas = body.dezenas.map((d: { dezena: number }) => d.dezena);
      expect(body.concursosNoPeriodo).toBe(2987);
      expect(dezenas).toHaveLength(100);
      expect(dezenas[0]).toBe(0);
      expect(dezenas[99]).toBe(99);
      const zero = body.dezenas.find((d: { dezena: number }) => d.dezena === 0);
      const esperado = todosOsConcursos().filter((c) =>
        c.dezenas.includes(0),
      ).length;
      expect(zero.frequencia).toBe(esperado);
      expect(zero.frequencia).toBeGreaterThan(0);
      // A soma das frequências é sorteadas × concursos.
      const soma = body.dezenas.reduce(
        (total: number, d: { frequencia: number }) => total + d.frequencia,
        0,
      );
      expect(soma).toBe(2987 * 20);
    });

    it('a Mega-Sena segue vazia e isolada: nenhum concurso dela foi criado pela carga da Lotomania', async () => {
      // Act
      const { body } = await http()
        .get('/loterias/megasena/resultados?limite=1')
        .expect(200);

      // Assert
      expect(body.total).toBe(0);
    });
  });
});
