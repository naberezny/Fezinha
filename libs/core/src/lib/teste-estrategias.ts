import { sortearDezenas } from './geracao';
import { calcularPesos } from './pesos';
import { AcompanhamentoRitmo } from './ritmo';
import { criarRng } from './rng';
import { atrasoEsperado, compararDezenas, dezenasDe, ultimaDezena } from './tipos';
import type { ConfiguracaoGeracao, Estrategia, EstatisticaDezena, Historico, LoteriaDefinicao } from './tipos';

/** Estratégias do teste: as quatro da tela Gerar e o "ritmo" de cada dezena (só existe aqui, para ser medido). */
export type EstrategiaTestada = Estrategia | 'ritmo';

export const ESTRATEGIAS_TESTADAS: readonly EstrategiaTestada[] = ['aleatorio', 'atrasadas', 'frequentes', 'mista', 'ritmo'];

export interface OpcoesTesteEstrategias {
  /** Quantos concursos, os mais recentes, entram no teste. */
  concursos: number;
  /** aposta.min..aposta.max da loteria. */
  dezenasPorJogo: number;
  /** Jogos gerados por estratégia em cada concurso. Padrão 10. */
  jogosPorConcurso?: number;
  /** Semente do sorteio: a mesma semente repete o resultado. Padrão 1. */
  semente?: number;
  /** Janela da estratégia "frequentes" (últimos N concursos). Padrão 50, como na tela Gerar. */
  janelaFrequencia?: number;
}

export interface ResultadoEstrategiaTestada {
  estrategia: EstrategiaTestada;
  jogos: number;
  /** Média de acertos por jogo. */
  mediaAcertos: number;
  /**
   * Meia largura do intervalo de 99% da média (`Z_MARGEM` erros padrão). Medida entre concursos, porque os jogos de um mesmo
   * concurso saem dos mesmos pesos e não são independentes.
   */
  margem: number;
  /** Jogos que acertaram uma faixa premiada. */
  premiados: number;
  /** Jogos por quantidade de acertos (posição = acertos). */
  distribuicao: number[];
}

/** O que o acaso dá a um jogo qualquer (distribuição hipergeométrica). */
export interface AcasoTeste {
  mediaAcertos: number;
  /** Probabilidade de um jogo acertar uma faixa premiada. */
  probPremio: number;
  /** Probabilidade de cada quantidade de acertos (posição = acertos). */
  distribuicao: number[];
}

export interface ResultadoTesteEstrategias {
  concursosTestados: number;
  /** Número do primeiro e do último concurso testados (ausentes quando nenhum foi testado). */
  primeiroConcurso?: number;
  ultimoConcurso?: number;
  dezenasPorJogo: number;
  jogosPorConcurso: number;
  acaso: AcasoTeste;
  estrategias: ResultadoEstrategiaTestada[];
}

/**
 * Erros padrão da margem: 2,576 = intervalo de 99%. Com 5 estratégias comparadas ao acaso ao mesmo tempo, 99% em cada
 * uma (correção de Bonferroni, 5% ÷ 5) mantém em ~5% a chance de alguma passar da margem só por sorte; com 95% em
 * cada uma essa chance seria de ~23%.
 */
export const Z_MARGEM = 2.576;

/** De quantos em quantos concursos testados o gerador devolve o progresso. */
const PASSO_PROGRESSO = 25;

/** Peso da estratégia "ritmo": 1 para quem está dentro do ritmo, até 5 para quem já passou de todas as ausências. */
function pesoRitmo(passouDe: number): number {
  return 1 + 4 * passouDe * passouDe;
}

/** Acertos de um jogo de `dezenasPorJogo` dezenas por puro acaso. */
export function acasoDoJogo(def: LoteriaDefinicao, dezenasPorJogo: number): AcasoTeste {
  const { universo, sorteadas } = def;
  const lnFatorial = [0];
  for (let n = 1; n <= universo; n++) lnFatorial.push(lnFatorial[n - 1] + Math.log(n));
  const lnCombinacao = (n: number, k: number) => lnFatorial[n] - lnFatorial[k] - lnFatorial[n - k];

  const premiadas = new Set(def.faixas.map((f) => f.acertos));
  const maximo = Math.min(dezenasPorJogo, sorteadas);
  const distribuicao = new Array<number>(maximo + 1).fill(0);
  let probPremio = 0;
  for (let acertos = Math.max(0, dezenasPorJogo + sorteadas - universo); acertos <= maximo; acertos++) {
    const probabilidade = Math.exp(
      lnCombinacao(dezenasPorJogo, acertos) +
        lnCombinacao(universo - dezenasPorJogo, sorteadas - acertos) -
        lnCombinacao(universo, sorteadas),
    );
    distribuicao[acertos] = probabilidade;
    if (premiadas.has(acertos)) probPremio += probabilidade;
  }
  return { mediaAcertos: (dezenasPorJogo * sorteadas) / universo, probPremio, distribuicao };
}

/**
 * Teste das estratégias contra o acaso. Para cada um dos últimos `concursos`, gera jogos com cada estratégia usando
 * só os resultados anteriores a ele e conta os acertos. Os pesos são os da tela Gerar (padrões: atraso mínimo =
 * atraso esperado arredondado, intensidade 2, frequência nos últimos 50); as regras do volante ficam de fora.
 * Todas as estratégias usam a mesma semente, para que a comparação entre elas não dependa da sorte do gerador.
 *
 * Gerador: devolve o progresso (0..1) de tempos em tempos, para a tela não travar, e o resultado no fim.
 * Para rodar de uma vez, use `testarEstrategias`.
 */
export function* executarTesteEstrategias(
  historico: Historico,
  opcoes: OpcoesTesteEstrategias,
): Generator<number, ResultadoTesteEstrategias, void> {
  const def = historico.loteria;
  const { dezenasPorJogo } = opcoes;
  if (!Number.isInteger(dezenasPorJogo) || dezenasPorJogo < def.aposta.min || dezenasPorJogo > def.aposta.max) {
    throw new Error(
      `dezenasPorJogo deve ser um inteiro entre ${def.aposta.min} e ${def.aposta.max} (recebido ${dezenasPorJogo}).`,
    );
  }
  const jogosPorConcurso = opcoes.jogosPorConcurso ?? 10;
  const semente = opcoes.semente ?? 1;
  const janela = opcoes.janelaFrequencia ?? 50;

  const { concursos } = historico;
  const total = concursos.length;
  const inicio = Math.max(0, total - Math.max(0, Math.floor(opcoes.concursos)));
  const testados = total - inicio;

  const candidatas = dezenasDe(def);
  const comparar = compararDezenas(def);
  const premiadas = new Set(def.faixas.map((f) => f.acertos));
  const configuracaoBase: Omit<ConfiguracaoGeracao, 'estrategia'> = {
    quantidadeJogos: jogosPorConcurso,
    dezenasPorJogo,
    fixas: [],
    atrasadas: { atrasoMinimo: Math.round(atrasoEsperado(def)), intensidade: 2 },
    frequentes: { periodo: { tipo: 'ultimos', quantidade: janela } },
    regras: {},
  };

  const estados = ESTRATEGIAS_TESTADAS.map((estrategia) => ({
    estrategia,
    rng: criarRng(semente),
    jogos: 0,
    somaAcertos: 0,
    premiados: 0,
    distribuicao: new Array<number>(Math.min(dezenasPorJogo, def.sorteadas) + 1).fill(0),
    somaMedias: 0,
    somaQuadradosMedias: 0,
  }));

  const ritmo = new AcompanhamentoRitmo(def);
  const frequencia = new Array<number>(ultimaDezena(def) + 1).fill(0);

  for (let indice = 0; indice < total; indice++) {
    const concurso = concursos[indice];
    if (indice >= inicio) {
      const sorteio = new Set(concurso.dezenas);
      const estatisticas: EstatisticaDezena[] = candidatas.map((dezena) => ({
        dezena,
        frequencia: frequencia[dezena],
        atraso: ritmo.atraso(dezena),
        atrasoMaximo: 0,
        probAusencia: 0,
      }));

      for (const estado of estados) {
        const pesos =
          estado.estrategia === 'ritmo'
            ? new Map(candidatas.map((dezena) => [dezena, pesoRitmo(ritmo.passouDe(dezena))]))
            : calcularPesos(estatisticas, estatisticas, { ...configuracaoBase, estrategia: estado.estrategia }, def);
        let acertosNoConcurso = 0;
        for (let jogo = 0; jogo < jogosPorConcurso; jogo++) {
          const dezenas = sortearDezenas(candidatas, pesos, [], dezenasPorJogo, estado.rng, comparar);
          let acertos = 0;
          for (const dezena of dezenas) if (sorteio.has(dezena)) acertos++;
          estado.distribuicao[acertos]++;
          if (premiadas.has(acertos)) estado.premiados++;
          acertosNoConcurso += acertos;
        }
        estado.jogos += jogosPorConcurso;
        estado.somaAcertos += acertosNoConcurso;
        const mediaConcurso = acertosNoConcurso / jogosPorConcurso;
        estado.somaMedias += mediaConcurso;
        estado.somaQuadradosMedias += mediaConcurso * mediaConcurso;
      }

      const feitos = indice - inicio + 1;
      if (feitos % PASSO_PROGRESSO === 0 && feitos < testados) yield feitos / testados;
    }

    ritmo.adicionar(concurso.dezenas);
    for (const dezena of concurso.dezenas) frequencia[dezena]++;
    if (indice >= janela) for (const dezena of concursos[indice - janela].dezenas) frequencia[dezena]--;
  }

  return {
    concursosTestados: testados,
    primeiroConcurso: testados > 0 ? concursos[inicio].numero : undefined,
    ultimoConcurso: testados > 0 ? concursos[total - 1].numero : undefined,
    dezenasPorJogo,
    jogosPorConcurso,
    acaso: acasoDoJogo(def, dezenasPorJogo),
    estrategias: estados.map((estado) => {
      const media = testados > 0 ? estado.somaMedias / testados : 0;
      const variancia =
        testados > 1 ? Math.max(estado.somaQuadradosMedias / testados - media * media, 0) * (testados / (testados - 1)) : 0;
      return {
        estrategia: estado.estrategia,
        jogos: estado.jogos,
        mediaAcertos: estado.jogos > 0 ? estado.somaAcertos / estado.jogos : 0,
        margem: testados > 1 ? Z_MARGEM * Math.sqrt(variancia / testados) : 0,
        premiados: estado.premiados,
        distribuicao: estado.distribuicao,
      };
    }),
  };
}

/** `executarTesteEstrategias` de uma vez só (testes e scripts). */
export function testarEstrategias(historico: Historico, opcoes: OpcoesTesteEstrategias): ResultadoTesteEstrategias {
  const execucao = executarTesteEstrategias(historico, opcoes);
  for (;;) {
    const passo = execucao.next();
    if (passo.done) return passo.value;
  }
}
