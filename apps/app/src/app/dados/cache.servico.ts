import { Injectable } from '@angular/core';
import type { Concurso, Premiacao } from '@sorteios/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  NOME_BANCO_CACHE,
  STORE_HISTORICO,
  STORE_JOGOS_SALVOS,
  type JogoSalvo,
} from './historico.store';

/** Histórico em cache, já com `bigint` restaurado. */
export interface HistoricoEmCache {
  loteriaId: string;
  etag: string | undefined;
  /** ISO datetime da última gravação bem-sucedida vinda da rede. */
  atualizadoEm: string;
  concursos: Concurso[];
}

/*
 * Serialização: valores em centavos (`bigint`) são gravados como string decimal. O IndexedDB
 * clona `bigint` nativamente, mas string é portável (inspeção em DevTools, exportação, navegadores
 * sem suporte completo) e não depende do clone estruturado.
 */
type PremiacaoSerializada = Omit<Premiacao, 'rateioCentavos'> & { rateioCentavos: string };
type ConcursoSerializado = Omit<
  Concurso,
  | 'premiacoes'
  | 'valorAcumuladoCentavos'
  | 'estimativaProximoCentavos'
  | 'arrecadacaoCentavos'
  | 'acumuladoEspecialCentavos'
> & {
  premiacoes: PremiacaoSerializada[];
  valorAcumuladoCentavos: string;
  estimativaProximoCentavos: string;
  arrecadacaoCentavos: string;
  acumuladoEspecialCentavos: string;
};

interface HistoricoSerializado {
  loteriaId: string;
  etag: string | undefined;
  atualizadoEm: string;
  concursos: ConcursoSerializado[];
}

interface EsquemaCache extends DBSchema {
  historico: { key: string; value: HistoricoSerializado };
  'jogos-salvos': {
    key: string;
    value: JogoSalvo;
    indexes: { loteriaId: string };
  };
}

function serializarConcurso(c: Concurso): ConcursoSerializado {
  return {
    ...c,
    premiacoes: c.premiacoes.map((p) => ({ ...p, rateioCentavos: p.rateioCentavos.toString() })),
    valorAcumuladoCentavos: c.valorAcumuladoCentavos.toString(),
    estimativaProximoCentavos: c.estimativaProximoCentavos.toString(),
    arrecadacaoCentavos: c.arrecadacaoCentavos.toString(),
    acumuladoEspecialCentavos: c.acumuladoEspecialCentavos.toString(),
  };
}

function desserializarConcurso(c: ConcursoSerializado): Concurso {
  return {
    ...c,
    premiacoes: c.premiacoes.map((p) => ({ ...p, rateioCentavos: BigInt(p.rateioCentavos) })),
    valorAcumuladoCentavos: BigInt(c.valorAcumuladoCentavos),
    estimativaProximoCentavos: BigInt(c.estimativaProximoCentavos),
    arrecadacaoCentavos: BigInt(c.arrecadacaoCentavos),
    acumuladoEspecialCentavos: BigInt(c.acumuladoEspecialCentavos),
  };
}

/**
 * Cache local em IndexedDB (histórico por loteria e jogos salvos).
 * Nenhuma operação lança: se o IndexedDB estiver indisponível (modo privado, testes em jsdom)
 * ou falhar, devolve `undefined`/vazio e o app segue funcionando só com a rede.
 */
@Injectable({ providedIn: 'root' })
export class CacheServico {
  private _banco: Promise<IDBPDatabase<EsquemaCache> | undefined> | undefined;

  /** Abre (ou reaproveita) o banco; `undefined` quando o IndexedDB não está disponível. */
  abrir(): Promise<IDBPDatabase<EsquemaCache> | undefined> {
    this._banco ??= this._abrirBanco();
    return this._banco;
  }

  async lerHistorico(loteriaId: string): Promise<HistoricoEmCache | undefined> {
    try {
      const banco = await this.abrir();
      const registro = await banco?.get(STORE_HISTORICO, loteriaId);
      if (!registro) return undefined;
      return {
        loteriaId: registro.loteriaId,
        etag: registro.etag,
        atualizadoEm: registro.atualizadoEm,
        concursos: registro.concursos.map(desserializarConcurso),
      };
    } catch {
      return undefined;
    }
  }

  async gravarHistorico(
    loteriaId: string,
    etag: string | undefined,
    atualizadoEm: string,
    concursos: Concurso[],
  ): Promise<void> {
    try {
      const banco = await this.abrir();
      await banco?.put(STORE_HISTORICO, {
        loteriaId,
        etag,
        atualizadoEm,
        concursos: concursos.map(serializarConcurso),
      });
    } catch {
      // Cache é otimização: falha de gravação não pode derrubar o app.
    }
  }

  async listarJogos(loteriaId: string): Promise<JogoSalvo[]> {
    try {
      const banco = await this.abrir();
      return (await banco?.getAllFromIndex(STORE_JOGOS_SALVOS, 'loteriaId', loteriaId)) ?? [];
    } catch {
      return [];
    }
  }

  /** Jogos salvos de todas as loterias. */
  async listarTodosJogos(): Promise<JogoSalvo[]> {
    try {
      const banco = await this.abrir();
      return (await banco?.getAll(STORE_JOGOS_SALVOS)) ?? [];
    } catch {
      return [];
    }
  }

  async gravarJogos(jogos: JogoSalvo[]): Promise<void> {
    if (jogos.length === 0) return;
    try {
      const banco = await this.abrir();
      if (!banco) return;
      const transacao = banco.transaction(STORE_JOGOS_SALVOS, 'readwrite');
      await Promise.all([...jogos.map((j) => transacao.store.put(j)), transacao.done]);
    } catch {
      // Ver comentário em `gravarHistorico`.
    }
  }

  async removerJogo(id: string): Promise<void> {
    try {
      const banco = await this.abrir();
      await banco?.delete(STORE_JOGOS_SALVOS, id);
    } catch {
      // Ver comentário em `gravarHistorico`.
    }
  }

  private async _abrirBanco(): Promise<IDBPDatabase<EsquemaCache> | undefined> {
    try {
      if (typeof indexedDB === 'undefined') return undefined;
      return await openDB<EsquemaCache>(NOME_BANCO_CACHE, 1, {
        upgrade(banco) {
          banco.createObjectStore(STORE_HISTORICO, { keyPath: 'loteriaId' });
          const jogos = banco.createObjectStore(STORE_JOGOS_SALVOS, { keyPath: 'id' });
          jogos.createIndex('loteriaId', 'loteriaId');
        },
      });
    } catch {
      return undefined;
    }
  }
}
