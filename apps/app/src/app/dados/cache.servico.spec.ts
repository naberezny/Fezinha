import { TestBed } from '@angular/core/testing';
import { CacheServico } from './cache.servico';
import type { JogoSalvo } from './historico.store';

describe('CacheServico sem IndexedDB (jsdom)', () => {
  let cache: CacheServico;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    cache = TestBed.inject(CacheServico);
  });

  it('o ambiente de teste não tem indexedDB', () => {
    // Assert
    expect(typeof indexedDB).toBe('undefined');
  });

  it('abrir() não lança e devolve undefined', async () => {
    // Act / Assert
    await expect(cache.abrir()).resolves.toBeUndefined();
  });

  it('leituras devolvem vazio e gravações não lançam', async () => {
    // Arrange
    const jogo: JogoSalvo = {
      id: 'a',
      loteriaId: 'megasena',
      dezenas: [1, 2, 3, 4, 5, 6],
      estrategia: 'aleatorio',
      criadoEm: '2026-10-14T10:00:00.000Z',
      concursoBase: 1,
    };

    // Act / Assert
    await expect(cache.lerHistorico('megasena')).resolves.toBeUndefined();
    await expect(cache.listarJogos('megasena')).resolves.toEqual([]);
    await expect(cache.gravarHistorico('megasena', '"x"', '2026-10-14T10:00:00.000Z', [])).resolves.toBeUndefined();
    await expect(cache.gravarJogos([jogo])).resolves.toBeUndefined();
    await expect(cache.removerJogo('a')).resolves.toBeUndefined();
  });
});
