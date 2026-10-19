/** Token de injeção dos tempos e limites da sincronização (substituível nos testes). */
export const CONFIG_SINCRONIZACAO = Symbol('CONFIG_SINCRONIZACAO');

export interface ConfiguracaoSincronizacao {
  /** Tempo máximo de cada chamada HTTP à Caixa. */
  timeoutMs: number;
  /** Tentativas por chamada (a primeira conta). */
  tentativas: number;
  /** Pausa entre tentativas da mesma chamada. */
  pausaTentativasMs: number;
  /** Pausa entre concursos faltantes (evita martelar a API pública). */
  pausaEntreConcursosMs: number;
  /**
   * Depois de uma falha, `garantirAtualizado` não volta a consultar a Caixa por este tempo
   * (uma queda da Caixa não pode fazer toda leitura esperar o timeout). `POST /sincronizar` ignora.
   */
  esperaAposErroMs: number;
}

export const CONFIG_SINCRONIZACAO_PADRAO: ConfiguracaoSincronizacao = {
  timeoutMs: 10_000,
  tentativas: 2,
  pausaTentativasMs: 500,
  pausaEntreConcursosMs: 200,
  esperaAposErroMs: 60_000,
};

/** Dorme `ms` milissegundos; valores nulos ou negativos retornam na hora. */
export function pausar(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolver) => setTimeout(resolver, ms));
}
