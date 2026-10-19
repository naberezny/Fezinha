import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type {
  HistoricoDto,
  LoteriaDto,
  PaginaResultadosDto,
  ResultadoDto,
  SaudeDto,
} from '@sorteios/contratos';
import {
  listarLoterias,
  obterLoteria,
  type Historico,
  type LoteriaDefinicao,
} from '@sorteios/core';
import { VERSAO_API } from '../versao';
import { ConcursosRepositorio } from './concursos.repositorio';
import { paraLoteriaDto, paraResultadoDto } from './dto.mapeador';
import { registrarLoteriasSuportadas } from './loterias-suportadas';

/** Casos de uso de leitura das loterias, com cache em memória do histórico por loteria. */
@Injectable()
export class LoteriasService implements OnModuleInit {
  private readonly logger = new Logger(LoteriasService.name);
  private readonly cacheHistorico = new Map<string, Promise<Historico>>();

  constructor(private readonly repositorio: ConcursosRepositorio) {}

  /** Registra as loterias suportadas e garante a linha de cada uma no banco. */
  async onModuleInit(): Promise<void> {
    registrarLoteriasSuportadas();
    for (const def of listarLoterias()) {
      await this.repositorio.garantirLoteria(def);
    }
    this.logger.log(
      `Loterias registradas: ${listarLoterias()
        .map((l) => l.id)
        .join(', ')}`,
    );
  }

  listar(): LoteriaDto[] {
    return listarLoterias().map(paraLoteriaDto);
  }

  /** Definição da loteria ou 404. */
  definicao(loteriaId: string): LoteriaDefinicao {
    try {
      return obterLoteria(loteriaId);
    } catch {
      throw new NotFoundException(`Loteria '${loteriaId}' não encontrada`);
    }
  }

  async resultados(
    loteriaId: string,
    limite: number,
    pagina: number,
  ): Promise<PaginaResultadosDto> {
    this.definicao(loteriaId);
    const { itens, total } = await this.repositorio.listar(loteriaId, {
      limite,
      pagina,
    });
    return { itens: itens.map(paraResultadoDto), total, pagina, limite };
  }

  async resultado(loteriaId: string, numero: number): Promise<ResultadoDto> {
    this.definicao(loteriaId);
    const concurso = await this.repositorio.obter(loteriaId, numero);
    if (!concurso) {
      throw new NotFoundException(
        `Concurso ${numero} da loteria '${loteriaId}' não encontrado`,
      );
    }
    return paraResultadoDto(concurso);
  }

  /** ETag fraca do histórico: `"<ultimoNumero>-<total>"`. Barata (duas consultas agregadas). */
  async etagHistorico(loteriaId: string): Promise<string> {
    this.definicao(loteriaId);
    const [ultimo, total] = await Promise.all([
      this.repositorio.ultimoNumero(loteriaId),
      this.repositorio.total(loteriaId),
    ]);
    return `"${ultimo ?? 0}-${total}"`;
  }

  /** Histórico completo (mesmo DTO de `/resultados`), em ordem crescente, para o cliente calcular offline. */
  async historico(loteriaId: string): Promise<HistoricoDto> {
    const completo = await this.historicoCompleto(loteriaId);
    return {
      loteria: paraLoteriaDto(completo.loteria),
      concursos: completo.concursos.map(paraResultadoDto),
    };
  }

  /** Histórico completo do core, cacheado por loteria até `invalidar(loteriaId)`. */
  historicoCompleto(loteriaId: string): Promise<Historico> {
    const def = this.definicao(loteriaId);
    let carregando = this.cacheHistorico.get(loteriaId);
    if (!carregando) {
      carregando = this.repositorio
        .historico(loteriaId)
        .then((concursos) => ({ loteria: def, concursos }));
      // Falha de leitura não pode ficar presa no cache.
      carregando.catch(() => this.cacheHistorico.delete(loteriaId));
      this.cacheHistorico.set(loteriaId, carregando);
    }
    return carregando;
  }

  /** Descarta o cache da loteria. A sincronização chama depois de gravar concursos. */
  invalidar(loteriaId: string): void {
    this.cacheHistorico.delete(loteriaId);
  }

  async saude(): Promise<SaudeDto> {
    let ultimo: number | null = null;
    for (const def of listarLoterias()) {
      const numero = await this.repositorio.ultimoNumero(def.id);
      if (numero !== null && (ultimo === null || numero > ultimo))
        ultimo = numero;
    }
    return { ok: true, versao: VERSAO_API, ultimoConcurso: ultimo };
  }
}
