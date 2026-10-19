import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CONFIG_SINCRONIZACAO,
  pausar,
  type ConfiguracaoSincronizacao,
} from './configuracao';

/** Base padrão da API pública (não documentada) do Portal de Loterias da Caixa. */
export const CAIXA_API_URL_PADRAO =
  'https://servicebus3.caixa.gov.br/portaldeloterias/api';

const USER_AGENT = 'Mozilla/5.0 (Sorteios)';

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/**
 * Cliente HTTP da API da Caixa. Devolve o JSON cru (`unknown`): o mapeamento para `Concurso`
 * é feito por loteria em `mapeadores.ts`. A base vem de `CAIXA_API_URL` (os testes apontam para um host mockado).
 */
@Injectable()
export class CaixaCliente {
  constructor(
    private readonly config: ConfigService,
    @Inject(CONFIG_SINCRONIZACAO)
    private readonly ajustes: ConfiguracaoSincronizacao,
  ) {}

  /** `GET {base}/{loteria}/` — último concurso sorteado. */
  ultimo(loteriaId: string): Promise<unknown> {
    return this.buscar(`${this.base()}/${encodeURIComponent(loteriaId)}/`);
  }

  /** `GET {base}/{loteria}/{numero}` — um concurso específico. */
  concurso(loteriaId: string, numero: number): Promise<unknown> {
    return this.buscar(
      `${this.base()}/${encodeURIComponent(loteriaId)}/${numero}`,
    );
  }

  private base(): string {
    const configurada = this.config.get<string>('CAIXA_API_URL');
    return (configurada || CAIXA_API_URL_PADRAO).replace(/\/+$/, '');
  }

  /** Executa a chamada com as tentativas configuradas; o erro final descreve a última falha. */
  private async buscar(url: string): Promise<unknown> {
    const { tentativas, pausaTentativasMs } = this.ajustes;
    let falha = 'falha desconhecida';
    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
      try {
        return await this.tentarUmaVez(url);
      } catch (erro) {
        falha = mensagemDe(erro);
        if (tentativa < tentativas) await pausar(pausaTentativasMs);
      }
    }
    throw new Error(
      `Falha ao consultar a Caixa (${url}) após ${tentativas} tentativa(s): ${falha}`,
    );
  }

  private async tentarUmaVez(url: string): Promise<unknown> {
    const { timeoutMs } = this.ajustes;
    const controle = new AbortController();
    const temporizador = setTimeout(() => controle.abort(), timeoutMs);
    try {
      const resposta = await fetch(url, {
        signal: controle.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (!resposta.ok) {
        throw new Error(
          `HTTP ${resposta.status}${resposta.statusText ? ` ${resposta.statusText}` : ''}`,
        );
      }
      return await resposta.json();
    } catch (erro) {
      if (controle.signal.aborted) {
        throw new Error(`tempo esgotado (${timeoutMs} ms)`);
      }
      throw erro;
    } finally {
      clearTimeout(temporizador);
    }
  }
}
