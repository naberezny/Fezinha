import { Injectable, computed, inject, linkedSignal, signal, untracked } from '@angular/core';
import {
  apostasEquivalentes,
  atrasoEsperado,
  calcularEstatisticas,
  compararDezenas,
  dezenaValida,
  filtrosPadrao,
  formatarAtraso,
  formatarDezena,
  gerarJogos,
  pesoMista,
  PROPORCAO_FRIAS_PADRAO,
  rngPadrao,
  chanceUmEm,
  type ConfiguracaoGeracao,
  type Estrategia,
  type LoteriaDefinicao,
  type Periodo,
  type ResultadoGeracao,
  type Rng,
} from '@sorteios/core';
import { HistoricoStore, type JogoSalvo } from '../dados/historico.store';

/** Janelas da estratégia "frequentes" (valor do select). */
export type JanelaFrequencia = '50' | '100' | 'anoAtual' | 'anoAnterior' | 'tudo';

export const QUANTIDADE_JOGOS_MIN = 1;
export const QUANTIDADE_JOGOS_MAX = 50;
export const ATRASO_MINIMO_MIN = 0;
export const ATRASO_MINIMO_MAX = 80;
export const INTENSIDADE_MIN = 1;
export const INTENSIDADE_MAX = 3;
export const INTENSIDADE_PASSO = 0.5;
/** Modo misto: fração do peso para as menos frequentes, 0..1 em passos de 0,25. */
export const PROPORCAO_FRIAS_PASSO = 0.25;

/** Acordeão em que a regra aparece: "Regras do volante" ou "Filtros estatísticos". */
export type GrupoRegra = 'volante' | 'estatistico';

/**
 * Regra (filtro do core) que a tela mostra agora: a loteria a oferece (`regrasDisponiveis`) e ela se aplica ao tamanho
 * de jogo atual. Regra que não se aplica não aparece, não fica desabilitada.
 */
export interface RegraVisivel {
  id: string;
  grupo: GrupoRegra;
  rotulo: string;
  /** Complemento do rótulo, entre parênteses ("(Q1 a Q4)"); vazio quando não há. */
  ajuda: string;
}

/**
 * Único lugar que classifica os filtros do core nos dois acordeões. Filtro novo do core que não esteja aqui cai em
 * "Filtros estatísticos" com o `nome` do próprio filtro, sem mexer na tela.
 */
const GRUPO_DA_REGRA: Readonly<Record<string, GrupoRegra>> = {
  quadrantes: 'volante',
  colunas: 'volante',
  linhas: 'volante',
  historico: 'estatistico',
  pares: 'estatistico',
  consecutivas: 'estatistico',
};

const ROTULO_DA_REGRA: Readonly<Record<string, string>> = {
  quadrantes: 'Pelo menos uma dezena em cada quadrante',
  colunas: 'Dezenas nunca na mesma coluna',
  linhas: 'No máximo 3 dezenas na mesma linha',
  historico: 'Nunca repetir um resultado já sorteado',
  pares: 'Equilíbrio entre pares e ímpares',
  consecutivas: 'No máximo 3 dezenas consecutivas',
};

export interface ModoGeracao {
  id: Estrategia;
  titulo: string;
  /** Nome curto usado no título da saída ("modo atrasadas"). */
  nomeCurto: string;
  descricao: string;
  padrao: boolean;
}

/** Os 4 modos de geração, na ordem do protótipo. */
export const MODOS_GERACAO: readonly ModoGeracao[] = [
  {
    id: 'atrasadas',
    titulo: 'Dezenas atrasadas',
    nomeCurto: 'atrasadas',
    descricao: 'Peso maior para quem está há mais concursos sem sair.',
    padrao: true,
  },
  {
    id: 'frequentes',
    titulo: 'Dezenas frequentes',
    nomeCurto: 'frequentes',
    descricao: 'Peso maior para quem mais saiu numa janela recente.',
    padrao: false,
  },
  {
    id: 'mista',
    titulo: 'Mista',
    nomeCurto: 'mista',
    descricao: 'Divide o peso entre as dezenas que mais saíram e as que menos saíram na janela escolhida.',
    padrao: false,
  },
  {
    id: 'aleatorio',
    titulo: 'Totalmente aleatório',
    nomeCurto: 'aleatório',
    descricao: 'Todas as dezenas com o mesmo peso, como a própria urna.',
    padrao: false,
  },
];

/**
 * Atrasos de exemplo da explicação viva da intensidade, em múltiplos do atraso esperado da loteria
 * (2x, 3x e 4x: 20, 30 e 40 concursos na Mega-Sena; 10, 15 e 20 na Lotomania).
 */
const MULTIPLOS_ATRASO_EXEMPLO = [2, 3, 4] as const;

export interface ExemploIntensidade {
  atraso: number;
  /** Quantas vezes mais chance de entrar no jogo, em relação a uma dezena que acabou de sair. */
  vezes: number;
}

export interface OpcaoJanela {
  valor: JanelaFrequencia;
  rotulo: string;
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

/** "21", "1,8": até 1 casa decimal, vírgula, sem ",0". */
function formatarVezes(valor: number): string {
  return String(Math.round(valor * 10) / 10).replace('.', ',');
}

/** Inteiro com separador de milhar pt-BR ("50.063.860"), sem depender de Intl. */
export function formatarMilhar(valor: number): string {
  return String(Math.round(valor)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Estado da tela "Gerar jogos": configuração da geração (signals), valores derivados para os textos
 * da tela e o último resultado. Vive na raiz para a configuração sobreviver à navegação entre abas.
 *
 * Os signals de configuração são somente leitura; a tela altera pelos métodos `definir*`, que mantêm
 * as invariantes (limites, fixas ≤ dezenas por jogo, "colunas" desligada quando não se aplica).
 */
@Injectable({ providedIn: 'root' })
export class GerarEstado {
  private readonly historicoStore = inject(HistoricoStore);

  readonly loteria = this.historicoStore.loteria;

  /** Id da loteria ativa: a configuração específica de cada loteria reinicia quando ele muda (e só então). */
  private readonly idLoteria = computed(() => this.loteria().id);

  // ---------- Configuração ----------
  private readonly _quantidadeJogos = signal(5);
  /** Reinicia em `aposta.min` ao trocar de loteria (Mega-Sena: 6; Lotomania: 50, aposta fixa). */
  private readonly _dezenasPorJogo = linkedSignal<string, number>({
    source: this.idLoteria,
    computation: () => untracked(() => this.loteria().aposta.min),
  });
  private readonly _estrategia = signal<Estrategia>('atrasadas');
  private readonly _fixas = linkedSignal<string, number[]>({ source: this.idLoteria, computation: () => [] });
  private readonly _atrasoMinimo = linkedSignal<string, number>({
    source: this.idLoteria,
    // Inteiro, como o valor digitado (`definirAtrasoMinimo` arredonda): Lotofácil 25/15 = 1,67 → 2.
    computation: () => untracked(() => Math.round(atrasoEsperado(this.loteria()))),
  });
  private readonly _intensidade = signal(2);
  private readonly _proporcaoFrias = signal(PROPORCAO_FRIAS_PADRAO);
  private readonly _janelaFrequencia = signal<JanelaFrequencia>('50');
  /** Regras ligadas por id. Reinicia ao trocar de loteria: ligadas por padrão só as que se aplicam ao jogo inicial. */
  private readonly _regras = linkedSignal<string, Record<string, boolean>>({
    source: this.idLoteria,
    computation: () =>
      untracked(() => {
        const definicao = this.loteria();
        const aplicaveis = new Set(this.idsAplicaveis(definicao, definicao.aposta.min));
        return Object.fromEntries(
          filtrosPadrao().map((filtro) => [filtro.id, filtro.padraoLigado && aplicaveis.has(filtro.id)]),
        );
      }),
  });

  readonly quantidadeJogos = this._quantidadeJogos.asReadonly();
  readonly dezenasPorJogo = this._dezenasPorJogo.asReadonly();
  readonly estrategia = this._estrategia.asReadonly();
  /** Dezenas escolhidas pelo usuário, em ordem crescente. */
  readonly fixas = this._fixas.asReadonly();
  readonly atrasoMinimo = this._atrasoMinimo.asReadonly();
  readonly intensidade = this._intensidade.asReadonly();
  /** Modo misto: 0 = só as mais frequentes, 1 = só as menos frequentes, 0,5 = metade para cada. */
  readonly proporcaoFrias = this._proporcaoFrias.asReadonly();
  readonly janelaFrequencia = this._janelaFrequencia.asReadonly();
  /** Filtros ligados, por id; os que não se aplicam ao tamanho de jogo atual ficam sempre desligados. */
  readonly regras = this._regras.asReadonly();

  // ---------- Resultado ----------
  // O resultado pertence à loteria em que foi gerado: trocar de loteria limpa a saída.
  private readonly _resultado = linkedSignal<string, ResultadoGeracao | undefined>({
    source: this.idLoteria,
    computation: () => undefined,
  });
  private readonly _configuracaoUsada = linkedSignal<string, ConfiguracaoGeracao | undefined>({
    source: this.idLoteria,
    computation: () => undefined,
  });
  private readonly _concursoBase = linkedSignal<string, number | undefined>({
    source: this.idLoteria,
    computation: () => undefined,
  });

  /** Último resultado da geração (`undefined` antes de gerar e depois de `limpar`). */
  readonly resultado = this._resultado.asReadonly();
  /** Configuração exata que produziu `resultado` (a tela pode ter mudado depois). */
  readonly configuracaoUsada = this._configuracaoUsada.asReadonly();
  /** Último concurso do histórico quando `resultado` foi gerado; os jogos salvos são conferidos com o seguinte. */
  readonly concursoBase = this._concursoBase.asReadonly();

  // ---------- Derivados da loteria e do histórico ----------
  /** Atraso esperado por dezena (Mega-Sena: 10; Lotomania: 5). */
  readonly atrasoReferencia = computed(() => atrasoEsperado(this.loteria()));
  /** `atrasoReferencia` para exibição ("10", "5", "1,7"). */
  readonly atrasoReferenciaTexto = computed(() => formatarAtraso(this.atrasoReferencia()));

  /** Atraso atual de cada dezena (inclusive a 00 da Lotomania) no histórico inteiro; vazio enquanto não há histórico. */
  readonly atrasos = computed<Record<number, number>>(() => {
    const historico = this.historicoStore.historico();
    if (!historico) return {};
    const atrasos: Record<number, number> = {};
    for (const estatistica of calcularEstatisticas(historico, { tipo: 'tudo' })) {
      atrasos[estatistica.dezena] = estatistica.atraso;
    }
    return atrasos;
  });

  /** Ano do último concurso do histórico (ou o ano corrente sem histórico): o "ano atual" da janela. */
  readonly anoReferencia = computed(() => {
    const data = this.historicoStore.ultimo()?.data;
    return data ? Number(data.slice(0, 4)) : new Date().getFullYear();
  });

  readonly opcoesJanela = computed<OpcaoJanela[]>(() => [
    { valor: '50', rotulo: 'últimos 50' },
    { valor: '100', rotulo: 'últimos 100' },
    { valor: 'anoAtual', rotulo: `ano ${this.anoReferencia()}` },
    { valor: 'anoAnterior', rotulo: `ano ${this.anoReferencia() - 1}` },
    { valor: 'tudo', rotulo: 'histórico todo' },
  ]);

  /** Aposta de tamanho fixo (`aposta.min === aposta.max`, ex.: Lotomania): o tamanho não é uma escolha da pessoa. */
  readonly apostaFixa = computed(() => this.loteria().aposta.min === this.loteria().aposta.max);

  /** Combinações (apostas simples) que um jogo de `dezenasPorJogo` dezenas cobre. */
  readonly combinacoes = computed(() => apostasEquivalentes(this.dezenasPorJogo(), this.loteria()));
  readonly combinacoesTexto = computed(() => formatarMilhar(this.combinacoes()));
  /** Nome do prêmio principal como na definição ("Sena", "20 acertos"). */
  readonly nomePremioPrincipal = computed(() => this.loteria().faixas[0]?.nome ?? 'prêmio principal');
  /** "1 em 50.063.860" para 6 dezenas na Mega-Sena. */
  readonly chanceTexto = computed(() => `1 em ${formatarMilhar(chanceUmEm(this.dezenasPorJogo(), this.loteria()))}`);

  /** Ids dos filtros que se aplicam à loteria e ao tamanho de jogo atual, na ordem de `filtrosPadrao()`. */
  readonly regrasAplicaveis = computed(() => this.idsAplicaveis(this.loteria(), this.dezenasPorJogo()));
  /** O jogo usa quadrantes (oferece a regra)? Sem ela, volante e jogos não mostram quadrantes (Lotofácil). */
  readonly usaQuadrantes = computed(() => this.loteria().regrasDisponiveis.includes('quadrantes'));

  /**
   * Regras que a tela mostra: oferecidas pela loteria E aplicáveis ao tamanho de jogo atual. A lista se recompõe quando
   * a loteria ou as dezenas por jogo mudam; é a única fonte dos dois acordeões de regras.
   */
  readonly regrasVisiveis = computed<RegraVisivel[]>(() => {
    const aplicaveis = new Set(this.regrasAplicaveis());
    return filtrosPadrao()
      .filter((filtro) => aplicaveis.has(filtro.id))
      .map((filtro) => ({
        id: filtro.id,
        grupo: GRUPO_DA_REGRA[filtro.id] ?? 'estatistico',
        rotulo: ROTULO_DA_REGRA[filtro.id] ?? filtro.nome,
        ajuda: this.ajudaDaRegra(filtro.id),
      }));
  });
  /** Regras do volante visíveis, na ordem da tela; vazio esconde o acordeão. */
  readonly regrasVolante = computed(() => this.regrasVisiveis().filter((regra) => regra.grupo === 'volante'));
  /** Filtros estatísticos visíveis, na ordem da tela; vazio esconde o acordeão. */
  readonly regrasEstatisticas = computed(() => this.regrasVisiveis().filter((regra) => regra.grupo === 'estatistico'));

  /** "2 a 4 pares em 6". */
  readonly legendaPares = computed(() => {
    const k = this.dezenasPorJogo();
    const minimo = Math.floor(k / 3);
    return `${minimo} a ${k - minimo} pares em ${k}`;
  });

  // ---------- Textos vivos ----------
  /** Intensidade com vírgula decimal ("2", "2,5"). */
  readonly intensidadeRotulo = computed(() => String(this.intensidade()).replace('.', ','));

  /** Peso relativo de 2x, 3x e 4x o atraso esperado (20, 30 e 40 na Mega-Sena) com a intensidade e o atraso mínimo atuais. */
  readonly exemplosIntensidade = computed<ExemploIntensidade[]>(() => {
    const intensidade = this.intensidade();
    const minimo = this.atrasoMinimo();
    const esperado = this.atrasoReferencia();
    return MULTIPLOS_ATRASO_EXEMPLO.map((multiplo) => {
      const atraso = Math.round(multiplo * esperado);
      return { atraso, vezes: Math.round(atraso >= minimo ? 1 + Math.pow(atraso / esperado, intensidade) : 1) };
    });
  });

  /** Explicação viva da intensidade, em texto puro (a tela destaca os números em negrito). */
  readonly textoIntensidade = computed(() => {
    const [a, b, c] = this.exemplosIntensidade();
    return (
      `Com esta intensidade, uma dezena que não sai há ${a.atraso} concursos tem ${a.vezes}× mais chance de entrar no jogo ` +
      `do que uma que acabou de sair; há ${b.atraso} concursos, ${b.vezes}×; há ${c.atraso}, ${c.vezes}×. ` +
      'Quanto maior a intensidade, mais os jogos se concentram nas dezenas mais atrasadas.'
    );
  });

  /** Divisão do modo misto em texto ("metade para cada", "75% para as mais frequentes"). */
  readonly rotuloMista = computed(() => {
    const frias = Math.round(this.proporcaoFrias() * 100);
    if (frias === 50) return 'metade para cada lado';
    if (frias === 0) return 'só as mais frequentes';
    if (frias === 100) return 'só as menos frequentes';
    return frias > 50 ? `${frias}% para as menos frequentes` : `${100 - frias}% para as mais frequentes`;
  });

  /**
   * Peso relativo, na divisão atual do modo misto, da dezena que mais saiu, da do meio e da que menos saiu na janela
   * (em vezes o menor dos três).
   */
  readonly exemplosMista = computed(() => {
    const p = this.proporcaoFrias();
    const [mais, meio, menos] = [1, 0.5, 0].map((posicao) => pesoMista(posicao, p));
    const menor = Math.min(mais, meio, menos);
    const vezes = (peso: number) => formatarVezes(peso / menor);
    return { maisSaiu: vezes(mais), meio: vezes(meio), menosSaiu: vezes(menos) };
  });

  // ---------- Resumos das seções fechadas do acordeão ----------
  readonly resumoModo = computed(() => MODOS_GERACAO.find((modo) => modo.id === this.estrategia())?.titulo ?? '');

  readonly resumoFixas = computed(() => {
    const k = this.dezenasPorJogo();
    const fixas = this.fixas();
    if (!fixas.length) return `nenhuma · o sistema escolhe todas as ${k}`;
    return `${fixas.map(formatarDezena).join(' ')} · o sistema completa ${k - fixas.length}`;
  });

  readonly resumoRegras = computed(
    () => `${this.contarLigadas(this.regrasVolante())} de ${this.regrasVolante().length} ligadas`,
  );
  readonly resumoFiltros = computed(
    () => `${this.contarLigadas(this.regrasEstatisticas())} de ${this.regrasEstatisticas().length} ligados`,
  );

  // ---------- Configuração completa ----------
  readonly configuracao = computed<ConfiguracaoGeracao>(() => ({
    estrategia: this.estrategia(),
    quantidadeJogos: this.quantidadeJogos(),
    dezenasPorJogo: this.dezenasPorJogo(),
    fixas: this.fixas(),
    atrasadas: { atrasoMinimo: this.atrasoMinimo(), intensidade: this.intensidade() },
    frequentes: { periodo: this.periodoDe(this.janelaFrequencia()) },
    mista: { proporcaoFrias: this.proporcaoFrias() },
    regras: this.regras(),
  }));

  // ---------- Derivados do resultado ----------
  readonly jogos = computed(() => this.resultado()?.jogos ?? []);
  readonly temJogos = computed(() => this.jogos().length > 0);
  /** A geração rodou e nenhum jogo passou pelas regras e filtros. */
  readonly semJogos = computed(() => this.resultado() !== undefined && !this.temJogos());
  /** Saiu menos jogos do que o pedido (os filtros impediram o restante). */
  readonly faltaramJogos = computed(() => this.temJogos() && this.resultado()?.incompleto === true);
  /** Quantidade de jogos pedida na geração que está na tela. */
  readonly quantidadeSolicitada = computed(() => this.configuracaoUsada()?.quantidadeJogos ?? 0);
  /** Dezenas fixas da geração que está na tela (recebem o anel nas bolas). */
  readonly fixasDaGeracao = computed(() => this.configuracaoUsada()?.fixas ?? []);

  /** "5 jogos · 6 dezenas · modo atrasadas". */
  readonly tituloSaida = computed(() => {
    const config = this.configuracaoUsada();
    const quantidade = this.jogos().length;
    if (!config || !quantidade) return 'Jogos gerados';
    const modo = MODOS_GERACAO.find((m) => m.id === config.estrategia)?.nomeCurto ?? config.estrategia;
    return `${quantidade} jogo${quantidade > 1 ? 's' : ''} · ${config.dezenasPorJogo} dezenas · modo ${modo}`;
  });

  /** Texto para copiar/exportar: uma linha "Jogo 01: 03 06 32 42 46 51" por jogo. */
  readonly textoJogos = computed(() =>
    this.jogos()
      .map((jogo, i) => `Jogo ${String(i + 1).padStart(2, '0')}: ${jogo.dezenas.map(formatarDezena).join(' ')}`)
      .join('\n'),
  );

  /** Jogos da tela no formato do repositório "Meus jogos". */
  readonly jogosParaSalvar = computed<Omit<JogoSalvo, 'id' | 'criadoEm'>[]>(() => {
    const config = this.configuracaoUsada();
    if (!config) return [];
    return this.jogos().map((jogo) => ({
      loteriaId: this.loteria().id,
      dezenas: [...jogo.dezenas],
      estrategia: config.estrategia,
      concursoBase: this._concursoBase() ?? 0,
    }));
  });

  // ---------- Ações ----------
  definirQuantidadeJogos(valor: number): void {
    this._quantidadeJogos.set(limitar(Math.round(valor), QUANTIDADE_JOGOS_MIN, QUANTIDADE_JOGOS_MAX));
  }

  /**
   * Altera as dezenas por jogo: apara as fixas ao novo limite e desliga as regras que deixam de se aplicar (elas somem
   * da tela). Em aposta fixa (Lotomania) o valor sempre volta ao tamanho único.
   */
  definirDezenasPorJogo(valor: number): void {
    const { min, max } = this.loteria().aposta;
    const k = limitar(Math.round(valor), min, max);
    this._dezenasPorJogo.set(k);
    this._fixas.update((fixas) => (fixas.length > k ? fixas.slice(0, k) : fixas));
    const aplicaveis = new Set(this.regrasAplicaveis());
    if (Object.entries(this._regras()).some(([id, ligada]) => ligada && !aplicaveis.has(id))) {
      this._regras.update((regras) =>
        Object.fromEntries(Object.entries(regras).map(([id, ligada]) => [id, ligada && aplicaveis.has(id)])),
      );
    }
  }

  definirEstrategia(estrategia: Estrategia): void {
    this._estrategia.set(estrategia);
  }

  /** Normaliza: dezenas válidas e distintas, na ordem do volante, no máximo `dezenasPorJogo`. */
  definirFixas(dezenas: number[]): void {
    const definicao = this.loteria();
    const validas = [...new Set(dezenas)]
      .filter((dezena) => dezenaValida(dezena, definicao))
      .sort(compararDezenas(definicao));
    this._fixas.set(validas.slice(0, this.dezenasPorJogo()));
  }

  definirAtrasoMinimo(valor: number): void {
    this._atrasoMinimo.set(limitar(Math.round(valor), ATRASO_MINIMO_MIN, ATRASO_MINIMO_MAX));
  }

  /** Intensidade 1..3 em passos de 0,5. */
  definirIntensidade(valor: number): void {
    const arredondada = Math.round(valor / INTENSIDADE_PASSO) * INTENSIDADE_PASSO;
    this._intensidade.set(limitar(arredondada, INTENSIDADE_MIN, INTENSIDADE_MAX));
  }

  /** Proporção do modo misto, 0..1 em passos de 0,25. */
  definirProporcaoFrias(valor: number): void {
    const arredondada = Math.round(valor / PROPORCAO_FRIAS_PASSO) * PROPORCAO_FRIAS_PASSO;
    this._proporcaoFrias.set(limitar(arredondada, 0, 1));
  }

  definirJanelaFrequencia(janela: JanelaFrequencia): void {
    this._janelaFrequencia.set(janela);
  }

  /** Liga ou desliga uma regra; ligar uma regra que não se aplica (oculta na tela) é ignorado. */
  definirRegra(id: string, ligada: boolean): void {
    if (ligada && !this.regrasAplicaveis().includes(id)) return;
    this._regras.update((regras) => ({ ...regras, [id]: ligada }));
  }

  /**
   * Gera os jogos com o histórico em cache. Sem histórico não há o que gerar e nada muda (devolve `undefined`).
   * `rng` injetável para testes determinísticos.
   */
  gerar(rng: Rng = rngPadrao()): ResultadoGeracao | undefined {
    const historico = this.historicoStore.historico();
    if (!historico) return undefined;
    const configuracao = this.configuracao();
    const resultado = gerarJogos(historico, configuracao, rng);
    this._configuracaoUsada.set(configuracao);
    this._concursoBase.set(historico.concursos[historico.concursos.length - 1]?.numero);
    this._resultado.set(resultado);
    return resultado;
  }

  /** Limpa só a saída; a configuração fica como está. */
  limpar(): void {
    this._resultado.set(undefined);
    this._configuracaoUsada.set(undefined);
    this._concursoBase.set(undefined);
  }

  private contarLigadas(regrasDoGrupo: readonly RegraVisivel[]): number {
    const regras = this.regras();
    return regrasDoGrupo.filter((regra) => regras[regra.id]).length;
  }

  /**
   * Ids dos filtros oferecidos pela loteria que se aplicam ao tamanho de jogo `k`. Quem decide é o próprio filtro
   * (`aplicavelA`): é ele que sabe, por exemplo, que "linhas" é impossível com mais de 3 × linhas dezenas.
   */
  private idsAplicaveis(definicao: LoteriaDefinicao, k: number): string[] {
    return filtrosPadrao()
      .filter(
        (filtro) => definicao.regrasDisponiveis.includes(filtro.id) && filtro.aplicavelA(definicao, k),
      )
      .map((filtro) => filtro.id);
  }

  private ajudaDaRegra(id: string): string {
    switch (id) {
      case 'quadrantes':
        return '(Q1 a Q4)';
      case 'colunas':
        return `(${this.loteria().volante.colunas} colunas)`;
      case 'pares':
        return `(${this.legendaPares()})`;
      default:
        return '';
    }
  }

  private periodoDe(janela: JanelaFrequencia): Periodo {
    switch (janela) {
      case '50':
        return { tipo: 'ultimos', quantidade: 50 };
      case '100':
        return { tipo: 'ultimos', quantidade: 100 };
      case 'anoAtual':
        return { tipo: 'ano', ano: this.anoReferencia() };
      case 'anoAnterior':
        return { tipo: 'ano', ano: this.anoReferencia() - 1 };
      case 'tudo':
        return { tipo: 'tudo' };
    }
  }
}
