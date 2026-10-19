import { TestBed } from '@angular/core/testing';
import { listarLoterias, type Concurso, type LoteriaDefinicao } from '@sorteios/core';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena/definicao';
import { LOTOMANIA_FALSA } from '../testes/stores-fake';
import { ApiServico, type RespostaHistoricoApi } from './api.servico';
import { CacheServico, type HistoricoEmCache } from './cache.servico';
import { CHAVE_LOTERIA_ATIVA, CHAVE_LOTERIAS_CONHECIDAS, HistoricoStoreImpl } from './historico.store.impl';

function concurso(numero: number, dezenas: number[] = [1, 2, 3, 4, 5, 6]): Concurso {
  return {
    numero,
    data: '2026-10-14',
    dezenas,
    acumulou: false,
    premiacoes: [],
    valorAcumuladoCentavos: BigInt(0),
    estimativaProximoCentavos: BigInt(0),
    arrecadacaoCentavos: BigInt(0),
    acumuladoEspecialCentavos: BigInt(0),
    locaisGanhadores: [],
  };
}

function emCache(numeros: number[], etag = '"cache"'): HistoricoEmCache {
  return {
    loteriaId: 'megasena',
    etag,
    atualizadoEm: '2026-10-01T10:00:00.000Z',
    concursos: numeros.map((n) => concurso(n)),
  };
}

function respostaOk(numeros: number[], etag = '"rede"'): RespostaHistoricoApi {
  return { status: 'ok', etag, concursos: numeros.map((n) => concurso(n)) };
}

/** Concurso da Lotomania: 20 dezenas de 00..99, incluindo o 00. */
const DEZENAS_LOTOMANIA = Array.from({ length: 20 }, (_, i) => i * 5);

function respostaLotomania(numeros: number[], etag = '"lotomania"'): RespostaHistoricoApi {
  return { status: 'ok', etag, concursos: numeros.map((n) => concurso(n, DEZENAS_LOTOMANIA)) };
}

function promessaManual<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

describe('HistoricoStoreImpl', () => {
  let api: { historico: jest.Mock; saude: jest.Mock; loterias: jest.Mock };
  let cache: { lerHistorico: jest.Mock; gravarHistorico: jest.Mock };
  let store: HistoricoStoreImpl;

  beforeEach(() => {
    localStorage.clear();
    api = { historico: jest.fn(), saude: jest.fn(), loterias: jest.fn().mockResolvedValue([MEGA_SENA, LOTOMANIA_FALSA]) };
    cache = {
      lerHistorico: jest.fn().mockResolvedValue(undefined),
      gravarHistorico: jest.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        HistoricoStoreImpl,
        { provide: ApiServico, useValue: api },
        { provide: CacheServico, useValue: cache },
      ],
    });
    store = TestBed.inject(HistoricoStoreImpl);
  });

  it('começa vazio, com a Mega-Sena como loteria ativa', () => {
    // Assert
    expect(store.loteria().id).toBe('megasena');
    expect(store.historico()).toBeUndefined();
    expect(store.ultimo()).toBeUndefined();
    expect(store.carregando()).toBe(false);
    expect(store.erro()).toBeUndefined();
    expect(store.somenteCache()).toBe(false);
  });

  it('abre com o cache e marca somenteCache enquanto a rede não responde', async () => {
    // Arrange
    cache.lerHistorico.mockResolvedValue(emCache([1, 2, 3]));
    const rede = promessaManual<RespostaHistoricoApi>();
    api.historico.mockReturnValue(rede.promessa);

    // Act
    const carga = store.carregar();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Assert (antes da rede responder)
    expect(store.historico()?.concursos.map((c) => c.numero)).toEqual([1, 2, 3]);
    expect(store.ultimo()?.numero).toBe(3);
    expect(store.somenteCache()).toBe(true);
    expect(store.carregando()).toBe(true);
    expect(store.atualizadoEm()).toBe('2026-10-01T10:00:00.000Z');

    rede.resolver({ status: 'nao-modificado' });
    await carga;
    expect(store.carregando()).toBe(false);
  });

  it('revalida com o etag do cache; nao-modificado só confirma a rede', async () => {
    // Arrange
    cache.lerHistorico.mockResolvedValue(emCache([1, 2, 3], '"abc"'));
    api.historico.mockResolvedValue({ status: 'nao-modificado' });

    // Act
    await store.carregar();

    // Assert
    expect(api.historico).toHaveBeenCalledWith('megasena', '"abc"');
    expect(store.somenteCache()).toBe(false);
    expect(store.erro()).toBeUndefined();
    expect(store.historico()?.concursos).toHaveLength(3);
    expect(cache.gravarHistorico).not.toHaveBeenCalled();
    expect(store.atualizadoEm()).not.toBe('2026-10-01T10:00:00.000Z');
  });

  it('revalida, publica o resultado da rede e grava no cache', async () => {
    // Arrange
    cache.lerHistorico.mockResolvedValue(emCache([1, 2]));
    api.historico.mockResolvedValue(respostaOk([1, 2, 3, 4], '"novo"'));

    // Act
    await store.carregar();

    // Assert
    expect(store.historico()?.concursos.map((c) => c.numero)).toEqual([1, 2, 3, 4]);
    expect(store.ultimo()?.numero).toBe(4);
    expect(store.somenteCache()).toBe(false);
    expect(store.erro()).toBeUndefined();
    expect(store.atualizadoEm()).toBeDefined();
    expect(cache.gravarHistorico).toHaveBeenCalledTimes(1);
    const [loteriaId, etag, atualizadoEm, concursos] = cache.gravarHistorico.mock.calls[0];
    expect(loteriaId).toBe('megasena');
    expect(etag).toBe('"novo"');
    expect(atualizadoEm).toBe(store.atualizadoEm());
    expect(concursos).toHaveLength(4);
  });

  it('sem cache, carrega da rede sem enviar etag', async () => {
    // Arrange
    api.historico.mockResolvedValue(respostaOk([10, 11]));

    // Act
    await store.carregar();

    // Assert
    expect(api.historico).toHaveBeenCalledWith('megasena', undefined);
    expect(store.historico()?.concursos).toHaveLength(2);
    expect(store.somenteCache()).toBe(false);
  });

  it('erro de rede não apaga o cache e preenche erro', async () => {
    // Arrange
    cache.lerHistorico.mockResolvedValue(emCache([1, 2, 3]));
    api.historico.mockRejectedValue(new Error('Sem conexão com o servidor'));

    // Act
    await store.carregar();

    // Assert
    expect(store.erro()).toBe('Sem conexão com o servidor');
    expect(store.historico()?.concursos).toHaveLength(3);
    expect(store.somenteCache()).toBe(true);
    expect(store.carregando()).toBe(false);
    expect(cache.gravarHistorico).not.toHaveBeenCalled();
  });

  it('sem cache e sem rede, mantém o histórico indefinido e preenche erro', async () => {
    // Arrange
    api.historico.mockRejectedValue(new Error('Sem conexão com o servidor'));

    // Act
    await store.carregar();

    // Assert
    expect(store.historico()).toBeUndefined();
    expect(store.erro()).toBe('Sem conexão com o servidor');
  });

  it('uma leitura bem-sucedida depois do erro limpa a mensagem', async () => {
    // Arrange
    api.historico.mockRejectedValueOnce(new Error('Sem conexão com o servidor'));
    await store.carregar();
    api.historico.mockResolvedValueOnce(respostaOk([1]));

    // Act
    await store.carregar();

    // Assert
    expect(store.erro()).toBeUndefined();
    expect(store.historico()?.concursos).toHaveLength(1);
  });

  it('chamadas concorrentes de carregar() compartilham a mesma promessa', async () => {
    // Arrange
    const rede = promessaManual<RespostaHistoricoApi>();
    api.historico.mockReturnValue(rede.promessa);

    // Act
    const primeira = store.carregar();
    const segunda = store.carregar();
    rede.resolver(respostaOk([1, 2]));
    await Promise.all([primeira, segunda]);

    // Assert
    expect(segunda).toBe(primeira);
    expect(api.historico).toHaveBeenCalledTimes(1);
    expect(cache.lerHistorico).toHaveBeenCalledTimes(1);
  });

  it('depois de concluir, uma nova chamada de carregar() revalida sem reler o cache', async () => {
    // Arrange
    api.historico.mockResolvedValueOnce(respostaOk([1, 2], '"v1"'));
    await store.carregar();
    api.historico.mockResolvedValueOnce({ status: 'nao-modificado' });

    // Act
    await store.carregar();

    // Assert
    expect(cache.lerHistorico).toHaveBeenCalledTimes(1);
    expect(api.historico).toHaveBeenLastCalledWith('megasena', '"v1"');
  });

  it('atualizar() ignora o etag', async () => {
    // Arrange
    cache.lerHistorico.mockResolvedValue(emCache([1, 2], '"abc"'));
    api.historico.mockResolvedValue({ status: 'nao-modificado' });
    await store.carregar();
    api.historico.mockResolvedValue(respostaOk([1, 2, 3], '"forcado"'));

    // Act
    await store.atualizar();

    // Assert
    expect(api.historico).toHaveBeenLastCalledWith('megasena', undefined);
    expect(store.historico()?.concursos).toHaveLength(3);
    expect(cache.gravarHistorico).toHaveBeenCalledTimes(1);
  });

  describe('loterias e loteria ativa', () => {
    it('lista só a Mega-Sena até a API responder e passa a listar as duas depois de carregar()', async () => {
      // Arrange
      api.historico.mockResolvedValue(respostaOk([1]));
      expect(store.loterias().map((l) => l.id)).toEqual(['megasena']);

      // Act
      await store.carregar();
      await Promise.resolve();

      // Assert
      expect(api.loterias).toHaveBeenCalledTimes(1);
      expect(store.loterias().map((l) => l.id)).toEqual(['megasena', 'lotomania']);
      expect(listarLoterias().map((l) => l.id)).toContain('lotomania');
    });

    it('troca a loteria ativa e carrega o histórico e o cache da nova loteria', async () => {
      // Arrange
      api.historico.mockImplementation(async (id: string) =>
        id === 'lotomania' ? respostaLotomania([2900, 2901]) : respostaOk([1, 2, 3]),
      );
      await store.carregar();
      await Promise.resolve();

      // Act
      await store.selecionarLoteria('lotomania');

      // Assert
      expect(store.loteria().id).toBe('lotomania');
      expect(store.historico()?.loteria.id).toBe('lotomania');
      expect(store.historico()?.concursos.map((c) => c.numero)).toEqual([2900, 2901]);
      // as dezenas seguem o volante da Lotomania: o 00 vem depois do 99
      expect(store.ultimo()?.dezenas.at(-1)).toBe(0);
      expect(cache.lerHistorico).toHaveBeenCalledWith('lotomania');
      expect(api.historico).toHaveBeenLastCalledWith('lotomania', undefined);
      expect(cache.gravarHistorico).toHaveBeenLastCalledWith('lotomania', '"lotomania"', expect.any(String), expect.any(Array));
    });

    it('guarda um histórico por loteria em memória: voltar a uma loteria já carregada é instantâneo', async () => {
      // Arrange
      api.historico.mockImplementation(async (id: string) =>
        id === 'lotomania' ? respostaLotomania([2900]) : respostaOk([1, 2, 3]),
      );
      await store.carregar();
      await Promise.resolve();
      await store.selecionarLoteria('lotomania');
      cache.lerHistorico.mockClear();
      api.historico.mockClear();

      // Act (sem await: a troca é síncrona)
      const revalidacao = store.selecionarLoteria('megasena');

      // Assert
      expect(store.loteria().id).toBe('megasena');
      expect(store.historico()?.concursos.map((c) => c.numero)).toEqual([1, 2, 3]);
      await revalidacao;
      expect(cache.lerHistorico).not.toHaveBeenCalled();
      expect(api.historico).toHaveBeenCalledWith('megasena', '"rede"');
    });

    it('mantém erro e estado de carregamento separados por loteria', async () => {
      // Arrange
      api.historico.mockImplementation(async (id: string) => {
        if (id === 'lotomania') throw new Error('Sem conexão com o servidor');
        return respostaOk([1, 2]);
      });
      await store.carregar();
      await Promise.resolve();

      // Act
      await store.selecionarLoteria('lotomania');

      // Assert
      expect(store.erro()).toBe('Sem conexão com o servidor');
      expect(store.historico()).toBeUndefined();
      await store.selecionarLoteria('megasena');
      expect(store.erro()).toBeUndefined();
      expect(store.historico()?.concursos).toHaveLength(2);
    });

    it('persiste a escolha no localStorage e a restaura numa nova instância (inclusive a definição, para abrir offline)', async () => {
      // Arrange
      api.historico.mockResolvedValue(respostaLotomania([1]));
      await store.carregar();
      await Promise.resolve();

      // Act
      await store.selecionarLoteria('lotomania');
      const outra = TestBed.runInInjectionContext(() => new HistoricoStoreImpl());

      // Assert
      expect(localStorage.getItem(CHAVE_LOTERIA_ATIVA)).toBe('lotomania');
      expect(JSON.parse(localStorage.getItem(CHAVE_LOTERIAS_CONHECIDAS) ?? '[]').map((l: LoteriaDefinicao) => l.id)).toEqual([
        'megasena',
        'lotomania',
      ]);
      expect(outra.loteria().id).toBe('lotomania');
      expect(outra.loterias().map((l) => l.id)).toEqual(['megasena', 'lotomania']);
    });

    it('sem nada persistido, a Mega-Sena é a loteria ativa', () => {
      // Arrange / Act / Assert
      expect(localStorage.getItem(CHAVE_LOTERIA_ATIVA)).toBeNull();
      expect(store.loteria().id).toBe('megasena');
    });

    it('ignora a seleção de uma loteria desconhecida', async () => {
      // Arrange
      api.historico.mockResolvedValue(respostaOk([1]));

      // Act
      await store.selecionarLoteria('quina');

      // Assert
      expect(store.loteria().id).toBe('megasena');
      expect(localStorage.getItem(CHAVE_LOTERIA_ATIVA)).toBeNull();
      expect(api.historico).not.toHaveBeenCalled();
    });

    it('escolha persistida de uma loteria ainda desconhecida espera a lista da API antes de carregar', async () => {
      // Arrange
      localStorage.setItem(CHAVE_LOTERIA_ATIVA, 'lotomania');
      const reaberta = TestBed.runInInjectionContext(() => new HistoricoStoreImpl());
      api.historico.mockResolvedValue(respostaLotomania([2900]));
      expect(reaberta.loteria().id).toBe('megasena');

      // Act
      await reaberta.carregar();

      // Assert
      expect(reaberta.loteria().id).toBe('lotomania');
      expect(api.historico).toHaveBeenCalledTimes(1);
      expect(api.historico).toHaveBeenCalledWith('lotomania', undefined);
      expect(reaberta.historico()?.loteria.id).toBe('lotomania');
    });

    it('aguardarLoterias espera a lista da API e passa a conhecer as loterias novas (link direto para um jogo ainda não visto)', async () => {
      // Arrange
      expect(store.loterias().map((l) => l.id)).toEqual(['megasena']);

      // Act
      await store.aguardarLoterias();

      // Assert
      expect(store.loterias().map((l) => l.id)).toEqual(['megasena', 'lotomania']);
      expect(api.loterias).toHaveBeenCalledTimes(1);
      expect(api.historico).not.toHaveBeenCalled();
    });

    it('aguardarLoterias nunca rejeita e não repete a leitura da lista já feita', async () => {
      // Arrange
      api.loterias.mockRejectedValueOnce(new Error('Sem conexão com o servidor'));

      // Act
      await expect(store.aguardarLoterias()).resolves.toBeUndefined();
      await store.aguardarLoterias();
      await store.aguardarLoterias();

      // Assert (a falha libera nova tentativa; o sucesso fica em memória)
      expect(api.loterias).toHaveBeenCalledTimes(2);
      expect(store.loterias().map((l) => l.id)).toEqual(['megasena', 'lotomania']);
    });

    it('se a API de loterias falhar, segue com a Mega-Sena e carrega o histórico normalmente', async () => {
      // Arrange
      api.loterias.mockRejectedValue(new Error('Sem conexão com o servidor'));
      api.historico.mockResolvedValue(respostaOk([1, 2]));

      // Act
      await store.carregar();
      await Promise.resolve();

      // Assert
      expect(store.loterias().map((l) => l.id)).toEqual(['megasena']);
      expect(store.historico()?.concursos).toHaveLength(2);
      expect(store.erro()).toBeUndefined();
    });

    it('descarta definições inválidas vindas da API', async () => {
      // Arrange
      const invalida = { ...LOTOMANIA_FALSA, id: 'invalida', volante: { colunas: 3, linhas: 3 } };
      api.loterias.mockResolvedValue([MEGA_SENA, invalida]);
      api.historico.mockResolvedValue(respostaOk([1]));

      // Act
      await store.carregar();
      await Promise.resolve();

      // Assert
      expect(store.loterias().map((l) => l.id)).toEqual(['megasena']);
    });
  });
});
