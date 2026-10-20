import { Injectable, inject, signal } from '@angular/core';
import { CacheServico } from './cache.servico';
import { JogosSalvosStore, type JogoSalvo } from './historico.store';

/** Gera um identificador único; usa `crypto.randomUUID()` quando disponível. */
function gerarId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Jogos salvos pelo usuário ("Meus jogos") de todas as loterias, persistidos em IndexedDB neste navegador. */
@Injectable()
export class JogosSalvosStoreImpl extends JogosSalvosStore {
  private readonly _cache = inject(CacheServico);
  private readonly _jogos = signal<JogoSalvo[]>([]);

  readonly jogos = this._jogos.asReadonly();

  async carregar(): Promise<void> {
    const salvos = await this._cache.listarTodosJogos();
    this._jogos.set(this._maisRecentesPrimeiro(salvos));
  }

  async salvar(jogos: Omit<JogoSalvo, 'id' | 'criadoEm'>[]): Promise<void> {
    if (jogos.length === 0) return;
    const criadoEm = new Date().toISOString();
    const novos: JogoSalvo[] = jogos.map((j) => ({
      ...j,
      id: gerarId(),
      criadoEm,
    }));
    await this._cache.gravarJogos(novos);
    this._jogos.update((atuais) => this._maisRecentesPrimeiro([...novos, ...atuais]));
  }

  async remover(id: string): Promise<void> {
    await this._cache.removerJogo(id);
    this._jogos.update((atuais) => atuais.filter((j) => j.id !== id));
  }

  /** Ordem estável: criação mais recente primeiro (empate mantém a ordem recebida). */
  private _maisRecentesPrimeiro(jogos: JogoSalvo[]): JogoSalvo[] {
    return [...jogos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }
}
