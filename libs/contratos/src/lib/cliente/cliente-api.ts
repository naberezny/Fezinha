/**
 * Cliente HTTP fino e tipado da API. Sem dependência de Angular nem de Nest: só `fetch`.
 * Os tipos vêm de `tipos-api.ts`, gerado do OpenAPI por `pnpm gerar:cliente`; se um DTO mudar
 * sem regenerar, o `tsc` (e o teste de verificação de contrato) falha.
 */
import type { components } from './tipos-api';

type Esquemas = components['schemas'];

export type LoteriaApi = Esquemas['LoteriaDto'];
export type PaginaResultadosApi = Esquemas['PaginaResultadosDto'];
export type ResultadoApi = Esquemas['ResultadoDto'];
export type EstatisticasApi = Esquemas['EstatisticasDto'];
export type HistoricoApi = Esquemas['HistoricoDto'];
export type SaudeApi = Esquemas['SaudeDto'];
export type SincronizacaoApi = Esquemas['SincronizacaoDto'];
export type ResultadoSincronizacaoApi = Esquemas['ResultadoSincronizacaoDto'];

export interface OpcoesClienteApi {
  /** Implementação de fetch (padrão: o global). Útil em testes e em SSR. */
  fetch?: typeof fetch;
}

/** Resposta de `historico`: 304 quando a ETag enviada ainda vale. */
export type RespostaHistorico =
  | { naoModificado: true; etag: string | null }
  | { naoModificado: false; etag: string | null; dados: HistoricoApi };

/** Erro HTTP devolvido pela API (status e mensagem do corpo, quando houver). */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

export function criarClienteApi(
  baseUrl: string,
  opcoes: OpcoesClienteApi = {},
) {
  const base = baseUrl.replace(/\/+$/, '');

  async function requisitar(
    caminho: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const executar = opcoes.fetch ?? fetch;
    const resposta = await executar(`${base}${caminho}`, init);
    if (!resposta.ok && resposta.status !== 304) {
      let mensagem = `${resposta.status} ${resposta.statusText}`.trim();
      try {
        const corpo = (await resposta.json()) as {
          message?: string | string[];
        };
        if (corpo.message)
          mensagem = Array.isArray(corpo.message)
            ? corpo.message.join('; ')
            : corpo.message;
      } catch {
        // corpo sem JSON: mantém a mensagem de status
      }
      throw new ErroApi(resposta.status, mensagem);
    }
    return resposta;
  }

  async function obterJson<T>(caminho: string, init?: RequestInit): Promise<T> {
    return (await (await requisitar(caminho, init)).json()) as T;
  }

  function consulta(
    parametros: Record<string, string | number | undefined>,
  ): string {
    const busca = new URLSearchParams();
    for (const [chave, valor] of Object.entries(parametros)) {
      if (valor !== undefined) busca.set(chave, String(valor));
    }
    const texto = busca.toString();
    return texto ? `?${texto}` : '';
  }

  const rota = (loteriaId: string) =>
    `/loterias/${encodeURIComponent(loteriaId)}`;

  return {
    saude: () => obterJson<SaudeApi>('/saude'),
    listarLoterias: () => obterJson<LoteriaApi[]>('/loterias'),
    resultados: (
      loteriaId: string,
      filtro: { limite?: number; pagina?: number } = {},
    ) =>
      obterJson<PaginaResultadosApi>(
        `${rota(loteriaId)}/resultados${consulta(filtro)}`,
      ),
    resultado: (loteriaId: string, numero: number) =>
      obterJson<ResultadoApi>(`${rota(loteriaId)}/resultados/${numero}`),
    /** `periodo`: `ultimos:50`, `ultimos:100`, `ano:2026` ou `tudo`. */
    estatisticas: (loteriaId: string, periodo?: string) =>
      obterJson<EstatisticasApi>(
        `${rota(loteriaId)}/estatisticas${consulta({ periodo })}`,
      ),
    /** Passe a ETag guardada para receber `naoModificado: true` quando nada mudou. */
    historico: async (
      loteriaId: string,
      etagAnterior?: string | null,
    ): Promise<RespostaHistorico> => {
      const resposta = await requisitar(`${rota(loteriaId)}/historico`, {
        headers: etagAnterior ? { 'If-None-Match': etagAnterior } : {},
      });
      const etag = resposta.headers.get('ETag');
      if (resposta.status === 304)
        return { naoModificado: true, etag: etag ?? etagAnterior ?? null };
      return {
        naoModificado: false,
        etag,
        dados: (await resposta.json()) as HistoricoApi,
      };
    },
    sincronizacao: (loteriaId: string) =>
      obterJson<SincronizacaoApi>(`${rota(loteriaId)}/sincronizacao`),
    /** Exige a chave de administrador (`X-Chave-Admin`). `de` e `ate` reimportam um intervalo de concursos. */
    sincronizar: (
      loteriaId: string,
      chaveAdmin: string,
      intervalo: { de?: number; ate?: number } = {},
    ) =>
      obterJson<ResultadoSincronizacaoApi>(
        `${rota(loteriaId)}/sincronizar${consulta(intervalo)}`,
        {
          method: 'POST',
          headers: { 'X-Chave-Admin': chaveAdmin },
        },
      ),
  };
}

export type ClienteApi = ReturnType<typeof criarClienteApi>;
