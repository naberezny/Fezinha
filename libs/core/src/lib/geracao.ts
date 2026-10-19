import { calcularEstatisticas } from './estatisticas';
import { filtroExiste, obterFiltro } from './filtros';
import { calcularPesos } from './pesos';
import { chaveJogo, compararDezenas, dezenasDe, dezenaValida, ultimaDezena } from './tipos';
import type {
  ConfiguracaoGeracao,
  ContextoFiltro,
  Estrategia,
  Filtro,
  Historico,
  Jogo,
  ResultadoGeracao,
  Rng,
} from './tipos';
import { quadrante } from './volante';

const MAXIMO_TENTATIVAS = 20_000;
const ESTRATEGIAS: Estrategia[] = ['atrasadas', 'frequentes', 'mista', 'aleatorio'];

function validarConfiguracao(historico: Historico, config: ConfiguracaoGeracao): void {
  const def = historico.loteria;
  if (!ESTRATEGIAS.includes(config.estrategia)) {
    throw new Error(`Estratégia desconhecida: ${String(config.estrategia)}.`);
  }
  if (!Number.isInteger(config.quantidadeJogos) || config.quantidadeJogos < 1 || config.quantidadeJogos > 50) {
    throw new Error(`quantidadeJogos deve ser um inteiro entre 1 e 50 (recebido ${config.quantidadeJogos}).`);
  }
  if (
    !Number.isInteger(config.dezenasPorJogo) ||
    config.dezenasPorJogo < def.aposta.min ||
    config.dezenasPorJogo > def.aposta.max
  ) {
    throw new Error(
      `dezenasPorJogo deve ser um inteiro entre ${def.aposta.min} e ${def.aposta.max} (recebido ${config.dezenasPorJogo}).`,
    );
  }
  for (const fixa of config.fixas) {
    if (!dezenaValida(fixa, def)) {
      throw new Error(`Dezena fixa inválida: ${fixa} (esperado ${def.primeiraDezena}..${ultimaDezena(def)}).`);
    }
  }
  if (new Set(config.fixas).size !== config.fixas.length) {
    throw new Error('As dezenas fixas devem ser distintas.');
  }
  if (config.fixas.length > config.dezenasPorJogo) {
    throw new Error(
      `Há ${config.fixas.length} dezenas fixas, mais do que as ${config.dezenasPorJogo} dezenas por jogo.`,
    );
  }
  for (const id of Object.keys(config.regras)) {
    if (!filtroExiste(id)) throw new Error(`Regra desconhecida: ${id}.`);
  }
}

/**
 * Filtros ligados (por id) que se aplicam à loteria e ao tamanho de jogo.
 * Ids ligados que a loteria não oferece (fora de `def.regrasDisponiveis`, ex.: `consecutivas` na Lotomania) são
 * ignorados em silêncio: o id existe como filtro, mas não faz sentido neste jogo. Id que não é filtro nenhum
 * continua sendo erro (ver `validarConfiguracao`).
 */
function resolverFiltros(historico: Historico, config: ConfiguracaoGeracao): Filtro[] {
  const disponiveis = historico.loteria.regrasDisponiveis;
  return Object.entries(config.regras)
    .filter(([id, ligado]) => ligado && disponiveis.includes(id))
    .map(([id]) => obterFiltro(id))
    .filter((filtro) => filtro.aplicavelA(historico.loteria, config.dezenasPorJogo));
}

/** Sorteio por roleta, sem reposição, a partir das fixas. Devolve as dezenas na ordem do volante (`comparar`). */
function sortearDezenas(
  candidatas: number[],
  pesos: Map<number, number>,
  fixas: number[],
  dezenasPorJogo: number,
  rng: Rng,
  comparar: (a: number, b: number) => number,
): number[] {
  const escolhidas = [...fixas];
  const restantes = candidatas.filter((dezena) => !fixas.includes(dezena));
  while (escolhidas.length < dezenasPorJogo) {
    let soma = 0;
    for (const dezena of restantes) soma += pesos.get(dezena)!;
    const alvo = rng() * soma;
    let acumulado = 0;
    let posicao = restantes.length - 1;
    for (let i = 0; i < restantes.length; i++) {
      acumulado += pesos.get(restantes[i])!;
      if (alvo < acumulado) {
        posicao = i;
        break;
      }
    }
    escolhidas.push(restantes[posicao]);
    restantes.splice(posicao, 1);
  }
  return escolhidas.sort(comparar);
}

/** Gera jogos ponderados e filtrados. Determinístico para o mesmo `rng`. */
export function gerarJogos(historico: Historico, config: ConfiguracaoGeracao, rng: Rng): ResultadoGeracao {
  validarConfiguracao(historico, config);
  const def = historico.loteria;

  const estatisticasAtraso = calcularEstatisticas(historico, { tipo: 'tudo' });
  const estatisticasFrequencia = calcularEstatisticas(historico, config.frequentes.periodo);
  const pesos = calcularPesos(estatisticasAtraso, estatisticasFrequencia, config, def);
  const atrasoPorDezena = new Map(estatisticasAtraso.map((e) => [e.dezena, e.atraso]));

  const contexto: ContextoFiltro = {
    def,
    historico: new Set(historico.concursos.map((c) => chaveJogo(c.dezenas))),
  };
  const filtros = resolverFiltros(historico, config);

  // Com as fixas completando o jogo só existe uma combinação possível: uma tentativa basta.
  const combinacaoUnica = config.fixas.length === config.dezenasPorJogo;
  const maximoTentativas = combinacaoUnica ? 1 : MAXIMO_TENTATIVAS;

  const candidatas = dezenasDe(def);
  const comparar = compararDezenas(def);
  const jogos: Jogo[] = [];
  const geradas = new Set<string>();
  let tentativas = 0;

  while (jogos.length < config.quantidadeJogos && tentativas < maximoTentativas) {
    tentativas++;
    const dezenas = sortearDezenas(candidatas, pesos, config.fixas, config.dezenasPorJogo, rng, comparar);
    const chave = chaveJogo(dezenas);
    if (geradas.has(chave)) continue;
    if (!filtros.every((filtro) => filtro.aceita(dezenas, contexto))) continue;
    geradas.add(chave);

    const somaAtrasos = dezenas.reduce((soma, d) => soma + (atrasoPorDezena.get(d) ?? 0), 0);
    jogos.push({
      dezenas,
      atrasoMedio: Math.round((somaAtrasos / dezenas.length) * 10) / 10,
      pares: dezenas.filter((d) => d % 2 === 0).length,
      quadrantes: new Set(dezenas.map((d) => quadrante(d, def))).size,
    });
  }

  return {
    jogos,
    incompleto: jogos.length < config.quantidadeJogos,
    tentativas,
  };
}
