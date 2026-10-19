import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LOTOMANIA_FALSA } from '../testes/stores-fake';
import { ApiServico } from './api.servico';

const URL_HISTORICO = '/loterias/megasena/historico';

function concursoDaApi(numero: number, dezenas: number[]) {
  return {
    numero,
    data: '2026-10-14',
    dezenas,
    acumulou: true,
    premiacoes: [{ faixa: 1, ganhadores: 0, rateioCentavos: 0 }],
    valorAcumuladoCentavos: 1234567890,
    estimativaProximoCentavos: 5000000000,
    arrecadacaoCentavos: 99900,
    acumuladoEspecialCentavos: 0,
    proximoNumero: numero + 1,
    dataProximoSorteio: '2026-10-17',
    locaisGanhadores: [{ descricao: 'SP', uf: 'SP', quantidade: 1 }],
  };
}

describe('ApiServico', () => {
  let api: ApiServico;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiServico);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('historico', () => {
    it('converte centavos de number para bigint e ordena as dezenas', async () => {
      // Arrange
      const promessa = api.historico('megasena');
      const requisicao = http.expectOne(URL_HISTORICO);

      // Act
      requisicao.flush(
        { concursos: [concursoDaApi(3070, [60, 5, 33, 12, 1, 47])] },
        { headers: { ETag: '"3070-3070"' } },
      );
      const resposta = await promessa;

      // Assert
      expect(resposta.status).toBe('ok');
      if (resposta.status !== 'ok') return;
      expect(resposta.etag).toBe('"3070-3070"');
      const [concurso] = resposta.concursos;
      expect(concurso.dezenas).toEqual([1, 5, 12, 33, 47, 60]);
      expect(concurso.valorAcumuladoCentavos).toBe(BigInt(1234567890));
      expect(concurso.estimativaProximoCentavos).toBe(BigInt(5000000000));
      expect(concurso.arrecadacaoCentavos).toBe(BigInt(99900));
      expect(concurso.acumuladoEspecialCentavos).toBe(BigInt(0));
      expect(concurso.premiacoes[0].rateioCentavos).toBe(BigInt(0));
      expect(typeof concurso.premiacoes[0].rateioCentavos).toBe('bigint');
      expect(concurso.proximoNumero).toBe(3071);
      expect(concurso.locaisGanhadores).toHaveLength(1);
    });

    it('arredonda centavos fracionários ao inteiro mais próximo', async () => {
      // Arrange
      const promessa = api.historico('megasena');
      const corpo = concursoDaApi(1, [1, 2, 3, 4, 5, 6]);
      corpo.arrecadacaoCentavos = 100.6;

      // Act
      http.expectOne(URL_HISTORICO).flush({ concursos: [corpo] });
      const resposta = await promessa;

      // Assert
      expect(resposta.status === 'ok' && resposta.concursos[0].arrecadacaoCentavos).toBe(BigInt(101));
    });

    it('não envia If-None-Match quando não há etag', async () => {
      // Arrange
      const promessa = api.historico('megasena');

      // Act
      const requisicao = http.expectOne(URL_HISTORICO);
      requisicao.flush({ concursos: [] });
      await promessa;

      // Assert
      expect(requisicao.request.headers.has('If-None-Match')).toBe(false);
    });

    it('envia If-None-Match quando há etag', async () => {
      // Arrange
      const promessa = api.historico('megasena', '"3070-3070"');

      // Act
      const requisicao = http.expectOne(URL_HISTORICO);
      requisicao.flush({ concursos: [] });
      await promessa;

      // Assert
      expect(requisicao.request.headers.get('If-None-Match')).toBe('"3070-3070"');
    });

    it('resposta 304 vira nao-modificado', async () => {
      // Arrange
      const promessa = api.historico('megasena', '"3070-3070"');

      // Act
      http
        .expectOne(URL_HISTORICO)
        .flush(null, { status: 304, statusText: 'Not Modified' });
      const resposta = await promessa;

      // Assert
      expect(resposta).toEqual({ status: 'nao-modificado' });
    });

    it('erro de rede vira mensagem em português', async () => {
      // Arrange
      const promessa = api.historico('megasena');

      // Act
      http.expectOne(URL_HISTORICO).error(new ProgressEvent('error'));

      // Assert
      await expect(promessa).rejects.toThrow('Sem conexão com o servidor');
    });

    it('erro 500 vira mensagem de indisponibilidade', async () => {
      // Arrange
      const promessa = api.historico('megasena');

      // Act
      http
        .expectOne(URL_HISTORICO)
        .flush('falha', { status: 500, statusText: 'Internal Server Error' });

      // Assert
      await expect(promessa).rejects.toThrow('O servidor está indisponível no momento');
    });

    it('corpo sem a lista de concursos é rejeitado', async () => {
      // Arrange
      const promessa = api.historico('megasena');

      // Act
      http.expectOne(URL_HISTORICO).flush({ qualquer: 'coisa' });

      // Assert
      await expect(promessa).rejects.toThrow('Resposta inválida do servidor');
    });
  });

  describe('loterias', () => {
    it('devolve a definição completa de cada loteria, sem campos extras', async () => {
      // Arrange
      const promessa = api.loterias();

      // Act
      http.expectOne('/loterias').flush([{ ...LOTOMANIA_FALSA, campoNovo: 'ignorado' }]);
      const [definicao] = await promessa;

      // Assert
      expect(definicao).toEqual(LOTOMANIA_FALSA);
      expect(definicao.primeiraDezena).toBe(0);
      expect(definicao.faixas[0].nome).toBe('20 acertos');
    });

    it('aceita a lista embrulhada em { loterias: [...] }', async () => {
      // Arrange
      const promessa = api.loterias();

      // Act
      http.expectOne('/loterias').flush({ loterias: [LOTOMANIA_FALSA] });

      // Assert
      await expect(promessa).resolves.toEqual([LOTOMANIA_FALSA]);
    });

    it('corpo que não é lista é rejeitado', async () => {
      // Arrange
      const promessa = api.loterias();

      // Act
      http.expectOne('/loterias').flush({ qualquer: 'coisa' });

      // Assert
      await expect(promessa).rejects.toThrow('Resposta inválida do servidor');
    });

    it('erro de rede vira mensagem em português', async () => {
      // Arrange
      const promessa = api.loterias();

      // Act
      http.expectOne('/loterias').error(new ProgressEvent('error'));

      // Assert
      await expect(promessa).rejects.toThrow('Sem conexão com o servidor');
    });
  });

  describe('saude', () => {
    it('consulta /saude', async () => {
      // Arrange
      const promessa = api.saude();

      // Act
      http.expectOne('/saude').flush({ ok: true, versao: '0.1.0', ultimoConcurso: 3070 });

      // Assert
      await expect(promessa).resolves.toEqual({ ok: true, versao: '0.1.0', ultimoConcurso: 3070 });
    });

    it('erro de rede vira mensagem em português', async () => {
      // Arrange
      const promessa = api.saude();

      // Act
      http.expectOne('/saude').error(new ProgressEvent('error'));

      // Assert
      await expect(promessa).rejects.toThrow('Sem conexão com o servidor');
    });
  });
});
