import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Concurso, FaixaPremiacao, LocalGanhador, LoteriaDefinicao, Premiacao } from '@sorteios/core';
import { firstValueFrom } from 'rxjs';
import { ambiente } from '../../ambientes/ambiente';

/** Resultado de `ApiServico.historico`. */
export type RespostaHistoricoApi =
  | { status: 'ok'; etag: string | undefined; concursos: Concurso[] }
  | { status: 'nao-modificado' };

/** Resposta de `GET /saude`. */
export interface SaudeApi {
  ok: boolean;
  versao: string;
  ultimoConcurso: number | null;
}

/** Formato do concurso na API: valores monetários em centavos como `number`. */
interface PremiacaoApi {
  faixa: number;
  ganhadores: number;
  rateioCentavos: number;
}

interface ConcursoApi {
  numero: number;
  data: string;
  dezenas: number[];
  acumulou: boolean;
  premiacoes: PremiacaoApi[];
  valorAcumuladoCentavos: number;
  estimativaProximoCentavos: number;
  arrecadacaoCentavos: number;
  acumuladoEspecialCentavos: number;
  proximoNumero?: number;
  dataProximoSorteio?: string;
  observacao?: string;
  locaisGanhadores: LocalGanhador[];
}

interface HistoricoApi {
  concursos: ConcursoApi[];
}

/** Definição da loteria como a API entrega em `GET /loterias` (mesmos campos de `LoteriaDefinicao`). */
type LoteriaApi = Partial<Record<keyof LoteriaDefinicao, unknown>>;

/** Aceita a lista pura ou embrulhada em `{ loterias: [...] }`. */
function extrairLoterias(corpo: unknown): LoteriaApi[] {
  const lista = Array.isArray(corpo) ? corpo : (corpo as { loterias?: unknown } | null)?.loterias;
  if (!Array.isArray(lista)) throw new Error('Resposta inválida do servidor');
  return lista as LoteriaApi[];
}

/** Copia só os campos conhecidos da definição (ignora extras da API). A validação fica a cargo do registro do core. */
export function converterLoteria(l: LoteriaApi): LoteriaDefinicao {
  return {
    id: l.id as string,
    nome: l.nome as string,
    cor: l.cor as string,
    universo: l.universo as number,
    primeiraDezena: l.primeiraDezena as 0 | 1,
    sorteadas: l.sorteadas as number,
    aposta: { ...(l.aposta as LoteriaDefinicao['aposta']) },
    volante: { ...(l.volante as LoteriaDefinicao['volante']) },
    quadrantes: l.quadrantes as number,
    faixas: ((l.faixas as FaixaPremiacao[] | undefined) ?? []).map((f) => ({ faixa: f.faixa, acertos: f.acertos, nome: f.nome })),
    diasSorteio: [...((l.diasSorteio as number[] | undefined) ?? [])],
    regrasDisponiveis: [...((l.regrasDisponiveis as string[] | undefined) ?? [])],
  };
}

/** Converte centavos `number` (JSON) em `bigint`, tolerando ausência. */
function paraCentavos(valor: number | null | undefined): bigint {
  return BigInt(Math.round(Number(valor ?? 0)));
}

function converterPremiacao(p: PremiacaoApi): Premiacao {
  return {
    faixa: p.faixa,
    ganhadores: p.ganhadores,
    rateioCentavos: paraCentavos(p.rateioCentavos),
  };
}

/** Converte um concurso da API para o tipo do domínio (bigint em centavos, dezenas crescentes). */
export function converterConcurso(c: ConcursoApi): Concurso {
  const concurso: Concurso = {
    numero: c.numero,
    data: c.data,
    dezenas: [...c.dezenas].sort((a, b) => a - b),
    acumulou: c.acumulou,
    premiacoes: (c.premiacoes ?? []).map(converterPremiacao),
    valorAcumuladoCentavos: paraCentavos(c.valorAcumuladoCentavos),
    estimativaProximoCentavos: paraCentavos(c.estimativaProximoCentavos),
    arrecadacaoCentavos: paraCentavos(c.arrecadacaoCentavos),
    acumuladoEspecialCentavos: paraCentavos(c.acumuladoEspecialCentavos),
    locaisGanhadores: c.locaisGanhadores ?? [],
  };
  if (c.proximoNumero != null) concurso.proximoNumero = c.proximoNumero;
  if (c.dataProximoSorteio != null) concurso.dataProximoSorteio = c.dataProximoSorteio;
  if (c.observacao != null) concurso.observacao = c.observacao;
  return concurso;
}

/** Traduz falhas HTTP em mensagens amigáveis em português. */
function mensagemDeErro(erro: unknown): string {
  if (erro instanceof HttpErrorResponse) {
    if (erro.status === 0) return 'Sem conexão com o servidor';
    if (erro.status === 404) return 'Dados não encontrados no servidor';
    if (erro.status >= 500) return 'O servidor está indisponível no momento';
    return `Falha ao consultar o servidor (HTTP ${erro.status})`;
  }
  return 'Falha inesperada ao consultar o servidor';
}

/** No modo estático (arquivos JSON publicados junto com o app) os recursos terminam em `.json`. */
function sufixoEstatico(): string {
  return ambiente.estatico ? '.json' : '';
}

/** Cliente HTTP da API de Sorteios (loterias, histórico com ETag e saúde). */
@Injectable({ providedIn: 'root' })
export class ApiServico {
  private readonly _http = inject(HttpClient);

  /**
   * `GET /loterias/:id/historico`. Com `etag`, envia `If-None-Match`; 304 vira `nao-modificado`.
   * Atenção: em chamadas entre origens a API precisa expor o cabeçalho `ETag` (CORS `Access-Control-Expose-Headers`).
   */
  async historico(loteriaId: string, etag?: string): Promise<RespostaHistoricoApi> {
    const headers: Record<string, string> = etag ? { 'If-None-Match': etag } : {};
    const url = `${ambiente.urlApi}/loterias/${encodeURIComponent(loteriaId)}/historico${sufixoEstatico()}`;
    try {
      const resposta: HttpResponse<HistoricoApi> = await firstValueFrom(
        this._http.get<HistoricoApi>(url, { headers, observe: 'response' }),
      );
      if (resposta.status === 304) return { status: 'nao-modificado' };
      const corpo = resposta.body;
      if (!corpo || !Array.isArray(corpo.concursos)) {
        throw new Error('Resposta inválida do servidor');
      }
      return {
        status: 'ok',
        etag: resposta.headers.get('ETag') ?? undefined,
        concursos: corpo.concursos.map(converterConcurso),
      };
    } catch (erro) {
      if (erro instanceof HttpErrorResponse && erro.status === 304) {
        return { status: 'nao-modificado' };
      }
      if (erro instanceof Error && !(erro instanceof HttpErrorResponse)) {
        throw erro;
      }
      throw new Error(mensagemDeErro(erro));
    }
  }

  /**
   * `GET /loterias`: definição completa de cada loteria disponível. Entradas que não são objeto são descartadas;
   * a validação semântica de cada definição acontece ao registrá-la (`registrarLoteria`).
   */
  async loterias(): Promise<LoteriaDefinicao[]> {
    try {
      const urlLista = ambiente.estatico ? `${ambiente.urlApi}/loterias/lista.json` : `${ambiente.urlApi}/loterias`;
      const corpo = await firstValueFrom(this._http.get<unknown>(urlLista));
      return extrairLoterias(corpo)
        .filter((l) => typeof l === 'object' && l !== null)
        .map(converterLoteria);
    } catch (erro) {
      if (erro instanceof Error && !(erro instanceof HttpErrorResponse)) throw erro;
      throw new Error(mensagemDeErro(erro));
    }
  }

  /** `GET /saude`. */
  async saude(): Promise<SaudeApi> {
    try {
      return await firstValueFrom(this._http.get<SaudeApi>(`${ambiente.urlApi}/saude${sufixoEstatico()}`));
    } catch (erro) {
      throw new Error(mensagemDeErro(erro));
    }
  }
}
