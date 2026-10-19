import { Injectable } from '@nestjs/common';
import type { EstatisticasDto } from '@sorteios/contratos';
import {
  calcularEstatisticas,
  distribuicaoPares,
  distribuicaoSoma,
  frequenciaPorMes,
  recortarPeriodo,
  resumoPorAno,
  type Historico,
} from '@sorteios/core';
import { paraEstatisticaDezenaDto, paraResumoAnoDto } from './dto.mapeador';
import { LoteriasService } from './loterias.service';
import { interpretarPeriodo } from './periodo';

/** Tamanho da faixa do histograma de soma das dezenas. */
const FAIXA_SOMA = 20;
/** Janela do mapa de calor dezena × mês. */
const MESES_MAPA_CALOR = 12;

/** Estatísticas sobre o histórico do banco, delegando todo o cálculo à lib `core`. */
@Injectable()
export class EstatisticasService {
  /** Resultados por instância de histórico: quando o cache do histórico é invalidado, o resultado antigo se perde junto. */
  private readonly resultados = new WeakMap<
    Historico,
    Map<string, EstatisticasDto>
  >();

  constructor(private readonly loterias: LoteriasService) {}

  async calcular(
    loteriaId: string,
    periodoTexto: string | undefined,
  ): Promise<EstatisticasDto> {
    const { periodo, texto } = interpretarPeriodo(periodoTexto);
    const historico = await this.loterias.historicoCompleto(loteriaId);

    let porPeriodo = this.resultados.get(historico);
    if (!porPeriodo) {
      porPeriodo = new Map();
      this.resultados.set(historico, porPeriodo);
    }
    const guardado = porPeriodo.get(texto);
    if (guardado) return guardado;

    const recorte = recortarPeriodo(historico, periodo);
    const resposta: EstatisticasDto = {
      periodo: texto,
      concursosNoPeriodo: recorte.concursos.length,
      dezenas: calcularEstatisticas(historico, periodo).map(
        paraEstatisticaDezenaDto,
      ),
      pares: distribuicaoPares(recorte).map((p) => ({
        pares: p.pares,
        total: p.total,
      })),
      soma: distribuicaoSoma(recorte, FAIXA_SOMA).map((f) => ({
        inicio: f.inicio,
        total: f.total,
      })),
      porAno: resumoPorAno(historico).map(paraResumoAnoDto),
      porMes: frequenciaPorMes(historico, MESES_MAPA_CALOR).map((m) => ({
        anoMes: m.anoMes,
        dezena: m.dezena,
        total: m.total,
      })),
    };
    porPeriodo.set(texto, resposta);
    return resposta;
  }
}
