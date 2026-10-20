import { distribuicaoAcaso, varianciaAcaso } from './acaso';
import { recortarPeriodo } from './estatisticas';
import { Z_MARGEM } from './teste-estrategias';
import { atrasoEsperado, dezenasDe, ordemNoVolante, ultimaDezena } from './tipos';
import type { Historico, LoteriaDefinicao, Periodo } from './tipos';

/**
 * Grupos de dezenas montados na véspera de cada concurso, só com os resultados anteriores a ele:
 * - quentes: o terço das dezenas que mais saiu nos últimos `janela` concursos;
 * - frias: o terço que menos saiu nesse mesmo período;
 * - atrasadas: sem sair há pelo menos o atraso esperado (arredondado, como o atraso mínimo da tela Gerar);
 * - repetidas: as que saíram no concurso anterior.
 */
export type GrupoComposicao = 'quentes' | 'frias' | 'atrasadas' | 'repetidas';

export const GRUPOS_COMPOSICAO: readonly GrupoComposicao[] = ['quentes', 'frias', 'atrasadas', 'repetidas'];

export interface ComposicaoGrupo {
  grupo: GrupoComposicao;
  /** Tamanho médio do grupo na véspera (fixo para quentes, frias e repetidas; varia para atrasadas). */
  tamanhoMedio: number;
  /** Dezenas do grupo entre as sorteadas, em média por concurso. */
  mediaObservada: number;
  /** O mesmo, se o sorteio não tivesse padrão nenhum: sorteadas × tamanho do grupo ÷ universo. */
  mediaAcaso: number;
  /** Meia largura do intervalo de 99% da média pelo acaso (`Z_MARGEM` erros padrão). */
  margem: number;
  /** Concursos por quantidade de dezenas do grupo entre as sorteadas (posição = quantidade). */
  distribuicaoObservada: number[];
  /** Concursos esperados pelo acaso em cada quantidade (soma das hipergeométricas de cada véspera). */
  distribuicaoAcaso: number[];
}

export interface ResultadoComposicao {
  /** Concursos analisados: os do período que têm pelo menos `janela` concursos antes. */
  concursos: number;
  janela: number;
  /** Tamanho do terço de quentes e de frias (Mega-Sena 20, Lotomania 33, Lotofácil 8). */
  tamanhoTerco: number;
  /** Atraso a partir do qual a dezena conta como atrasada. */
  atrasoMinimo: number;
  grupos: ComposicaoGrupo[];
}

interface Acumulador {
  soma: number;
  somaTamanhos: number;
  somaAcaso: number;
  somaVariancias: number;
  observada: number[];
  acaso: number[];
}

/**
 * Composição dos concursos do `periodo`: em cada um, quantas sorteadas eram quentes, frias, atrasadas ou repetidas,
 * com os grupos montados só com os concursos anteriores, comparado com o acaso. Medido nos resultados reais, tudo
 * fica dentro da margem: a composição dos sorteios é a que o acaso produz.
 */
export function calcularComposicao(
  historico: Historico,
  periodo: Periodo = { tipo: 'tudo' },
  janela = 50,
): ResultadoComposicao {
  const def = historico.loteria;
  const { concursos } = historico;
  const candidatas = dezenasDe(def);
  const tamanhoTerco = Math.round(def.universo / 3);
  const atrasoMinimo = Math.round(atrasoEsperado(def));
  const noPeriodo = new Set(recortarPeriodo(historico, periodo).concursos.map((c) => c.numero));

  const tamanho = ultimaDezena(def) + 1;
  const frequencia = new Array<number>(tamanho).fill(0);
  const ultimoIndice = new Array<number>(tamanho).fill(-1);
  const acumuladores = new Map<GrupoComposicao, Acumulador>(
    GRUPOS_COMPOSICAO.map((grupo) => [
      grupo,
      {
        soma: 0,
        somaTamanhos: 0,
        somaAcaso: 0,
        somaVariancias: 0,
        observada: new Array<number>(def.sorteadas + 1).fill(0),
        acaso: new Array<number>(def.sorteadas + 1).fill(0),
      },
    ]),
  );
  const cacheAcaso = new Map<number, number[]>();
  const acasoDe = (g: number) => {
    let distribuicao = cacheAcaso.get(g);
    if (!distribuicao) {
      distribuicao = distribuicaoAcaso(def, g);
      cacheAcaso.set(g, distribuicao);
    }
    return distribuicao;
  };

  let analisados = 0;
  for (let indice = 0; indice < concursos.length; indice++) {
    const concurso = concursos[indice];
    if (indice >= janela && noPeriodo.has(concurso.numero)) {
      analisados++;
      // Empate de frequência: desempata pela ordem do volante (regra fixa, que não depende do sorteio).
      const porFrequencia = [...candidatas].sort(
        (a, b) => frequencia[b] - frequencia[a] || ordemNoVolante(a, def) - ordemNoVolante(b, def),
      );
      const grupos: Record<GrupoComposicao, Set<number>> = {
        quentes: new Set(porFrequencia.slice(0, tamanhoTerco)),
        frias: new Set(porFrequencia.slice(-tamanhoTerco)),
        atrasadas: new Set(candidatas.filter((d) => indice - 1 - ultimoIndice[d] >= atrasoMinimo)),
        repetidas: new Set(concursos[indice - 1].dezenas),
      };
      for (const grupo of GRUPOS_COMPOSICAO) {
        const membros = grupos[grupo];
        const acumulador = acumuladores.get(grupo) as Acumulador;
        let quantidade = 0;
        for (const dezena of concurso.dezenas) if (membros.has(dezena)) quantidade++;
        acumulador.soma += quantidade;
        acumulador.observada[quantidade]++;
        acumulador.somaTamanhos += membros.size;
        acumulador.somaAcaso += (def.sorteadas * membros.size) / def.universo;
        acumulador.somaVariancias += varianciaAcaso(def, membros.size);
        acasoDe(membros.size).forEach((p, q) => (acumulador.acaso[q] += p));
      }
    }

    for (const dezena of concurso.dezenas) {
      frequencia[dezena]++;
      ultimoIndice[dezena] = indice;
    }
    if (indice >= janela) for (const dezena of concursos[indice - janela].dezenas) frequencia[dezena]--;
  }

  return {
    concursos: analisados,
    janela,
    tamanhoTerco,
    atrasoMinimo,
    grupos: GRUPOS_COMPOSICAO.map((grupo) => resumir(grupo, acumuladores.get(grupo) as Acumulador, analisados, def)),
  };
}

function resumir(grupo: GrupoComposicao, a: Acumulador, n: number, def: LoteriaDefinicao): ComposicaoGrupo {
  // Corta as quantidades além da última com chance ou ocorrência (ex.: 7 a 20 atrasadas na Lotofácil).
  let fim = def.sorteadas;
  while (fim > 0 && a.observada[fim] === 0 && a.acaso[fim] < 0.005) fim--;
  return {
    grupo,
    tamanhoMedio: n > 0 ? a.somaTamanhos / n : 0,
    mediaObservada: n > 0 ? a.soma / n : 0,
    mediaAcaso: n > 0 ? a.somaAcaso / n : 0,
    margem: n > 0 ? (Z_MARGEM * Math.sqrt(a.somaVariancias)) / n : 0,
    distribuicaoObservada: a.observada.slice(0, fim + 1),
    distribuicaoAcaso: a.acaso.slice(0, fim + 1),
  };
}
