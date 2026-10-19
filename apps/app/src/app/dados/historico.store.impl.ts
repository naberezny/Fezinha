import { Injectable, computed, inject, signal } from '@angular/core';
import { compararDezenas, listarLoterias, registrarLoteria, validarDefinicao } from '@sorteios/core';
import type { Concurso, Historico, LoteriaDefinicao } from '@sorteios/core';
import { MEGA_SENA, registrarMegaSena } from '@sorteios/loterias/mega-sena/definicao';
import { ApiServico } from './api.servico';
import { CacheServico } from './cache.servico';
import { HistoricoStore } from './historico.store';

/** Chaves do `localStorage`: loteria escolhida e as últimas definições conhecidas (para abrir offline na loteria escolhida). */
export const CHAVE_LOTERIA_ATIVA = 'sorteios.loteria-ativa';
export const CHAVE_LOTERIAS_CONHECIDAS = 'sorteios.loterias';

/** Loteria usada quando nada foi escolhido (ou a escolhida deixou de existir). */
const LOTERIA_PADRAO = MEGA_SENA.id;

/** Tudo o que o store guarda de uma loteria; a troca de loteria só muda qual entrada está visível. */
interface EstadoLoteria {
  historico?: Historico;
  /** ETag vigente (do cache ou da última resposta da rede). */
  etag?: string;
  atualizadoEm?: string;
  somenteCache: boolean;
  erro?: string;
  carregando: boolean;
}

const ESTADO_VAZIO: EstadoLoteria = { somenteCache: false, carregando: false };

function lerArmazenamento(chave: string): string | undefined {
  try {
    return globalThis.localStorage?.getItem(chave) ?? undefined;
  } catch {
    return undefined; // armazenamento bloqueado (modo privado, política do navegador)
  }
}

function gravarArmazenamento(chave: string, valor: string): void {
  try {
    globalThis.localStorage?.setItem(chave, valor);
  } catch {
    // sem persistência: a escolha vale só para esta sessão
  }
}

/** Garante a loteria no registro do core (idempotente) e valida a definição; lança se for inválida. */
function registrar(def: LoteriaDefinicao): void {
  if (listarLoterias().some((l) => l.id === def.id)) validarDefinicao(def);
  else registrarLoteria(def);
}

/** Histórico com as dezenas de cada concurso na ordem do volante (o 00 da Lotomania por último), vindo da rede ou do cache. */
function montarHistorico(def: LoteriaDefinicao, concursos: Concurso[]): Historico {
  const comparar = compararDezenas(def);
  return { loteria: def, concursos: concursos.map((c) => ({ ...c, dezenas: [...c.dezenas].sort(comparar) })) };
}

/** Lê as definições conhecidas de uma sessão anterior; descarta as inválidas. Sempre devolve ao menos a Mega-Sena. */
function lerLoteriasConhecidas(): LoteriaDefinicao[] {
  const bruto = lerArmazenamento(CHAVE_LOTERIAS_CONHECIDAS);
  const validas: LoteriaDefinicao[] = [];
  if (bruto) {
    try {
      const lista: unknown = JSON.parse(bruto);
      if (Array.isArray(lista)) {
        for (const def of lista as LoteriaDefinicao[]) {
          try {
            registrar(def);
            validas.push(def);
          } catch {
            // definição inválida ou de formato antigo: ignora
          }
        }
      }
    } catch {
      // JSON corrompido: ignora
    }
  }
  if (validas.length === 0) {
    registrarMegaSena();
    return [MEGA_SENA];
  }
  return validas;
}

/**
 * Implementação de `HistoricoStore`: lista de loterias da API, cache em IndexedDB primeiro e revalidação na API em
 * seguida (stale-while-revalidate com ETag), tudo por loteria. Falha de rede nunca apaga o que já está na tela.
 */
@Injectable()
export class HistoricoStoreImpl extends HistoricoStore {
  private readonly _api = inject(ApiServico);
  private readonly _cache = inject(CacheServico);

  private readonly _loterias = signal<LoteriaDefinicao[]>(lerLoteriasConhecidas());
  private readonly _loteriaId = signal(lerArmazenamento(CHAVE_LOTERIA_ATIVA) ?? LOTERIA_PADRAO);
  private readonly _estados = signal<Readonly<Record<string, EstadoLoteria>>>({});

  /** Leituras em andamento, por id da loteria preferida no momento da chamada. */
  private readonly _emAndamento = new Map<string, Promise<void>>();
  private _leituraDaLista: Promise<void> | undefined;

  readonly loterias = this._loterias.asReadonly();
  readonly loteria = computed(() => {
    const lista = this._loterias();
    return lista.find((l) => l.id === this._loteriaId()) ?? lista.find((l) => l.id === LOTERIA_PADRAO) ?? lista[0];
  });

  private readonly _estadoAtivo = computed(() => this._estados()[this.loteria().id] ?? ESTADO_VAZIO);

  readonly historico = computed(() => this._estadoAtivo().historico);
  readonly ultimo = computed(() => {
    const concursos = this.historico()?.concursos;
    return concursos && concursos.length > 0 ? concursos[concursos.length - 1] : undefined;
  });
  readonly carregando = computed(() => this._estadoAtivo().carregando);
  readonly erro = computed(() => this._estadoAtivo().erro);
  readonly atualizadoEm = computed(() => this._estadoAtivo().atualizadoEm);
  readonly somenteCache = computed(() => this._estadoAtivo().somenteCache);

  selecionarLoteria(id: string): Promise<void> {
    if (!this._loterias().some((l) => l.id === id) || id === this.loteria().id) return Promise.resolve();
    this._loteriaId.set(id);
    gravarArmazenamento(CHAVE_LOTERIA_ATIVA, id);
    return this.carregar();
  }

  override aguardarLoterias(): Promise<void> {
    return this._carregarLoterias(false);
  }

  carregar(): Promise<void> {
    const chave = this._loteriaId();
    return this._emAndamento.get(chave) ?? this._iniciar(chave, false);
  }

  async atualizar(): Promise<void> {
    const chave = this._loteriaId();
    // Espera uma leitura em curso terminar para não sobrepor publicações.
    const atual = this._emAndamento.get(chave);
    if (atual) await atual.catch(() => undefined);
    return this._iniciar(chave, true);
  }

  private _iniciar(chave: string, ignorarEtag: boolean): Promise<void> {
    const promessa: Promise<void> = this._executar(chave, ignorarEtag).finally(() => {
      if (this._emAndamento.get(chave) === promessa) this._emAndamento.delete(chave);
    });
    this._emAndamento.set(chave, promessa);
    return promessa;
  }

  private async _executar(preferida: string, ignorarEtag: boolean): Promise<void> {
    // A lista de loterias só bloqueia a leitura quando a loteria escolhida ainda é desconhecida (escolha persistida
    // de uma loteria cuja definição esta máquina nunca viu); nos demais casos ela chega em segundo plano.
    const lista = this._carregarLoterias(ignorarEtag);
    if (!this._loterias().some((l) => l.id === preferida)) await lista;

    const def = this._loterias().find((l) => l.id === preferida) ?? this.loteria();
    this._atualizarEstado(def.id, { carregando: true });
    try {
      if (!this._estados()[def.id]?.historico) await this._lerCache(def);
      await this._revalidar(def, ignorarEtag ? undefined : this._estados()[def.id]?.etag);
    } finally {
      this._atualizarEstado(def.id, { carregando: false });
    }
  }

  /** Busca as definições na API (uma vez por sessão; `forcar` repete). Nunca rejeita: sem rede vale o que já se conhece. */
  private _carregarLoterias(forcar: boolean): Promise<void> {
    if (forcar || !this._leituraDaLista) {
      this._leituraDaLista = new Promise<LoteriaDefinicao[]>((resolver) => resolver(this._api.loterias()))
        .then((definicoes) => this._aplicarLoterias(definicoes))
        .catch(() => {
          this._leituraDaLista = undefined; // permite nova tentativa na próxima leitura
        });
    }
    return this._leituraDaLista;
  }

  private _aplicarLoterias(definicoes: LoteriaDefinicao[]): void {
    const validas: LoteriaDefinicao[] = [];
    for (const def of definicoes) {
      try {
        registrar(def);
        validas.push(def);
      } catch {
        // a API trouxe uma definição inválida: a loteria simplesmente não aparece
      }
    }
    if (validas.length === 0) return;
    this._loterias.set(validas);
    gravarArmazenamento(CHAVE_LOTERIAS_CONHECIDAS, JSON.stringify(validas));
  }

  private async _lerCache(def: LoteriaDefinicao): Promise<void> {
    const emCache = await this._cache.lerHistorico(def.id);
    if (!emCache || emCache.concursos.length === 0) return;
    this._atualizarEstado(def.id, {
      etag: emCache.etag,
      historico: montarHistorico(def, emCache.concursos),
      atualizadoEm: emCache.atualizadoEm,
      somenteCache: true,
    });
  }

  private async _revalidar(def: LoteriaDefinicao, etag: string | undefined): Promise<void> {
    try {
      const resposta = await this._api.historico(def.id, etag);
      const agora = new Date().toISOString();
      if (resposta.status === 'ok') {
        this._atualizarEstado(def.id, { etag: resposta.etag, historico: montarHistorico(def, resposta.concursos) });
        await this._cache.gravarHistorico(def.id, resposta.etag, agora, resposta.concursos);
      }
      this._atualizarEstado(def.id, { atualizadoEm: agora, somenteCache: false, erro: undefined });
    } catch (erro) {
      this._atualizarEstado(def.id, {
        erro: erro instanceof Error ? erro.message : 'Falha ao atualizar o histórico',
      });
    }
  }

  private _atualizarEstado(id: string, parcial: Partial<EstadoLoteria>): void {
    this._estados.update((estados) => ({ ...estados, [id]: { ...(estados[id] ?? ESTADO_VAZIO), ...parcial } }));
  }
}
