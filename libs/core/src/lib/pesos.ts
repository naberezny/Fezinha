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

/** Proporção padrão do modo misto: metade do peso para cada extremo. */
export const PROPORCAO_FRIAS_PADRAO = 0.5;

function proporcaoFriasDe(config: ConfiguracaoGeracao): number {
  const proporcao = config.mista?.proporcaoFrias ?? PROPORCAO_FRIAS_PADRAO;
  return Math.min(Math.max(proporcao, 0), 1);
}

/**
 * Peso do modo misto para uma dezena na `posicao` (0 = a que menos saiu na janela, 1 = a que mais saiu):
 * 0,05 + (1 − p)·posição² + p·(1 − posição)², com p = proporção para as frias. Vai de 0,05 a 1,05, como antes.
 * p = 0 favorece só as quentes; p = 1, só as frias; p = 0,5 favorece os dois extremos e tira peso das do meio.
 */
export function pesoMista(posicao: number, proporcaoFrias: number): number {
  return 0.05 + (1 - proporcaoFrias) * posicao * posicao + proporcaoFrias * (1 - posicao) * (1 - posicao);
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

  let maiorFrequencia = 0;
  let menorFrequencia = Infinity;
  const dezenas = dezenasDe(def);
  for (const dezena of dezenas) {
    const frequencia = porFrequencia.get(dezena)!.frequencia;
    maiorFrequencia = Math.max(maiorFrequencia, frequencia);
    menorFrequencia = Math.min(menorFrequencia, frequencia);
  }
  const proporcaoFrias = proporcaoFriasDe(config);

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
        // Posição da dezena entre a menos (0) e a mais frequente (1) da janela; todas iguais = meio.
        const posicao =
          maiorFrequencia > menorFrequencia ? (frequencia - menorFrequencia) / (maiorFrequencia - menorFrequencia) : 0.5;
        peso = pesoMista(posicao, proporcaoFrias);
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
