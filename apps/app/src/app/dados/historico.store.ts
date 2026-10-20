import type { Signal } from '@angular/core';
import type { Concurso, Historico, LoteriaDefinicao } from '@sorteios/core';

/**
 * Contrato da camada de dados do app (implementado em `historico.store.impl.ts`, fornecido no `app.config.ts`).
 *
 * Fontes: `GET /loterias` (definições das loterias disponíveis) e `GET /loterias/:id/historico` (todos os
 * concursos, completos) com cache em IndexedDB. Estratégia: abre com o cache, revalida em segundo plano;
 * a geração de jogos e todas as estatísticas são calculadas no cliente com `@sorteios/core`, então o app
 * funciona offline.
 *
 * Há uma loteria ativa (escolha persistida no aparelho). `historico`, `ultimo`, `carregando`, `erro`,
 * `atualizadoEm`, `somenteCache`, `carregar()` e `atualizar()` sempre se referem a ela; o histórico já carregado
 * de cada loteria fica em memória, então voltar a uma loteria já vista é instantâneo.
 *
 * As páginas injetam esta classe abstrata; nos testes usam um fake que estende `HistoricoStore`.
 */
export abstract class HistoricoStore {
  /** Loterias disponíveis (da API; sem rede, as últimas conhecidas, no mínimo a Mega-Sena). Nunca vazio. */
  abstract readonly loterias: Signal<LoteriaDefinicao[]>;
  /** Loteria ativa (padrão: Mega-Sena). */
  abstract readonly loteria: Signal<LoteriaDefinicao>;
  /** Histórico completo da loteria ativa, crescente por número; `undefined` enquanto não há cache nem rede. */
  abstract readonly historico: Signal<Historico | undefined>;
  /** Último concurso do histórico (ou `undefined`). */
  abstract readonly ultimo: Signal<Concurso | undefined>;
  /** Verdadeiro enquanto uma leitura (cache ou rede) da loteria ativa está em andamento. */
  abstract readonly carregando: Signal<boolean>;
  /** Mensagem amigável do último erro de rede da loteria ativa; `undefined` quando ok. Nunca apaga o cache. */
  abstract readonly erro: Signal<string | undefined>;
  /** ISO datetime da última atualização bem-sucedida vinda da rede (loteria ativa). */
  abstract readonly atualizadoEm: Signal<string | undefined>;
  /** Verdadeiro quando os dados exibidos vieram só do cache (sem confirmação da rede nesta sessão). */
  abstract readonly somenteCache: Signal<boolean>;

  /**
   * Troca a loteria ativa (persistida em `localStorage`) e carrega o histórico dela. Id desconhecido é ignorado.
   * A troca é síncrona: se a loteria já foi carregada, `historico()` já mostra os dados dela na volta.
   */
  abstract selecionarLoteria(id: string): Promise<void>;
  /**
   * Espera a lista de loterias da API (uma leitura por sessão; nunca rejeita). Serve às rotas `/:loteria/...`: um id
   * ainda desconhecido (link direto numa loteria que este aparelho nunca viu) só pode ser julgado inválido depois dela.
   * O padrão resolve na hora, para fakes e stores que já conhecem a lista toda.
   */
  aguardarLoterias(): Promise<void> {
    return Promise.resolve();
  }
  /** Carrega: cache primeiro (se houver), depois revalida na rede. Idempotente; chamadas concorrentes compartilham a mesma promessa. */
  abstract carregar(): Promise<void>;
  /** Força nova leitura da rede ignorando o ETag. */
  abstract atualizar(): Promise<void>;
}

/** Nome do banco IndexedDB e da store, compartilhados por implementação e testes. */
export const NOME_BANCO_CACHE = 'sorteios-cache';
export const STORE_HISTORICO = 'historico';
export const STORE_JOGOS_SALVOS = 'jogos-salvos';

/**
 * Jogo salvo pelo usuário em "Meus jogos" (IndexedDB, store `jogos-salvos`, chave `id`, índice `loteriaId`).
 * É conferido com o concurso `concursoBase + 1` (`concursoAlvo` do core) assim que ele estiver no histórico.
 */
export interface JogoSalvo {
  id: string;
  loteriaId: string;
  /** Dezenas na ordem do volante. */
  dezenas: number[];
  /** Modo de geração (`Estrategia` do core). */
  estrategia: string;
  /** ISO datetime do salvamento. */
  criadoEm: string;
  /** Último concurso do histórico no momento da geração. */
  concursoBase: number;
}

/** Contrato do repositório local de jogos salvos (IndexedDB), sem cadastro: os jogos ficam só neste navegador. */
export abstract class JogosSalvosStore {
  /** Jogos de todas as loterias, mais recentes primeiro. */
  abstract readonly jogos: Signal<JogoSalvo[]>;
  /** Lê os jogos salvos neste navegador. */
  abstract carregar(): Promise<void>;
  abstract salvar(jogos: Omit<JogoSalvo, 'id' | 'criadoEm'>[]): Promise<void>;
  abstract remover(id: string): Promise<void>;
}
