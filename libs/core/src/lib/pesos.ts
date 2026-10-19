import { atrasoEsperado, dezenasDe, ultimaDezena } from './tipos';
import type { ConfiguracaoGeracao, EstatisticaDezena, LoteriaDefinicao } from './tipos';

/** Indexa a lista por dezena e garante que todas as dezenas válidas da loteria estão presentes. */
function indexarPorDezena(lista: EstatisticaDezena[], def: LoteriaDefinicao, nome: string): Map<number, EstatisticaDezena> {
  const indice = new Map<number, EstatisticaDezena>();
  for (const item of lista) indice.set(item.dezena, item);
  for (const dezena of dezenasDe(def)) {
    if (!indice.has(dezena)) {
      throw new Error(
        `Estatísticas de ${nome} incompletas: falta a dezena ${dezena} (esperado ${def.primeiraDezena}..${ultimaDezena(def)}).`,
      );
    }
  }
  return indice;
}

/** Peso de sorteio por dezena válida (`primeiraDezena..ultimaDezena`). Ver especificação 4.3. */
export function calcularPesos(
  estatisticasAtraso: EstatisticaDezena[],
  estatisticasFrequencia: EstatisticaDezena[],
  config: ConfiguracaoGeracao,
  def: LoteriaDefinicao,
): Map<number, number> {
  const porAtraso = indexarPorDezena(estatisticasAtraso, def, 'atraso');
  const porFrequencia = indexarPorDezena(estatisticasFrequencia, def, 'frequência');
  const esperado = atrasoEsperado(def);
  const pesos = new Map<number, number>();

  let maiorAtraso = 0;
  let maiorFrequencia = 0;
  const dezenas = dezenasDe(def);
  for (const dezena of dezenas) {
    maiorAtraso = Math.max(maiorAtraso, porAtraso.get(dezena)!.atraso);
    maiorFrequencia = Math.max(maiorFrequencia, porFrequencia.get(dezena)!.frequencia);
  }

  for (const dezena of dezenas) {
    const atraso = porAtraso.get(dezena)!.atraso;
    const frequencia = porFrequencia.get(dezena)!.frequencia;
    let peso: number;
    switch (config.estrategia) {
      case 'atrasadas':
        peso =
          atraso >= config.atrasadas.atrasoMinimo ? 1 + Math.pow(atraso / esperado, config.atrasadas.intensidade) : 1;
        break;
      case 'frequentes':
        peso = 1 + frequencia;
        break;
      case 'mista': {
        const atrasoNormalizado = maiorAtraso > 0 ? atraso / maiorAtraso : 0;
        const frequenciaNormalizada = maiorFrequencia > 0 ? frequencia / maiorFrequencia : 0;
        peso = Math.sqrt(atrasoNormalizado * frequenciaNormalizada) + 0.05;
        break;
      }
      case 'aleatorio':
        peso = 1;
        break;
      default:
        throw new Error(`Estratégia desconhecida: ${String(config.estrategia)}.`);
    }
    pesos.set(dezena, peso);
  }
  return pesos;
}
