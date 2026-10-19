/**
 * Contrato do domínio Sorteios (lib `core`).
 *
 * Regras: nenhuma dependência de DOM, rede ou banco. Tudo aqui é dado puro e funções puras.
 * Este arquivo é a fonte da verdade dos tipos usados por app e API; alterações exigem revisão.
 */

/** Faixa de premiação de uma loteria (1 = prêmio principal). */
export interface FaixaPremiacao {
  faixa: number;
  acertos: number;
  nome: string;
}

/** Definição declarativa de uma loteria. Toda tela e todo cálculo são dirigidos por ela. */
export interface LoteriaDefinicao {
  /** Identificador estável, usado em rotas e no banco (ex.: 'megasena'). */
  id: string;
  nome: string;
  /** Cor base da marca do jogo, em hex (#rrggbb). O app deriva dela todo o tema da loteria. */
  cor: string;
  /** Quantidade de dezenas do jogo. As dezenas válidas vão de `primeiraDezena` a `primeiraDezena + universo - 1`. */
  universo: number;
  /**
   * Menor dezena válida: 1 (Mega-Sena, 01..60) ou 0 (Lotomania, 00..99). Quando é 0, o 00 ocupa a última
   * casa do volante (01..99, 00), como no bilhete da Caixa: ver `ordemNoVolante`.
   */
  primeiraDezena: 0 | 1;
  /** Quantidade de dezenas sorteadas por concurso. */
  sorteadas: number;
  /** Quantidade de dezenas permitidas por aposta. */
  aposta: { min: number; max: number };
  /** Geometria do volante (grade colunas × linhas). */
  volante: { colunas: number; linhas: number };
  /** Quantidade de quadrantes do volante (hoje sempre 4). */
  quadrantes: number;
  faixas: FaixaPremiacao[];
  /** Dias da semana com sorteio: 0 = domingo … 6 = sábado. */
  diasSorteio: number[];
  /** Ids dos filtros que fazem sentido neste jogo (ver `Filtro.id`). */
  regrasDisponiveis: string[];
}

export interface Premiacao {
  faixa: number;
  ganhadores: number;
  rateioCentavos: bigint;
}

export interface LocalGanhador {
  cidade?: string;
  uf?: string;
  /** Texto original da fonte (ex.: "DOURADOS/MS", "SP", "CANAL ELETRONICO"). */
  descricao: string;
  quantidade: number;
}

export interface Concurso {
  numero: number;
  /** ISO yyyy-mm-dd. */
  data: string;
  /** Dezenas na ordem do volante (`compararDezenas`): crescente, mas o 00 da Lotomania vem por último. */
  dezenas: number[];
  acumulou: boolean;
  premiacoes: Premiacao[];
  valorAcumuladoCentavos: bigint;
  estimativaProximoCentavos: bigint;
  arrecadacaoCentavos: bigint;
  acumuladoEspecialCentavos: bigint;
  proximoNumero?: number;
  /** ISO yyyy-mm-dd. */
  dataProximoSorteio?: string;
  observacao?: string;
  locaisGanhadores: LocalGanhador[];
}

export interface Historico {
  loteria: LoteriaDefinicao;
  /** Ordenado por `numero` crescente. */
  concursos: Concurso[];
}

/** Recorte do histórico usado por estatísticas e pela estratégia "frequentes". */
export type Periodo =
  | { tipo: 'ultimos'; quantidade: number }
  | { tipo: 'ano'; ano: number }
  | { tipo: 'tudo' };

export interface EstatisticaDezena {
  dezena: number;
  /** Vezes que saiu no período. */
  frequencia: number;
  /** Concursos desde a última aparição no histórico inteiro (0 = saiu no último). */
  atraso: number;
  /** Maior intervalo sem sair já registrado (inclui o início do histórico e o atraso atual). */
  atrasoMaximo: number;
  ultimoConcurso?: number;
  ultimaData?: string;
  /** (1 - sorteadas/universo) ^ atraso. */
  probAusencia: number;
}

export type Estrategia = 'atrasadas' | 'frequentes' | 'mista' | 'aleatorio';

export interface ConfiguracaoGeracao {
  estrategia: Estrategia;
  /** 1..50. */
  quantidadeJogos: number;
  /** aposta.min..aposta.max da loteria. */
  dezenasPorJogo: number;
  /** Dezenas escolhidas pelo usuário; entram em todos os jogos. Pode ser vazio. */
  fixas: number[];
  atrasadas: {
    /** Dezenas com atraso abaixo disto têm peso 1. Padrão: atraso esperado (universo/sorteadas). */
    atrasoMinimo: number;
    /** Expoente do peso, 1..3 em passos de 0,5. Padrão 2. */
    intensidade: number;
  };
  frequentes: { periodo: Periodo };
  /** Filtros ligados, por id (ausente = desligado). */
  regras: Record<string, boolean>;
}

export interface Jogo {
  dezenas: number[];
  atrasoMedio: number;
  pares: number;
  /** Quantidade de quadrantes distintos cobertos. */
  quadrantes: number;
}

export interface ResultadoGeracao {
  jogos: Jogo[];
  /** Verdadeiro quando os filtros impediram gerar `quantidadeJogos`. */
  incompleto: boolean;
  tentativas: number;
}

export interface ContextoFiltro {
  def: LoteriaDefinicao;
  /** Chaves "d1-d2-…-dn" de todos os resultados já sorteados (dezenas crescentes, sem zero à esquerda). */
  historico: Set<string>;
}

export interface Filtro {
  id: string;
  nome: string;
  /** Ligado por padrão na interface? */
  padraoLigado: boolean;
  /** Se o filtro faz sentido para esta loteria e tamanho de jogo (ex.: "colunas" exige k <= colunas). */
  aplicavelA(def: LoteriaDefinicao, dezenasPorJogo: number): boolean;
  /** `jogo` sempre em ordem crescente. */
  aceita(jogo: number[], ctx: ContextoFiltro): boolean;
}

/** Gerador de números pseudoaleatórios em [0, 1). */
export type Rng = () => number;

/** Chave canônica de um jogo/resultado para comparação e deduplicação. */
export function chaveJogo(dezenas: number[]): string {
  return [...dezenas].sort((a, b) => a - b).join('-');
}

/**
 * Atraso esperado de uma dezena: universo / sorteadas (10 na Mega-Sena, 5 na Lotomania, 1,666… na Lotofácil).
 * Valor exato, usado nos pesos; para exibir, `formatarAtraso`.
 */
export function atrasoEsperado(def: LoteriaDefinicao): number {
  return def.universo / def.sorteadas;
}

/** Maior dezena válida da loteria (60 na Mega-Sena, 99 na Lotomania). */
export function ultimaDezena(def: LoteriaDefinicao): number {
  return def.primeiraDezena + def.universo - 1;
}

/**
 * Posição (1..universo) da dezena no volante. Na Lotomania o 00 é a última casa (100ª), depois do 99,
 * como no bilhete da Caixa; nas demais loterias a posição é a própria dezena.
 */
export function ordemNoVolante(dezena: number, def: LoteriaDefinicao): number {
  return def.primeiraDezena === 0 && dezena === 0 ? def.universo : dezena;
}

/** Dezena que ocupa a posição `ordem` (1..universo) do volante. Inverso de `ordemNoVolante`. */
export function dezenaNaOrdem(ordem: number, def: LoteriaDefinicao): number {
  return def.primeiraDezena === 0 && ordem === def.universo ? 0 : ordem;
}

/** Comparador na ordem do volante (01..99, 00 na Lotomania). Use em vez de `(a, b) => a - b` ao exibir dezenas. */
export function compararDezenas(def: LoteriaDefinicao): (a: number, b: number) => number {
  return (a, b) => ordemNoVolante(a, def) - ordemNoVolante(b, def);
}

/** Todas as dezenas válidas, na ordem do volante (01..60; 01..99, 00). Use isto em vez de laços `1..universo`. */
export function dezenasDe(def: LoteriaDefinicao): number[] {
  return Array.from({ length: def.universo }, (_, i) => dezenaNaOrdem(i + 1, def));
}

/** Verdadeiro se `n` é uma dezena válida da loteria (inteiro dentro do intervalo). */
export function dezenaValida(n: number, def: LoteriaDefinicao): boolean {
  return Number.isInteger(n) && n >= def.primeiraDezena && n <= ultimaDezena(def);
}

/**
 * Texto de exibição de um atraso em concursos: até 1 casa decimal, vírgula decimal e sem ",0"
 * (atraso esperado: Mega-Sena 10 → "10"; Lotofácil 25/15 → "1,7").
 */
export function formatarAtraso(valor: number): string {
  return String(Math.round(valor * 10) / 10).replace('.', ',');
}

/** Texto de exibição da dezena com 2 dígitos ("00", "07", "60"). */
export function formatarDezena(n: number): string {
  return String(n).padStart(2, '0');
}
