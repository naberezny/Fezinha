import { TestBed } from '@angular/core/testing';
import { CacheServico } from './cache.servico';
import type { JogoSalvo } from './historico.store';
import { JogosSalvosStoreImpl } from './jogos-salvos.store.impl';

const NOVO_JOGO = {
  loteriaId: 'megasena',
  dezenas: [3, 14, 22, 35, 41, 58],
  estrategia: 'atrasadas',
  concursoBase: 3070,
};

describe('JogosSalvosStoreImpl', () => {
  let cache: {
    listarJogos: jest.Mock;
    gravarJogos: jest.Mock;
    removerJogo: jest.Mock;
  };
  let store: JogosSalvosStoreImpl;

  beforeEach(() => {
    cache = {
      listarJogos: jest.fn().mockResolvedValue([]),
      gravarJogos: jest.fn().mockResolvedValue(undefined),
      removerJogo: jest.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [JogosSalvosStoreImpl, { provide: CacheServico, useValue: cache }],
    });
    store = TestBed.inject(JogosSalvosStoreImpl);
  });

  it('carregar() publica os jogos do cache, mais recentes primeiro', async () => {
    // Arrange
    const antigo: JogoSalvo = { ...NOVO_JOGO, id: 'a', criadoEm: '2026-10-01T10:00:00.000Z' };
    const recente: JogoSalvo = { ...NOVO_JOGO, id: 'b', criadoEm: '2026-10-10T10:00:00.000Z' };
    cache.listarJogos.mockResolvedValue([antigo, recente]);

    // Act
    await store.carregar();

    // Assert
    expect(cache.listarJogos).toHaveBeenCalledWith('megasena');
    expect(store.jogos().map((j) => j.id)).toEqual(['b', 'a']);
  });

  it('salvar() gera id e criadoEm, grava e atualiza o signal', async () => {
    // Act
    await store.salvar([NOVO_JOGO, { ...NOVO_JOGO, dezenas: [1, 2, 3, 4, 5, 6] }]);

    // Assert
    const salvos = store.jogos();
    expect(salvos).toHaveLength(2);
    for (const jogo of salvos) {
      expect(jogo.id).toBeTruthy();
      expect(Number.isNaN(Date.parse(jogo.criadoEm))).toBe(false);
      expect(jogo.estrategia).toBe('atrasadas');
      expect(jogo.concursoBase).toBe(3070);
    }
    expect(new Set(salvos.map((j) => j.id)).size).toBe(2);
    expect(cache.gravarJogos).toHaveBeenCalledTimes(1);
    expect(cache.gravarJogos).toHaveBeenCalledWith(expect.arrayContaining(salvos));
  });

  it('salvar() preserva os jogos já existentes', async () => {
    // Arrange
    const existente: JogoSalvo = { ...NOVO_JOGO, id: 'x', criadoEm: '2000-01-01T00:00:00.000Z' };
    cache.listarJogos.mockResolvedValue([existente]);
    await store.carregar();

    // Act
    await store.salvar([NOVO_JOGO]);

    // Assert
    expect(store.jogos()).toHaveLength(2);
    expect(store.jogos().some((j) => j.id === 'x')).toBe(true);
    expect(store.jogos()[0].id).not.toBe('x');
  });

  it('salvar() sem jogos não grava nada', async () => {
    // Act
    await store.salvar([]);

    // Assert
    expect(cache.gravarJogos).not.toHaveBeenCalled();
    expect(store.jogos()).toEqual([]);
  });

  it('remover() apaga do cache e do signal', async () => {
    // Arrange
    await store.salvar([NOVO_JOGO, { ...NOVO_JOGO, dezenas: [1, 2, 3, 4, 5, 6] }]);
    const [primeiro, segundo] = store.jogos();

    // Act
    await store.remover(primeiro.id);

    // Assert
    expect(cache.removerJogo).toHaveBeenCalledWith(primeiro.id);
    expect(store.jogos().map((j) => j.id)).toEqual([segundo.id]);
  });
});
