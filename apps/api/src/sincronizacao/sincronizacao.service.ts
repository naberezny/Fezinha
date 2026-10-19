import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import type {
  ResultadoSincronizacaoDto,
  SincronizacaoDto,
} from '@sorteios/contratos';
import type { Concurso } from '@sorteios/core';
import {
  ConcursosRepositorio,
  type ResultadoUpsert,
} from '../loterias/concursos.repositorio';
import { LoteriasService } from '../loterias/loterias.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaixaCliente } from './caixa.cliente';
import {
  CONFIG_SINCRONIZACAO,
  pausar,
  type ConfiguracaoSincronizacao,
} from './configuracao';
import { mapeadoresPorLoteria, type MapeadorCaixa } from './mapeadores';
import { estaVencida, instanteDoSorteio } from './vencimento';

export interface OpcoesSincronizacao {
  /** Ignora a regra de "vencida" (usado pelo `POST /sincronizar`). */
  forcar?: boolean;
  /** Primeiro concurso do intervalo a reimportar (força a busca de cada número, sem consultar o "último"). */
  de?: number;
  /** Último concurso do intervalo; sozinho equivale a `de = ate`. */
  ate?: number;
}

/** Teto de concursos por reimportação manual (a Caixa é consultada um a um). */
export const LIMITE_INTERVALO = 500;
const LIMITE_MENSAGEM_ERRO = 500;

/** Campos de `Sincronizacao` que esta classe grava. */
interface DadosEstado {
  ultimaEm?: string | null;
  ultimoConcurso?: number | null;
  proximoSorteioEm?: string | null;
  ultimoErro?: string | null;
  emAndamento?: boolean;
}

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/**
 * Sincronização lazy com a Caixa (seção 5.3 da especificação): quando uma leitura encontra a
 * `Sincronizacao` vencida, busca os concursos que faltam e grava. Falha da Caixa nunca derruba a leitura.
 */
@Injectable()
export class SincronizacaoService implements OnModuleInit {
  private readonly logger = new Logger(SincronizacaoService.name);
  /** Lock em memória por loteria: chamadas concorrentes aguardam a mesma promessa. */
  private readonly emVoo = new Map<
    string,
    Promise<ResultadoSincronizacaoDto>
  >();
  private readonly ultimaFalhaEm = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly repositorio: ConcursosRepositorio,
    private readonly loterias: LoteriasService,
    private readonly caixa: CaixaCliente,
    @Inject(CONFIG_SINCRONIZACAO)
    private readonly ajustes: ConfiguracaoSincronizacao,
  ) {}

  /** `emAndamento` é só informativo: um processo que morreu no meio não pode deixá-lo preso em `true`. */
  async onModuleInit(): Promise<void> {
    await this.prisma.sincronizacao.updateMany({
      where: { emAndamento: true },
      data: { emAndamento: false },
    });
  }

  /** Estado atual da sincronização (todos os campos nulos se nunca houve). 404 se a loteria é desconhecida. */
  async estado(loteriaId: string): Promise<SincronizacaoDto> {
    this.loterias.definicao(loteriaId);
    const linha = await this.prisma.sincronizacao.findUnique({
      where: { loteriaId },
    });
    return {
      loteriaId,
      ultimaEm: linha?.ultimaEm ?? null,
      ultimoConcurso: linha?.ultimoConcurso ?? null,
      proximoSorteioEm: linha?.proximoSorteioEm ?? null,
      ultimoErro: linha?.ultimoErro ?? null,
      emAndamento: linha?.emAndamento ?? false,
    };
  }

  /**
   * Passos 1 a 7 da seção 5.3. Não lança por falha da Caixa (grava `ultimoErro` e a leitura segue com o banco);
   * só lança 404 para loteria desconhecida.
   */
  async garantirAtualizado(loteriaId: string): Promise<void> {
    this.loterias.definicao(loteriaId);

    const emVoo = this.emVoo.get(loteriaId);
    if (emVoo) {
      await emVoo.catch(() => undefined);
      return;
    }
    const falhouEm = this.ultimaFalhaEm.get(loteriaId);
    if (
      falhouEm !== undefined &&
      Date.now() - falhouEm < this.ajustes.esperaAposErroMs
    ) {
      return;
    }

    try {
      await this.iniciar(loteriaId, () => this.sincronizarSeVencida(loteriaId));
    } catch (erro) {
      this.logger.warn(
        `Sincronização de '${loteriaId}' falhou; a resposta usa o banco: ${mensagemDe(erro)}`,
      );
    }
  }

  /**
   * Sincronização sob demanda. Com `forcar` (ou `de`/`ate`) ignora a regra de "vencida".
   * Falha da Caixa vira 502 com a mensagem; parâmetros inválidos, 400; loteria desconhecida, 404.
   */
  async sincronizar(
    loteriaId: string,
    opcoes: OpcoesSincronizacao = {},
  ): Promise<ResultadoSincronizacaoDto> {
    this.loterias.definicao(loteriaId);
    const intervalo = this.intervaloDe(opcoes);

    // Uma sincronização por loteria: espera a que estiver em voo e só então começa a sua.
    for (
      let emVoo = this.emVoo.get(loteriaId);
      emVoo;
      emVoo = this.emVoo.get(loteriaId)
    ) {
      await emVoo.catch(() => undefined);
    }

    try {
      return await this.iniciar(loteriaId, () =>
        opcoes.forcar || intervalo
          ? this.executar(loteriaId, intervalo)
          : this.sincronizarSeVencida(loteriaId),
      );
    } catch (erro) {
      if (erro instanceof HttpException) throw erro;
      throw new BadGatewayException(
        `Falha ao sincronizar com a Caixa: ${mensagemDe(erro)}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Lock
  // -------------------------------------------------------------------------

  /** Registra a tarefa como a sincronização em voo da loteria e a libera ao terminar (inclusive em erro). */
  private iniciar(
    loteriaId: string,
    tarefa: () => Promise<ResultadoSincronizacaoDto>,
  ): Promise<ResultadoSincronizacaoDto> {
    const promessa: Promise<ResultadoSincronizacaoDto> = tarefa().finally(
      () => {
        if (this.emVoo.get(loteriaId) === promessa) {
          this.emVoo.delete(loteriaId);
        }
      },
    );
    this.emVoo.set(loteriaId, promessa);
    return promessa;
  }

  // -------------------------------------------------------------------------
  // Execução
  // -------------------------------------------------------------------------

  /** Relê o estado já dentro do lock: quem chegou depois de uma sincronização concluída não repete a consulta. */
  private async sincronizarSeVencida(
    loteriaId: string,
  ): Promise<ResultadoSincronizacaoDto> {
    const estado = await this.estado(loteriaId);
    if (!estaVencida(estado, new Date())) {
      return {
        novos: 0,
        atualizados: 0,
        inalterados: 0,
        ultimoConcurso: estado.ultimoConcurso,
      };
    }
    return this.executar(loteriaId);
  }

  private async executar(
    loteriaId: string,
    intervalo?: { de: number; ate: number },
  ): Promise<ResultadoSincronizacaoDto> {
    const resultado: ResultadoSincronizacaoDto = {
      novos: 0,
      atualizados: 0,
      inalterados: 0,
      ultimoConcurso: null,
    };
    try {
      const mapear = mapeadoresPorLoteria[loteriaId];
      if (!mapear) {
        throw new Error(
          `Não há mapeador da resposta da Caixa para a loteria '${loteriaId}'`,
        );
      }
      await this.gravarEstado(loteriaId, { emAndamento: true });

      const marcas = intervalo
        ? await this.reimportar(loteriaId, mapear, intervalo, resultado)
        : await this.buscarNovos(loteriaId, mapear, resultado);

      await this.gravarEstado(loteriaId, {
        ...marcas,
        ultimoErro: null,
        emAndamento: false,
      });
      this.ultimaFalhaEm.delete(loteriaId);
      return resultado;
    } catch (erro) {
      this.ultimaFalhaEm.set(loteriaId, Date.now());
      const mensagem = mensagemDe(erro).slice(0, LIMITE_MENSAGEM_ERRO);
      this.logger.warn(`Sincronização de '${loteriaId}': ${mensagem}`);
      await this.gravarEstado(loteriaId, {
        ultimoErro: mensagem,
        emAndamento: false,
      }).catch((falhaAoGravar) =>
        this.logger.error(
          `Não foi possível gravar o erro da sincronização: ${mensagemDe(falhaAoGravar)}`,
        ),
      );
      throw erro;
    } finally {
      // Gravação parcial (erro no meio do caminho) também invalida o cache do histórico.
      if (resultado.novos + resultado.atualizados > 0) {
        this.loterias.invalidar(loteriaId);
      }
    }
  }

  /** Passos 4 e 5: último da Caixa e, se há novos, cada faltante em ordem, com pausa entre as chamadas. */
  private async buscarNovos(
    loteriaId: string,
    mapear: MapeadorCaixa,
    resultado: ResultadoSincronizacaoDto,
  ): Promise<DadosEstado> {
    const ultimo = mapear(await this.caixa.ultimo(loteriaId));
    const gravado = await this.repositorio.ultimoNumero(loteriaId);

    // Banco vazio: grava só o último (o histórico vem da carga histórica, não de milhares de chamadas).
    const primeiro = (gravado ?? ultimo.numero - 1) + 1;
    for (let numero = primeiro; numero <= ultimo.numero; numero++) {
      await pausar(this.ajustes.pausaEntreConcursosMs);
      await this.gravarConcurso(loteriaId, mapear, numero, resultado);
    }

    const ultimoConcurso = Math.max(ultimo.numero, gravado ?? 0);
    resultado.ultimoConcurso = ultimoConcurso;
    return {
      ultimaEm: new Date().toISOString(),
      ultimoConcurso,
      proximoSorteioEm: this.proximoSorteioDe(ultimo),
    };
  }

  /** `de`/`ate`: busca e regrava cada número do intervalo (as marcas de "última sincronização" não mudam). */
  private async reimportar(
    loteriaId: string,
    mapear: MapeadorCaixa,
    { de, ate }: { de: number; ate: number },
    resultado: ResultadoSincronizacaoDto,
  ): Promise<DadosEstado> {
    for (let numero = de; numero <= ate; numero++) {
      if (numero > de) await pausar(this.ajustes.pausaEntreConcursosMs);
      await this.gravarConcurso(loteriaId, mapear, numero, resultado);
    }
    resultado.ultimoConcurso = await this.repositorio.ultimoNumero(loteriaId);
    return {};
  }

  private async gravarConcurso(
    loteriaId: string,
    mapear: MapeadorCaixa,
    numero: number,
    resultado: ResultadoSincronizacaoDto,
  ): Promise<void> {
    const concurso = mapear(await this.caixa.concurso(loteriaId, numero));
    if (concurso.numero !== numero) {
      throw new Error(
        `A Caixa devolveu o concurso ${concurso.numero} ao pedir o ${numero}`,
      );
    }
    const situacao: ResultadoUpsert = await this.repositorio.upsertConcurso(
      loteriaId,
      concurso,
      'caixa',
    );
    if (situacao === 'novo') resultado.novos++;
    else if (situacao === 'atualizado') resultado.atualizados++;
    else resultado.inalterados++;
  }

  // -------------------------------------------------------------------------
  // Auxiliares
  // -------------------------------------------------------------------------

  private proximoSorteioDe(ultimo: Concurso): string | null {
    return ultimo.dataProximoSorteio
      ? instanteDoSorteio(ultimo.dataProximoSorteio)
      : null;
  }

  private intervaloDe({
    de,
    ate,
  }: OpcoesSincronizacao): { de: number; ate: number } | undefined {
    if (de === undefined && ate === undefined) return undefined;
    const inicio = de ?? ate;
    const fim = ate ?? de;
    if (
      inicio === undefined ||
      fim === undefined ||
      !Number.isInteger(inicio) ||
      !Number.isInteger(fim) ||
      inicio < 1
    ) {
      throw new BadRequestException(
        'de e ate devem ser números inteiros positivos',
      );
    }
    if (inicio > fim) {
      throw new BadRequestException('de não pode ser maior que ate');
    }
    if (fim - inicio + 1 > LIMITE_INTERVALO) {
      throw new BadRequestException(
        `O intervalo pode ter no máximo ${LIMITE_INTERVALO} concursos`,
      );
    }
    return { de: inicio, ate: fim };
  }

  private async gravarEstado(
    loteriaId: string,
    dados: DadosEstado,
  ): Promise<void> {
    await this.prisma.sincronizacao.upsert({
      where: { loteriaId },
      create: { loteriaId, ...dados },
      update: dados,
    });
  }
}
