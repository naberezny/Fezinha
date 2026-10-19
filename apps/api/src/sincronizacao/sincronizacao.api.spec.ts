import { INestApplication } from '@nestjs/common';
import { mapearRespostaCaixa } from '@sorteios/loterias/mega-sena';
import request from 'supertest';
import { ConcursosRepositorio } from '../loterias/concursos.repositorio';
import { LoteriasService } from '../loterias/loterias.service';
import { PrismaService } from '../prisma/prisma.service';
import { criarAppDeTeste } from '../testes/app-teste';
import {
  type BancoTemporario,
  criarBancoTemporario,
} from '../testes/banco-temporario';
import {
  corpoCaixa,
  encerrarCaixaSimulada,
  iniciarCaixaSimulada,
  limparCaixaSimulada,
  simularCaixa,
  urlCaixaSimulada,
} from '../testes/caixa-simulada';
import {
  CONFIG_SINCRONIZACAO,
  CONFIG_SINCRONIZACAO_PADRAO,
  type ConfiguracaoSincronizacao,
} from './configuracao';
import { SincronizacaoService } from './sincronizacao.service';

/** Cada teste sobe a aplicação com um banco novo (migrations incluídas): em máquina lenta passa de 5 s. */
jest.setTimeout(60_000);

const CHAVE = 'chave-de-teste';

/** Tempos zerados: os testes não dormem entre tentativas nem entre concursos. */
const AJUSTES_RAPIDOS: ConfiguracaoSincronizacao = {
  ...CONFIG_SINCRONIZACAO_PADRAO,
  pausaTentativasMs: 0,
  pausaEntreConcursosMs: 0,
  esperaAposErroMs: 0,
};

const minutosAtras = (minutos: number) =>
  new Date(Date.now() - minutos * 60_000).toISOString();

describe('Sincronização com a Caixa', () => {
  let banco: BancoTemporario;
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const servico = () => app.get(SincronizacaoService);
  const repositorio = () => app.get(ConcursosRepositorio);
  const prisma = () => app.get(PrismaService);

  /** Sobe a app com o banco novo; `ajustes` sobrescreve os tempos padrão do teste. */
  async function subirApp(
    opcoes: {
      ajustes?: Partial<ConfiguracaoSincronizacao>;
      marcarSincronizada?: boolean;
    } = {},
  ) {
    banco = criarBancoTemporario();
    app = await criarAppDeTeste(banco.url, {
      marcarSincronizada: opcoes.marcarSincronizada ?? false,
      substituir: [
        {
          provide: CONFIG_SINCRONIZACAO,
          useValue: { ...AJUSTES_RAPIDOS, ...opcoes.ajustes },
        },
      ],
    });
  }

  /** Grava concursos já existentes no banco, mapeados pelo mesmo caminho da Caixa. */
  async function gravarConcursos(...numeros: number[]) {
    for (const numero of numeros) {
      await repositorio().upsertConcurso(
        'megasena',
        mapearRespostaCaixa(corpoCaixa(numero)),
        'planilha',
      );
    }
  }

  beforeAll(() => iniciarCaixaSimulada());
  afterAll(() => encerrarCaixaSimulada());

  beforeEach(() => {
    process.env['CAIXA_API_URL'] = urlCaixaSimulada();
    process.env['CHAVE_ADMIN'] = CHAVE;
  });

  afterEach(async () => {
    limparCaixaSimulada();
    delete process.env['CAIXA_API_URL'];
    delete process.env['CHAVE_ADMIN'];
    await app?.close();
    banco?.remover();
  });

  describe('regra de "vencida" (seção 5.3, passos 1 e 2)', () => {
    it('não vencida: a leitura não chama a Caixa', async () => {
      // Arrange
      await subirApp({ marcarSincronizada: true });
      await gravarConcursos(3070);
      const chamadas = simularCaixa({ ultimo: 3073 });

      // Act
      const resposta = await http()
        .get('/loterias/megasena/resultados?limite=3')
        .expect(200);

      // Assert
      expect(chamadas).toHaveLength(0);
      expect(resposta.body.total).toBe(1);
    });

    it('vencida sem concurso novo: 1 chamada e só as marcas mudam', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      const chamadas = simularCaixa({ ultimo: 3070 });

      // Act
      await http().get('/loterias/megasena/resultados').expect(200);
      const estado = await http()
        .get('/loterias/megasena/sincronizacao')
        .expect(200);

      // Assert
      expect(chamadas).toEqual(['/megasena/']);
      expect(await repositorio().total('megasena')).toBe(1);
      expect(await repositorio().obter('megasena', 3070)).toBeTruthy();
      expect(estado.body).toMatchObject({
        loteriaId: 'megasena',
        ultimoConcurso: 3070,
        proximoSorteioEm: '2026-10-18T23:00:00Z',
        ultimoErro: null,
        emAndamento: false,
      });
      expect(estado.body.ultimaEm).toEqual(expect.any(String));
    });

    it('vencida com 3 concursos faltando: 4 chamadas, 3 novos e ultimoConcurso = 3073', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      const chamadas = simularCaixa({ ultimo: 3073 });
      await app.get(LoteriasService).historicoCompleto('megasena'); // aquece o cache

      // Act
      const resposta = await http()
        .get('/loterias/megasena/resultados?limite=10')
        .expect(200);
      const estado = await http()
        .get('/loterias/megasena/sincronizacao')
        .expect(200);

      // Assert
      expect(chamadas).toEqual([
        '/megasena/',
        '/megasena/3071',
        '/megasena/3072',
        '/megasena/3073',
      ]);
      expect(resposta.body.total).toBe(4);
      expect(resposta.body.itens[0].numero).toBe(3073);
      expect(estado.body.ultimoConcurso).toBe(3073);
      const historico = await app
        .get(LoteriasService)
        .historicoCompleto('megasena');
      expect(historico.concursos.map((c) => c.numero)).toEqual([
        3070, 3071, 3072, 3073,
      ]);
    });

    it('banco vazio: grava só o último concurso (o histórico vem da carga histórica)', async () => {
      // Arrange
      await subirApp();
      const chamadas = simularCaixa({ ultimo: 3070 });

      // Act
      await http().get('/loterias/megasena/resultados').expect(200);

      // Assert
      expect(chamadas).toEqual(['/megasena/', '/megasena/3070']);
      expect(await repositorio().total('megasena')).toBe(1);
    });

    it('proximoSorteioEm no passado força nova consulta mesmo com ultimaEm recente', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      await prisma().sincronizacao.create({
        data: {
          loteriaId: 'megasena',
          ultimaEm: minutosAtras(60),
          ultimoConcurso: 3070,
          proximoSorteioEm: minutosAtras(30),
        },
      });
      const chamadas = simularCaixa({ ultimo: 3070 });

      // Act
      await http().get('/loterias/megasena/resultados').expect(200);

      // Assert
      expect(chamadas).toEqual(['/megasena/']);
    });

    it('proximoSorteioEm no futuro e ultimaEm recente: nenhuma chamada', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      await prisma().sincronizacao.create({
        data: {
          loteriaId: 'megasena',
          ultimaEm: minutosAtras(60),
          ultimoConcurso: 3070,
          proximoSorteioEm: new Date(Date.now() + 3_600_000).toISOString(),
        },
      });
      const chamadas = simularCaixa({ ultimo: 3073 });

      // Act
      await http().get('/loterias/megasena/resultados').expect(200);

      // Assert
      expect(chamadas).toHaveLength(0);
    });

    it('ultimaEm com mais de 24 h força nova consulta', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      await prisma().sincronizacao.create({
        data: { loteriaId: 'megasena', ultimaEm: minutosAtras(25 * 60) },
      });
      const chamadas = simularCaixa({ ultimo: 3070 });

      // Act
      await http().get('/loterias/megasena/estatisticas').expect(200);

      // Assert
      expect(chamadas).toEqual(['/megasena/']);
    });

    it.each([
      '/loterias/megasena/resultados',
      '/loterias/megasena/resultados/3070',
      '/loterias/megasena/estatisticas',
      '/loterias/megasena/historico',
    ])('a rota de leitura %s dispara a sincronização', async (rota) => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      const chamadas = simularCaixa({ ultimo: 3070 });

      // Act
      await http().get(rota).expect(200);

      // Assert
      expect(chamadas).toEqual(['/megasena/']);
    });

    it('GET /sincronizacao não dispara sincronização', async () => {
      // Arrange
      await subirApp();
      const chamadas = simularCaixa({ ultimo: 3070 });

      // Act
      await http().get('/loterias/megasena/sincronizacao').expect(200);

      // Assert
      expect(chamadas).toHaveLength(0);
    });
  });

  describe('lock por loteria (passo 3)', () => {
    it('20 chamadas concorrentes de garantirAtualizado fazem 1 única chamada HTTP', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      const chamadas = simularCaixa({ ultimo: 3070, atrasoMs: 50 });

      // Act
      await Promise.all(
        Array.from({ length: 20 }, () =>
          servico().garantirAtualizado('megasena'),
        ),
      );

      // Assert
      expect(chamadas).toEqual(['/megasena/']);
    });

    it('20 leituras HTTP concorrentes também fazem 1 única chamada à Caixa', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      const chamadas = simularCaixa({ ultimo: 3070, atrasoMs: 50 });

      // Act
      const respostas = await Promise.all(
        Array.from({ length: 20 }, () =>
          http().get('/loterias/megasena/resultados'),
        ),
      );

      // Assert
      expect(respostas.every((r) => r.status === 200)).toBe(true);
      expect(chamadas).toHaveLength(1);
    });

    it('o lock é liberado após erro: a segunda tentativa volta a chamar a Caixa', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      let chamadas = simularCaixa({ ultimo: 3070, status: 500 });
      await servico().garantirAtualizado('megasena');
      expect(chamadas).toHaveLength(2); // 2 tentativas

      limparCaixaSimulada();
      chamadas = simularCaixa({ ultimo: 3070 });

      // Act
      await servico().garantirAtualizado('megasena');
      const estado = await servico().estado('megasena');

      // Assert
      expect(chamadas).toEqual(['/megasena/']);
      expect(estado.ultimoErro).toBeNull();
      expect(estado.emAndamento).toBe(false);
    });

    it('após uma falha, garantirAtualizado espera o intervalo configurado antes de insistir', async () => {
      // Arrange
      await subirApp({ ajustes: { esperaAposErroMs: 60_000 } });
      await gravarConcursos(3070);
      const chamadas = simularCaixa({ ultimo: 3070, status: 500 });
      await servico().garantirAtualizado('megasena');
      const aposPrimeira = chamadas.length;

      // Act
      await servico().garantirAtualizado('megasena');
      await http().get('/loterias/megasena/resultados').expect(200);

      // Assert
      expect(aposPrimeira).toBe(2);
      expect(chamadas).toHaveLength(2);
    });

    it('emAndamento fica true durante a sincronização e false ao fim', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      simularCaixa({ ultimo: 3070, atrasoMs: 300 });

      // Act
      const andamento = servico().garantirAtualizado('megasena');
      await new Promise((resolver) => setTimeout(resolver, 100));
      const durante = await http()
        .get('/loterias/megasena/sincronizacao')
        .expect(200);
      await andamento;
      const depois = await http()
        .get('/loterias/megasena/sincronizacao')
        .expect(200);

      // Assert
      expect(durante.body.emAndamento).toBe(true);
      expect(depois.body.emAndamento).toBe(false);
    });
  });

  describe('falhas da Caixa (passo 7)', () => {
    it('HTTP 500: garantirAtualizado não lança, grava ultimoErro e a leitura segue com o banco', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      simularCaixa({ ultimo: 3070, status: 500 });

      // Act
      await expect(
        servico().garantirAtualizado('megasena'),
      ).resolves.toBeUndefined();
      const leitura = await http()
        .get('/loterias/megasena/resultados')
        .expect(200);
      const estado = await http()
        .get('/loterias/megasena/sincronizacao')
        .expect(200);

      // Assert
      expect(leitura.body.total).toBe(1);
      expect(estado.body.ultimoErro).toMatch(/HTTP 500/);
      expect(estado.body.emAndamento).toBe(false);
      expect(estado.body.ultimaEm).toBeNull();
    });

    it('timeout: ultimoErro descreve o tempo esgotado e a leitura segue com o banco', async () => {
      // Arrange
      await subirApp({ ajustes: { timeoutMs: 50 } });
      await gravarConcursos(3070);
      simularCaixa({ ultimo: 3070, atrasoMs: 400 });

      // Act
      const leitura = await http()
        .get('/loterias/megasena/resultados')
        .expect(200);
      const estado = await servico().estado('megasena');

      // Assert
      expect(leitura.body.total).toBe(1);
      expect(estado.ultimoErro).toMatch(/tempo esgotado \(50 ms\)/);
    });

    it('formato inesperado da resposta vira ultimoErro e não derruba a leitura', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      simularCaixa({
        ultimo: 3070,
        corpo: { numero: 3071, listaDezenas: 'x' },
      });

      // Act
      await http().get('/loterias/megasena/resultados').expect(200);
      const estado = await servico().estado('megasena');

      // Assert
      expect(estado.ultimoErro).toMatch(/Resposta da Caixa inválida/);
      expect(await repositorio().total('megasena')).toBe(1);
    });

    it('falha no meio dos faltantes mantém os já gravados e invalida o cache', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      simularCaixa({ ultimo: 3072, falharEm: [3072] });
      await app.get(LoteriasService).historicoCompleto('megasena');

      // Act
      await servico().garantirAtualizado('megasena');

      // Assert
      expect(await repositorio().ultimoNumero('megasena')).toBe(3071);
      const historico = await app
        .get(LoteriasService)
        .historicoCompleto('megasena');
      expect(historico.concursos.map((c) => c.numero)).toEqual([3070, 3071]);
      expect((await servico().estado('megasena')).ultimoErro).toMatch(
        /HTTP 500/,
      );
    });
  });

  describe('POST /loterias/:id/sincronizar', () => {
    it('sem o header X-Chave-Admin responde 401', async () => {
      // Arrange
      await subirApp();
      const chamadas = simularCaixa({ ultimo: 3070 });

      // Act
      await http().post('/loterias/megasena/sincronizar').expect(401);

      // Assert
      expect(chamadas).toHaveLength(0);
    });

    it('com chave errada responde 401', async () => {
      // Arrange
      await subirApp();

      // Act / Assert
      await http()
        .post('/loterias/megasena/sincronizar')
        .set('X-Chave-Admin', 'outra-chave')
        .expect(401);
    });

    it('sem CHAVE_ADMIN configurada responde 503', async () => {
      // Arrange
      await subirApp();
      delete process.env['CHAVE_ADMIN'];

      // Act
      const resposta = await http()
        .post('/loterias/megasena/sincronizar')
        .set('X-Chave-Admin', CHAVE)
        .expect(503);

      // Assert
      expect(resposta.body.message).toBe(
        'chave de administrador não configurada',
      );
    });

    it('com a chave certa força a busca e devolve o resumo', async () => {
      // Arrange
      await subirApp({ marcarSincronizada: true }); // não vencida: só o POST força
      await gravarConcursos(3070);
      const chamadas = simularCaixa({ ultimo: 3073 });

      // Act
      const resposta = await http()
        .post('/loterias/megasena/sincronizar')
        .set('X-Chave-Admin', CHAVE)
        .expect(201);

      // Assert
      expect(resposta.body).toEqual({
        novos: 3,
        atualizados: 0,
        inalterados: 0,
        ultimoConcurso: 3073,
      });
      expect(chamadas).toHaveLength(4);
    });

    it('?de=3000&ate=3002 reimporta o intervalo: 3 chamadas e inalterados = 3', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3000, 3001, 3002);
      const chamadas = simularCaixa({ ultimo: 3070 });

      // Act
      const resposta = await http()
        .post('/loterias/megasena/sincronizar?de=3000&ate=3002')
        .set('X-Chave-Admin', CHAVE)
        .expect(201);

      // Assert
      expect(chamadas).toEqual([
        '/megasena/3000',
        '/megasena/3001',
        '/megasena/3002',
      ]);
      expect(resposta.body).toEqual({
        novos: 0,
        atualizados: 0,
        inalterados: 3,
        ultimoConcurso: 3002,
      });
    });

    it('o intervalo conta concursos novos e atualizados', async () => {
      // Arrange
      await subirApp();
      await repositorio().upsertConcurso(
        'megasena',
        {
          ...mapearRespostaCaixa(corpoCaixa(3000)),
          dezenas: [1, 2, 3, 4, 5, 6],
        },
        'planilha',
      );
      simularCaixa({ ultimo: 3070 });

      // Act
      const resposta = await http()
        .post('/loterias/megasena/sincronizar?de=3000&ate=3001')
        .set('X-Chave-Admin', CHAVE)
        .expect(201);

      // Assert
      expect(resposta.body).toMatchObject({
        novos: 1,
        atualizados: 1,
        inalterados: 0,
      });
    });

    it('apenas "ate" reimporta só aquele concurso', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3000);
      const chamadas = simularCaixa({ ultimo: 3070 });

      // Act
      await http()
        .post('/loterias/megasena/sincronizar?ate=3000')
        .set('X-Chave-Admin', CHAVE)
        .expect(201);

      // Assert
      expect(chamadas).toEqual(['/megasena/3000']);
    });

    it.each([
      ['de maior que ate', '?de=10&ate=5'],
      ['valor não numérico', '?de=abc'],
      ['intervalo acima de 500 concursos', '?de=1&ate=501'],
      ['de menor que 1', '?de=0&ate=3'],
    ])('intervalo inválido (%s) responde 400', async (_nome, consulta) => {
      // Arrange
      await subirApp();
      const chamadas = simularCaixa({ ultimo: 3070 });

      // Act
      await http()
        .post(`/loterias/megasena/sincronizar${consulta}`)
        .set('X-Chave-Admin', CHAVE)
        .expect(400);

      // Assert
      expect(chamadas).toHaveLength(0);
    });

    it('falha da Caixa responde 502 com a mensagem e grava ultimoErro', async () => {
      // Arrange
      await subirApp();
      simularCaixa({ ultimo: 3070, status: 503 });

      // Act
      const resposta = await http()
        .post('/loterias/megasena/sincronizar')
        .set('X-Chave-Admin', CHAVE)
        .expect(502);

      // Assert
      expect(resposta.body.message).toMatch(/HTTP 503/);
      expect((await servico().estado('megasena')).ultimoErro).toMatch(
        /HTTP 503/,
      );
    });

    it('loteria desconhecida responde 404', async () => {
      // Arrange
      await subirApp();

      // Act / Assert
      await http()
        .post('/loterias/quina/sincronizar')
        .set('X-Chave-Admin', CHAVE)
        .expect(404);
    });

    it('o 6º POST no mesmo minuto é barrado pelo limite estrito (429)', async () => {
      // Arrange
      await subirApp();
      const postar = () =>
        http().post('/loterias/quina/sincronizar').set('X-Chave-Admin', CHAVE);

      // Act
      const status: number[] = [];
      for (let i = 0; i < 6; i++) status.push((await postar()).status);

      // Assert
      expect(status).toEqual([404, 404, 404, 404, 404, 429]);
    });
  });

  describe('GET /loterias/:id/sincronizacao', () => {
    it('sem nenhuma sincronização devolve tudo nulo e emAndamento = false', async () => {
      // Arrange
      await subirApp();

      // Act
      const resposta = await http()
        .get('/loterias/megasena/sincronizacao')
        .expect(200);

      // Assert
      expect(resposta.body).toEqual({
        loteriaId: 'megasena',
        ultimaEm: null,
        ultimoConcurso: null,
        proximoSorteioEm: null,
        ultimoErro: null,
        emAndamento: false,
      });
    });

    it('reflete a última sincronização bem-sucedida', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      simularCaixa({ ultimo: 3071, dataProximoConcurso: '21/10/2026' });
      await http().get('/loterias/megasena/resultados').expect(200);

      // Act
      const resposta = await http()
        .get('/loterias/megasena/sincronizacao')
        .expect(200);

      // Assert
      expect(resposta.body).toMatchObject({
        ultimoConcurso: 3071,
        proximoSorteioEm: '2026-10-21T23:00:00Z',
        ultimoErro: null,
        emAndamento: false,
      });
    });

    it('um sucesso limpa o erro anterior', async () => {
      // Arrange
      await subirApp();
      await gravarConcursos(3070);
      simularCaixa({ ultimo: 3070, status: 500 });
      await servico().garantirAtualizado('megasena');
      expect((await servico().estado('megasena')).ultimoErro).not.toBeNull();
      limparCaixaSimulada();
      simularCaixa({ ultimo: 3070 });

      // Act
      await servico().garantirAtualizado('megasena');

      // Assert
      expect((await servico().estado('megasena')).ultimoErro).toBeNull();
    });

    it('loteria desconhecida responde 404', async () => {
      // Arrange
      await subirApp();

      // Act / Assert
      await http().get('/loterias/quina/sincronizacao').expect(404);
    });
  });

  it('loteria desconhecida em uma rota de leitura segue respondendo 404', async () => {
    // Arrange
    await subirApp();

    // Act / Assert
    await http().get('/loterias/quina/resultados').expect(404);
  });

  it('o OpenAPI documenta as rotas de sincronização e o header de administrador', async () => {
    // Arrange
    await subirApp();

    // Act
    const { body } = await http().get('/docs-json').expect(200);

    // Assert
    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining([
        '/loterias/{id}/sincronizar',
        '/loterias/{id}/sincronizacao',
      ]),
    );
    const parametros = body.paths['/loterias/{id}/sincronizar'].post.parameters;
    expect(parametros.map((p: { name: string }) => p.name)).toEqual(
      expect.arrayContaining(['X-Chave-Admin', 'de', 'ate']),
    );
  });
});
