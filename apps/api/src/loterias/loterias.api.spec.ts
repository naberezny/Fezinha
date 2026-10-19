import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConcursosRepositorio } from './concursos.repositorio';
import { LoteriasService } from './loterias.service';
import {
  type BancoTemporario,
  criarBancoTemporario,
} from '../testes/banco-temporario';
import { carregarFixtureNoBanco, criarAppDeTeste } from '../testes/app-teste';

/** API em memória sobre os 100 concursos mais recentes do fixture (2971 a 3070). */
describe('API de loterias (HTTP)', () => {
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

  describe('GET /loterias', () => {
    it('lista a Mega-Sena, a Lotomania e a Lotofácil com a definição completa', async () => {
      // Act
      const resposta = await http().get('/loterias').expect(200);

      // Assert
      expect(resposta.body.map((l: { id: string }) => l.id)).toEqual([
        'megasena',
        'lotomania',
        'lotofacil',
      ]);
      expect(resposta.body[0]).toMatchObject({
        id: 'megasena',
        nome: 'Mega-Sena',
        cor: '#209869',
        universo: 60,
        primeiraDezena: 1,
        sorteadas: 6,
        aposta: { min: 6, max: 20 },
        volante: { colunas: 10, linhas: 6 },
        diasSorteio: [2, 4, 6],
      });
      expect(resposta.body[0].faixas).toHaveLength(3);
      expect(resposta.body[1]).toMatchObject({
        id: 'lotomania',
        nome: 'Lotomania',
        cor: '#f78100',
        universo: 100,
        primeiraDezena: 0,
        sorteadas: 20,
        aposta: { min: 50, max: 50 },
        volante: { colunas: 10, linhas: 10 },
        quadrantes: 4,
        diasSorteio: [1, 3, 5],
      });
      expect(resposta.body[1].faixas).toHaveLength(7);
      expect(resposta.body[1].regrasDisponiveis).toEqual([
        'quadrantes',
        'linhas',
        'pares',
      ]);
      expect(resposta.body[2]).toMatchObject({
        id: 'lotofacil',
        nome: 'Lotofácil',
        cor: '#930089',
        universo: 25,
        primeiraDezena: 1,
        sorteadas: 15,
        aposta: { min: 15, max: 20 },
        volante: { colunas: 5, linhas: 5 },
        quadrantes: 4,
        diasSorteio: [0, 1, 2, 3, 4, 5, 6],
      });
      expect(resposta.body[2].faixas).toHaveLength(5);
      expect(resposta.body[2].regrasDisponiveis).toEqual([
        'quadrantes',
        'historico',
        'pares',
      ]);
    });
  });

  describe('GET /loterias/:id/resultados', () => {
    it('devolve 8 itens em ordem decrescente com o 3070 primeiro', async () => {
      // Act
      const resposta = await http()
        .get('/loterias/megasena/resultados?limite=8')
        .expect(200);

      // Assert
      expect(resposta.body.itens).toHaveLength(8);
      expect(
        resposta.body.itens.map((c: { numero: number }) => c.numero),
      ).toEqual([3070, 3069, 3068, 3067, 3066, 3065, 3064, 3063]);
      expect(resposta.body).toMatchObject({ total: 100, pagina: 1, limite: 8 });
    });

    it('usa limite 8 e página 1 por padrão e pagina corretamente', async () => {
      // Act
      const padrao = await http()
        .get('/loterias/megasena/resultados')
        .expect(200);
      const segunda = await http()
        .get('/loterias/megasena/resultados?limite=8&pagina=2')
        .expect(200);

      // Assert
      expect(padrao.body.itens).toHaveLength(8);
      expect(segunda.body.itens[0].numero).toBe(3062);
    });

    it.each(['limite=0', 'limite=201', 'limite=abc', 'pagina=0'])(
      'rejeita %s com 400',
      async (consulta) => {
        // Act / Assert
        await http()
          .get(`/loterias/megasena/resultados?${consulta}`)
          .expect(400);
      },
    );
  });

  describe('GET /loterias/:id/resultados/:numero', () => {
    it('devolve o concurso 3070 com valores monetários numéricos', async () => {
      // Act
      const resposta = await http()
        .get('/loterias/megasena/resultados/3070')
        .expect(200);

      // Assert
      expect(resposta.body).toMatchObject({
        numero: 3070,
        data: '2026-10-14',
        dezenas: [19, 27, 29, 43, 54, 60],
        acumulou: true,
        valorAcumuladoCentavos: 15_269_598_822,
        arrecadacaoCentavos: 12_050_230_200,
        premiacoes: [
          { faixa: 1, ganhadores: 0, rateioCentavos: 0 },
          { faixa: 2, ganhadores: 91, rateioCentavos: 5_276_796 },
          { faixa: 3, ganhadores: 7384, rateioCentavos: 107_193 },
        ],
      });
      expect(resposta.body).not.toHaveProperty('observacao');
    });

    it('devolve 404 para concurso inexistente e 400 para número inválido', async () => {
      // Act / Assert
      await http().get('/loterias/megasena/resultados/99999').expect(404);
      await http().get('/loterias/megasena/resultados/abc').expect(400);
    });
  });

  describe('loteria desconhecida', () => {
    it.each([
      '/loterias/xyz/resultados',
      '/loterias/xyz/resultados/1',
      '/loterias/xyz/estatisticas',
      '/loterias/xyz/historico',
    ])('GET %s devolve 404 com mensagem', async (rota) => {
      // Act
      const resposta = await http().get(rota).expect(404);

      // Assert
      expect(resposta.body.message).toContain("Loteria 'xyz' não encontrada");
    });
  });

  describe('GET /loterias/:id/historico', () => {
    it('devolve o histórico completo em ordem crescente com ETag "<ultimo>-<total>"', async () => {
      // Act
      const resposta = await http()
        .get('/loterias/megasena/historico')
        .expect(200);

      // Assert
      expect(resposta.headers['etag']).toBe('"3070-100"');
      expect(resposta.body.loteria.id).toBe('megasena');
      expect(resposta.body.concursos).toHaveLength(100);
      expect(resposta.body.concursos[0].numero).toBe(2971);
      expect(resposta.body.concursos[99]).toMatchObject({
        numero: 3070,
        data: '2026-10-14',
        dezenas: [19, 27, 29, 43, 54, 60],
        acumulou: true,
        valorAcumuladoCentavos: 15_269_598_822,
        estimativaProximoCentavos: 17_000_000_000,
        premiacoes: [
          { faixa: 1, ganhadores: 0, rateioCentavos: 0 },
          { faixa: 2, ganhadores: 91, rateioCentavos: 5_276_796 },
          { faixa: 3, ganhadores: 7384, rateioCentavos: 107_193 },
        ],
        locaisGanhadores: [],
      });
      // Mesmo DTO de /resultados/:numero
      const individual = await http()
        .get('/loterias/megasena/resultados/3070')
        .expect(200);
      expect(resposta.body.concursos[99]).toEqual(individual.body);
    });

    it('responde 304 sem corpo quando If-None-Match coincide', async () => {
      // Act
      const resposta = await http()
        .get('/loterias/megasena/historico')
        .set('If-None-Match', '"3070-100"')
        .expect(304);

      // Assert
      expect(resposta.text).toBeFalsy();
      expect(resposta.headers['etag']).toBe('"3070-100"');
    });

    it('responde 200 quando a ETag enviada é antiga', async () => {
      // Act
      const resposta = await http()
        .get('/loterias/megasena/historico')
        .set('If-None-Match', '"3069-99"')
        .expect(200);

      // Assert
      expect(resposta.body.concursos).toHaveLength(100);
    });
  });

  describe('GET /saude', () => {
    it('informa ok, versão e último concurso', async () => {
      // Act
      const resposta = await http().get('/saude').expect(200);

      // Assert
      expect(resposta.body.ok).toBe(true);
      expect(typeof resposta.body.versao).toBe('string');
      expect(resposta.body.ultimoConcurso).toBeGreaterThanOrEqual(3070);
    });
  });

  describe('serialização de BigInt', () => {
    it.each([
      '/loterias',
      '/loterias/megasena/resultados?limite=8',
      '/loterias/megasena/resultados/3070',
      '/loterias/megasena/historico',
      '/saude',
    ])('GET %s não devolve BigInt nem falha ao serializar', async (rota) => {
      // Act
      const resposta = await http().get(rota).expect(200);

      // Assert
      expect(resposta.text).not.toMatch(/"\d+n"/);
      expect(resposta.text).not.toContain('bigint');
      expect(resposta.text).not.toContain(
        'Do not know how to serialize a BigInt',
      );
    });

    it('valores em centavos chegam como number', async () => {
      // Act
      const { body } = await http()
        .get('/loterias/megasena/resultados?limite=8')
        .expect(200);

      // Assert
      for (const item of body.itens) {
        expect(typeof item.valorAcumuladoCentavos).toBe('number');
        expect(typeof item.estimativaProximoCentavos).toBe('number');
        for (const premiacao of item.premiacoes)
          expect(typeof premiacao.rateioCentavos).toBe('number');
      }
    });
  });

  describe('Swagger', () => {
    it('publica a documentação em /docs e o JSON com as rotas', async () => {
      // Act
      await http().get('/docs').expect(200);
      const { body } = await http().get('/docs-json').expect(200);

      // Assert
      expect(Object.keys(body.paths)).toEqual(
        expect.arrayContaining([
          '/loterias',
          '/loterias/{id}/resultados',
          '/loterias/{id}/historico',
          '/saude',
        ]),
      );
      expect(Object.keys(body.components.schemas)).toEqual(
        expect.arrayContaining([
          'ResultadoDto',
          'EstatisticasDto',
          'HistoricoDto',
          'SincronizacaoDto',
          'ResultadoSincronizacaoDto',
        ]),
      );
    });
  });

  // Por último: grava o concurso 3071 e muda o estado compartilhado do banco.
  describe('cache do histórico', () => {
    it('invalidar() descarta o cache: concurso novo aparece no histórico e muda a ETag', async () => {
      // Arrange
      const servico = app.get(LoteriasService);
      const repositorio = app.get(ConcursosRepositorio);
      await http().get('/loterias/megasena/historico').expect(200); // aquece o cache
      const concursoNovo = {
        ...(await repositorio.obter('megasena', 3070))!,
        numero: 3071,
      };

      // Act
      await repositorio.upsertConcurso('megasena', concursoNovo, 'manual');
      servico.invalidar('megasena');
      const resposta = await http()
        .get('/loterias/megasena/historico')
        .expect(200);

      // Assert
      expect(resposta.headers['etag']).toBe('"3071-101"');
      expect(resposta.body.concursos.at(-1).numero).toBe(3071);
    });
  });
});
