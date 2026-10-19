import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import {
  atrasoEsperado,
  calcularEstatisticas,
  dezenaNaOrdem,
  distribuicaoPares,
  distribuicaoSoma,
  formatarAtraso,
  formatarDezena,
  frequenciaPorMes,
  ordemNoVolante,
  recortarPeriodo,
} from '@sorteios/core';
import type { EstatisticaDezena, Periodo } from '@sorteios/core';
import {
  GraficoBarrasHorizontaisComponent,
  GraficoBarrasVerticaisComponent,
  GraficoColunasComponent,
  KpiComponent,
  ListaBarrasComponent,
  MapaCalorComponent,
  SegmentoComponent,
  formatarDataBR,
} from '@sorteios/ui';
import type {
  ItemBarraHorizontal,
  ItemBarraVertical,
  ItemColuna,
  ItemListaBarras,
  LinhaMapaCalor,
  OpcaoSegmento,
} from '@sorteios/ui';
import { HistoricoStore } from '../dados/historico.store';

type ChavePeriodo = 'ult50' | 'ult100' | 'ano-atual' | 'ano-anterior' | 'tudo';
type OrdemFrequencia = 'dezena' | 'total';

const DESTAQUES_FREQUENCIA = 5;
const ITENS_ATRASO = 15;
const ITENS_LISTA = 8;
const MESES_MAPA_CALOR = 12;
const FAIXA_SOMA = 20;

const FORMATADOR_INTEIRO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const FORMATADOR_DECIMAL = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const FORMATADOR_DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const OPCOES_ORDEM: readonly OpcaoSegmento[] = [
  { valor: 'dezena', rotulo: 'por dezena' },
  { valor: 'total', rotulo: 'por total' },
];

interface KpiEstatistica {
  titulo: string;
  valor: string;
  detalhe: string;
}

/** A partir de quantas dezenas o mapa de calor deixa de caber na tela e ganha rolagem horizontal (Lotomania: 100). */
const UNIVERSO_MAPA_COM_ROLAGEM = 60;
const LARGURA_MINIMA_COLUNA_MAPA = 10;

function itemLista(estatistica: EstatisticaDezena): ItemListaBarras {
  return {
    rotulo: formatarDezena(estatistica.dezena),
    valor: estatistica.frequencia,
    valorTexto: `${estatistica.frequencia}×`,
    bola: estatistica.dezena,
  };
}

/** Mais frequente primeiro; empate pela dezena menor. */
function porFrequenciaDecrescente(a: EstatisticaDezena, b: EstatisticaDezena): number {
  return b.frequencia - a.frequencia || a.dezena - b.dezena;
}

/** Mais atrasada primeiro; empate pela dezena menor. */
function porAtrasoDecrescente(a: EstatisticaDezena, b: EstatisticaDezena): number {
  return b.atraso - a.atraso || a.dezena - b.dezena;
}

/** Aba "Estatísticas das dezenas": filtro de período, KPIs e gráficos calculados no cliente com o core. */
@Component({
  selector: 'srt-estatisticas-page',
  imports: [
    IonContent,
    GraficoBarrasHorizontaisComponent,
    GraficoBarrasVerticaisComponent,
    GraficoColunasComponent,
    KpiComponent,
    ListaBarrasComponent,
    MapaCalorComponent,
    SegmentoComponent,
  ],
  templateUrl: './estatisticas.page.html',
  styleUrl: './estatisticas.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstatisticasPage implements OnInit {
  private readonly _store = inject(HistoricoStore);

  protected readonly loteria = this._store.loteria;
  protected readonly historico = this._store.historico;
  protected readonly carregando = this._store.carregando;
  protected readonly erro = this._store.erro;

  protected readonly temDados = computed(() => (this._store.historico()?.concursos.length ?? 0) > 0);

  /** Período escolhido no filtro (padrão: últimos 50). */
  protected readonly chavePeriodo = signal<string>('ult50');
  protected readonly chaveOrdem = signal<string>('dezena');
  protected readonly opcoesOrdem = OPCOES_ORDEM;

  /** Ano do último concurso do histórico (base de "ano atual" e "ano anterior"). */
  private readonly _anoAtual = computed(() => {
    const ultimo = this._store.ultimo();
    return ultimo ? Number(ultimo.data.slice(0, 4)) : new Date().getFullYear();
  });

  protected readonly opcoesPeriodo = computed<OpcaoSegmento[]>(() => [
    { valor: 'ult50', rotulo: 'Últimos 50' },
    { valor: 'ult100', rotulo: 'Últimos 100' },
    { valor: 'ano-atual', rotulo: String(this._anoAtual()) },
    { valor: 'ano-anterior', rotulo: String(this._anoAtual() - 1) },
    { valor: 'tudo', rotulo: 'Histórico' },
  ]);

  private readonly _periodo = computed<Periodo>(() => {
    switch (this.chavePeriodo() as ChavePeriodo) {
      case 'ult100':
        return { tipo: 'ultimos', quantidade: 100 };
      case 'ano-atual':
        return { tipo: 'ano', ano: this._anoAtual() };
      case 'ano-anterior':
        return { tipo: 'ano', ano: this._anoAtual() - 1 };
      case 'tudo':
        return { tipo: 'tudo' };
      default:
        return { tipo: 'ultimos', quantidade: 50 };
    }
  });

  /** Descrição do período para subtítulos e KPIs ("últimos 50 concursos", "ano de 2026"...). */
  protected readonly textoPeriodo = computed(() => {
    const periodo = this._periodo();
    switch (periodo.tipo) {
      case 'ultimos':
        return `últimos ${periodo.quantidade} concursos`;
      case 'ano':
        return `ano de ${periodo.ano}`;
      case 'tudo': {
        const primeiro = this._store.historico()?.concursos[0];
        return primeiro ? `histórico completo desde ${primeiro.data.slice(0, 4)}` : 'histórico completo';
      }
    }
  });

  private readonly _concursosNoPeriodo = computed(() => {
    const historico = this._store.historico();
    return historico ? recortarPeriodo(historico, this._periodo()).concursos.length : 0;
  });

  protected readonly periodoVazio = computed(() => this.temDados() && this._concursosNoPeriodo() === 0);

  /** Frequência no período; atraso e atraso máximo sempre no histórico inteiro. */
  private readonly _estatisticas = computed<EstatisticaDezena[]>(() => {
    const historico = this._store.historico();
    return historico ? calcularEstatisticas(historico, this._periodo()) : [];
  });

  protected readonly atrasoEsperadoConcursos = computed(() => atrasoEsperado(this._store.loteria()));
  protected readonly atrasoEsperadoTexto = computed(() => formatarAtraso(this.atrasoEsperadoConcursos()));

  protected readonly kpis = computed<KpiEstatistica[]>(() => {
    const estatisticas = this._estatisticas();
    if (estatisticas.length === 0) return [];
    const { universo, sorteadas } = this._store.loteria();
    const concursos = this._concursosNoPeriodo();

    const porFrequencia = [...estatisticas].sort(porFrequenciaDecrescente);
    const maisSorteada = porFrequencia[0];
    const menosSorteada = porFrequencia[porFrequencia.length - 1];
    const maisAtrasada = [...estatisticas].sort(porAtrasoDecrescente)[0];

    const somaFrequencias = estatisticas.reduce((soma, e) => soma + e.frequencia, 0);
    const media = somaFrequencias / universo;
    const esperado = (concursos * sorteadas) / universo;
    const percentual = Math.round((100 * sorteadas) / universo);

    return [
      { titulo: 'Concursos no período', valor: FORMATADOR_INTEIRO.format(concursos), detalhe: this.textoPeriodo() },
      {
        titulo: 'Média por dezena',
        valor: `${FORMATADOR_DECIMAL.format(media)}×`,
        detalhe: `esperado: ${FORMATADOR_DECIMAL.format(esperado)}× (${percentual}% dos concursos)`,
      },
      {
        titulo: 'Mais sorteada',
        valor: formatarDezena(maisSorteada.dezena),
        detalhe: `${maisSorteada.frequencia}× no período · menos sorteada: ${formatarDezena(menosSorteada.dezena)} (${menosSorteada.frequencia}×)`,
      },
      {
        titulo: 'Mais atrasada',
        valor: formatarDezena(maisAtrasada.dezena),
        detalhe: `${maisAtrasada.atraso} ${maisAtrasada.atraso === 1 ? 'concurso' : 'concursos'} sem sair${
          maisAtrasada.ultimaData ? ` · desde ${formatarDataBR(maisAtrasada.ultimaData)}` : ''
        }`,
      },
    ];
  });

  protected readonly subtituloFrequencia = computed(() => `vezes que cada dezena saiu · ${this.textoPeriodo()}`);

  /** 60 itens; as 5 mais e as 5 menos sorteadas em destaque; ordem por dezena ou por total. */
  protected readonly itensFrequencia = computed<ItemBarraVertical[]>(() => {
    const estatisticas = this._estatisticas();
    const porFrequencia = [...estatisticas].sort(porFrequenciaDecrescente);
    const destacadas = new Set(
      [...porFrequencia.slice(0, DESTAQUES_FREQUENCIA), ...porFrequencia.slice(-DESTAQUES_FREQUENCIA)].map((e) => e.dezena),
    );
    const base = this.chaveOrdem() === 'total' ? porFrequencia : estatisticas;
    return base.map((e) => ({
      rotulo: formatarDezena(e.dezena),
      valor: e.frequencia,
      destaque: destacadas.has(e.dezena),
      dica: `dezena <b>${formatarDezena(e.dezena)}</b>: ${e.frequencia}× no período`,
    }));
  });

  /** As 15 dezenas mais atrasadas hoje (atraso medido no histórico inteiro). */
  protected readonly itensAtraso = computed<ItemBarraHorizontal[]>(() =>
    [...this._estatisticas()]
      .sort(porAtrasoDecrescente)
      .slice(0, ITENS_ATRASO)
      .map((e) => ({
        rotulo: formatarDezena(e.dezena),
        valor: e.atraso,
        dica:
          `dezena <b>${formatarDezena(e.dezena)}</b>: ${e.atraso} ${e.atraso === 1 ? 'concurso' : 'concursos'} sem sair` +
          (e.ultimoConcurso !== undefined && e.ultimaData
            ? `<br>última vez no ${e.ultimoConcurso} (${formatarDataBR(e.ultimaData)})`
            : ''),
      })),
  );

  protected readonly maisSorteadas = computed<ItemListaBarras[]>(() =>
    [...this._estatisticas()].sort(porFrequenciaDecrescente).slice(0, ITENS_LISTA).map(itemLista),
  );

  /** Maior frequência da lista "Mais sorteadas": escala comum às duas listas, como no protótipo. */
  protected readonly maximoMaisSorteadas = computed(() => this.maisSorteadas()[0]?.valor);

  /** Da menos sorteada para a mais sorteada (a menos sorteada primeiro). */
  protected readonly menosSorteadas = computed<ItemListaBarras[]>(() =>
    [...this._estatisticas()].sort(porFrequenciaDecrescente).slice(-ITENS_LISTA).reverse().map(itemLista),
  );

  /** Mapa de calor dezena × mês: últimos 12 meses do histórico (independe do filtro de período). */
  protected readonly mapaCalor = computed(() => {
    const historico = this._store.historico();
    const dados = historico ? frequenciaPorMes(historico, MESES_MAPA_CALOR) : [];
    const meses = [...new Set(dados.map((d) => d.anoMes))];
    const linhas: LinhaMapaCalor[] = meses.map((anoMes) => ({ chave: anoMes, rotulo: anoMes.slice(2).replace('-', '/') }));
    // As colunas do mapa seguem o volante, numeradas de 1: a 01 é a coluna 1 e o 00 da Lotomania é a última (100).
    const def = this._store.loteria();
    const valores = new Map<string, number>(dados.map((d) => [`${d.anoMes}|${ordemNoVolante(d.dezena, def)}`, d.total]));
    return { linhas, valores };
  });

  /** Cabeçalho de cada coluna do mapa de calor: a dezena que ela representa ("01".."60" ou "01".."99", "00"). */
  protected readonly rotuloColunaMapa = computed(() => {
    const def = this._store.loteria();
    return (coluna: number) => formatarDezena(dezenaNaOrdem(coluna, def));
  });

  /** Com muitas dezenas (Lotomania), o mapa mantém células legíveis e rola na horizontal em telas estreitas. */
  protected readonly larguraMinimaColunaMapa = computed(() =>
    this._store.loteria().universo > UNIVERSO_MAPA_COM_ROLAGEM ? LARGURA_MINIMA_COLUNA_MAPA : undefined,
  );

  protected readonly itensPares = computed<ItemColuna[]>(() => {
    const historico = this._store.historico();
    if (!historico) return [];
    const { sorteadas } = historico.loteria;
    return distribuicaoPares(historico).map((d) => ({
      rotulo: `${d.pares}p`,
      valor: d.total,
      dica: `${d.pares} pares / ${sorteadas - d.pares} ímpares: <b>${FORMATADOR_INTEIRO.format(d.total)}</b> concursos`,
    }));
  });

  protected readonly itensSoma = computed<ItemColuna[]>(() => {
    const historico = this._store.historico();
    if (!historico) return [];
    return distribuicaoSoma(historico, FAIXA_SOMA).map((f) => ({
      rotulo: String(f.inicio),
      valor: f.total,
      dica: `soma entre ${f.inicio} e ${f.inicio + FAIXA_SOMA - 1}: <b>${FORMATADOR_INTEIRO.format(f.total)}</b> concursos`,
    }));
  });

  protected readonly notasRodape = computed(() => {
    const notas = ['Fonte: resultados oficiais da Caixa Econômica Federal, servidos pela API do Sorteios.'];
    const atualizadoEm = this._store.atualizadoEm();
    if (atualizadoEm) {
      const data = new Date(atualizadoEm);
      if (!Number.isNaN(data.getTime())) notas.push(`Atualizado em ${FORMATADOR_DATA_HORA.format(data)}.`);
    }
    if (this._store.somenteCache()) {
      notas.push('Dados do cache: sem confirmação da rede nesta sessão.');
    }
    return notas;
  });

  ngOnInit(): void {
    // O estado de falha fica em `erro()`; a rejeição não precisa vazar para o console.
    this._store.carregar().catch(() => undefined);
  }

  protected tentarNovamente(): void {
    this._store.atualizar().catch(() => undefined);
  }
}
