import { dezenasDe, ultimaDezena } from './tipos';
import type { Concurso, EstatisticaDezena, Historico, Periodo } from './tipos';

export interface FrequenciaMes { anoMes: string; dezena: number; total: number }
export interface DistribuicaoPares { pares: number; total: number }
export interface FaixaSoma { inicio: number; total: number }
export interface ResumoAno { ano: number; concursos: number; acumulados: number; ganhadores: number; maiorPremioCentavos: bigint }

/** Recorta o histórico conforme o período (ordem crescente mantida). */
export function recortarPeriodo(historico: Historico, periodo: Periodo): Historico {
  const { concursos } = historico;
  let recorte: Concurso[];
  switch (periodo.tipo) {
    case 'ultimos':
      recorte = periodo.quantidade <= 0 ? [] : concursos.slice(-periodo.quantidade);
      break;
    case 'ano': {
      const prefixo = String(periodo.ano);
      recorte = concursos.filter((c) => c.data.startsWith(prefixo));
      break;
    }
    case 'tudo':
      recorte = [...concursos];
      break;
  }
  return { loteria: historico.loteria, concursos: recorte };
}

/**
 * Uma entrada por dezena válida (`primeiraDezena..ultimaDezena`: 1..60 na Mega-Sena, 0..99 na Lotomania).
 * Frequência no período; atraso e atrasoMaximo no histórico inteiro.
 */
export function calcularEstatisticas(historico: Historico, periodo: Periodo): EstatisticaDezena[] {
  const def = historico.loteria;
  const { universo, sorteadas } = def;
  const { concursos } = historico;
  const total = concursos.length;
  // Arrays indexados diretamente pela dezena: tamanho ultimaDezena + 1 (a posição 0 só é usada quando a dezena 00 existe).
  const tamanho = ultimaDezena(def) + 1;

  const frequencia = new Array<number>(tamanho).fill(0);
  for (const concurso of recortarPeriodo(historico, periodo).concursos) {
    for (const dezena of concurso.dezenas) frequencia[dezena]++;
  }

  // Um passe no histórico inteiro: última aparição e maior intervalo entre aparições (inclui o trecho inicial).
  const ultimoIndice = new Array<number>(tamanho).fill(-1);
  const maiorIntervalo = new Array<number>(tamanho).fill(0);
  concursos.forEach((concurso, indice) => {
    for (const dezena of concurso.dezenas) {
      const intervalo = indice - ultimoIndice[dezena] - 1;
      if (intervalo > maiorIntervalo[dezena]) maiorIntervalo[dezena] = intervalo;
      ultimoIndice[dezena] = indice;
    }
  });

  const base = 1 - sorteadas / universo;
  const resultado: EstatisticaDezena[] = [];
  for (const dezena of dezenasDe(def)) {
    const indice = ultimoIndice[dezena];
    const atraso = indice < 0 ? total : total - 1 - indice;
    const estatistica: EstatisticaDezena = {
      dezena,
      frequencia: frequencia[dezena],
      atraso,
      atrasoMaximo: Math.max(maiorIntervalo[dezena], atraso),
      probAusencia: Math.pow(base, atraso),
    };
    if (indice >= 0) {
      estatistica.ultimoConcurso = concursos[indice].numero;
      estatistica.ultimaData = concursos[indice].data;
    }
    resultado.push(estatistica);
  }
  return resultado;
}

/** Últimos `meses` meses-calendário presentes no histórico, uma linha por (anoMes, dezena) com total > 0. */
export function frequenciaPorMes(historico: Historico, meses: number): FrequenciaMes[] {
  if (meses <= 0) return [];
  const porMes = new Map<string, Map<number, number>>();
  for (const concurso of historico.concursos) {
    const anoMes = concurso.data.slice(0, 7);
    let contagem = porMes.get(anoMes);
    if (!contagem) {
      contagem = new Map<number, number>();
      porMes.set(anoMes, contagem);
    }
    for (const dezena of concurso.dezenas) contagem.set(dezena, (contagem.get(dezena) ?? 0) + 1);
  }
  const resultado: FrequenciaMes[] = [];
  const mesesSelecionados = [...porMes.keys()].sort().slice(-meses);
  for (const anoMes of mesesSelecionados) {
    const contagem = porMes.get(anoMes) as Map<number, number>;
    for (const dezena of [...contagem.keys()].sort((a, b) => a - b)) {
      resultado.push({ anoMes, dezena, total: contagem.get(dezena) as number });
    }
  }
  return resultado;
}

/** Quantos concursos tiveram 0, 1, …, sorteadas dezenas pares. */
export function distribuicaoPares(historico: Historico): DistribuicaoPares[] {
  const { sorteadas } = historico.loteria;
  const totais = new Array<number>(sorteadas + 1).fill(0);
  for (const concurso of historico.concursos) {
    let pares = 0;
    for (const dezena of concurso.dezenas) if (dezena % 2 === 0) pares++;
    totais[pares]++;
  }
  return totais.map((total, pares) => ({ pares, total }));
}

/** Soma das dezenas por faixa de `tamanhoFaixa` (inicio = múltiplo da faixa). */
export function distribuicaoSoma(historico: Historico, tamanhoFaixa: number): FaixaSoma[] {
  const porInicio = new Map<number, number>();
  for (const concurso of historico.concursos) {
    let soma = 0;
    for (const dezena of concurso.dezenas) soma += dezena;
    const inicio = Math.floor(soma / tamanhoFaixa) * tamanhoFaixa;
    porInicio.set(inicio, (porInicio.get(inicio) ?? 0) + 1);
  }
  return [...porInicio.entries()].sort((a, b) => a[0] - b[0]).map(([inicio, total]) => ({ inicio, total }));
}

export function resumoPorAno(historico: Historico): ResumoAno[] {
  const porAno = new Map<number, ResumoAno>();
  for (const concurso of historico.concursos) {
    const ano = Number(concurso.data.slice(0, 4));
    let resumo = porAno.get(ano);
    if (!resumo) {
      resumo = { ano, concursos: 0, acumulados: 0, ganhadores: 0, maiorPremioCentavos: 0n };
      porAno.set(ano, resumo);
    }
    resumo.concursos++;
    if (concurso.acumulou) resumo.acumulados++;
    for (const premiacao of concurso.premiacoes) {
      if (premiacao.faixa !== 1) continue;
      resumo.ganhadores += premiacao.ganhadores;
      if (premiacao.rateioCentavos > resumo.maiorPremioCentavos) resumo.maiorPremioCentavos = premiacao.rateioCentavos;
    }
  }
  return [...porAno.values()].sort((a, b) => a.ano - b.ano);
}
