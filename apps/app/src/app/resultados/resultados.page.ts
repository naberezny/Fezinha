import { ChangeDetectionStrategy, Component, OnInit, computed, inject, linkedSignal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { resumoPorAno } from '@sorteios/core';
import type { Concurso } from '@sorteios/core';
import {
  GraficoColunasComponent,
  KpiComponent,
  ListaBarrasComponent,
  TabelaResultadosComponent,
  formatarDataBR,
  formatarReais,
} from '@sorteios/ui';
import type { ItemColuna, ItemListaBarras } from '@sorteios/ui';
import { HistoricoStore } from '../dados/historico.store';

/** Primeiro ano exibido nos gráficos anuais (igual ao protótipo aprovado). */
const ANO_INICIAL_GRAFICOS = 2016;
const CONCURSOS_POR_PAGINA = 50;
const MAXIMO_UF = 10;
const MAXIMO_PREMIOS = 8;

const FORMATADOR_INTEIRO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const FORMATADOR_DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

interface KpiResultado {
  titulo: string;
  valor: string;
  detalhe: string;
}

/** Tela "Todos os resultados" do jogo: KPIs, tabela paginada (50 por página) e gráficos, calculados no cliente. */
@Component({
  selector: 'srt-resultados-page',
  imports: [
    IonContent,
    KpiComponent,
    TabelaResultadosComponent,
    GraficoColunasComponent,
    ListaBarrasComponent,
  ],
  templateUrl: './resultados.page.html',
  styleUrl: './resultados.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultadosPage implements OnInit {
  private readonly _store = inject(HistoricoStore);

  protected readonly loteria = this._store.loteria;
  protected readonly historico = this._store.historico;
  protected readonly carregando = this._store.carregando;
  protected readonly erro = this._store.erro;

  /** Verdadeiro quando já há ao menos um concurso para mostrar (do cache ou da rede). */
  protected readonly temDados = computed(() => (this._store.historico()?.concursos.length ?? 0) > 0);

  private readonly _concursos = computed<readonly Concurso[]>(() => this._store.historico()?.concursos ?? []);
  private readonly _resumosAnuais = computed(() => {
    const historico = this._store.historico();
    return historico ? resumoPorAno(historico) : [];
  });

  /** Página da tabela (0 = a mais recente); volta à primeira ao trocar de loteria (cada uma tem outra quantidade de concursos). */
  protected readonly pagina = linkedSignal<string, number>({ source: () => this.loteria().id, computation: () => 0 });

  /** Nome do prêmio principal da loteria ativa, como na definição ("Sena", "20 acertos"). */
  protected readonly nomePrincipal = computed(() => this.loteria().faixas[0]?.nome ?? 'prêmio principal');
  /** Acertos do prêmio principal (Mega-Sena: 6; Lotomania: 20). */
  protected readonly acertosPrincipal = computed(() => this.loteria().faixas[0]?.acertos ?? this.loteria().sorteadas);

  protected readonly resumoTexto = computed(() => {
    const concursos = this._concursos();
    if (concursos.length === 0) return '';
    return `${FORMATADOR_INTEIRO.format(concursos.length)} concursos desde ${formatarDataBR(concursos[0].data)}`;
  });

  protected readonly kpis = computed<KpiResultado[]>(() => {
    const concursos = this._concursos();
    const ultimo = this._store.ultimo();
    if (!ultimo) return [];

    let sequencia = 0;
    for (let i = concursos.length - 1; i >= 0 && concursos[i].acumulou; i--) sequencia++;

    const ano = Number(ultimo.data.slice(0, 4));
    const resumoAno = this._resumosAnuais().find((r) => r.ano === ano);
    const ganhadoresUltimo = ultimo.premiacoes.find((p) => p.faixa === 1)?.ganhadores ?? 0;

    return [
      {
        titulo: 'Último concurso',
        valor: String(ultimo.numero),
        detalhe: `${formatarDataBR(ultimo.data)} · ${ultimo.acumulou ? 'acumulou' : `${ganhadoresUltimo} ganhador(es)`}`,
      },
      {
        titulo: 'Acumulado atual',
        valor: formatarReais(ultimo.valorAcumuladoCentavos),
        detalhe: `${sequencia} ${sequencia === 1 ? 'concurso seguido' : 'concursos seguidos'} sem ganhador`,
      },
      {
        titulo: 'Estimativa do próximo',
        valor: formatarReais(ultimo.estimativaProximoCentavos),
        detalhe: `concurso ${ultimo.numero + 1}`,
      },
      {
        titulo: `Ganhadores (${this.nomePrincipal()}) em ${ano}`,
        valor: String(resumoAno?.ganhadores ?? 0),
        detalhe: `${resumoAno?.acumulados ?? 0} de ${resumoAno?.concursos ?? 0} concursos acumularam`,
      },
    ];
  });

  protected readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this._concursos().length / CONCURSOS_POR_PAGINA)));

  /** A página atual de 50 concursos, do mais recente ao mais antigo. */
  protected readonly concursosTabela = computed<Concurso[]>(() => {
    const concursos = this._concursos();
    const total = concursos.length;
    const inicio = this.pagina() * CONCURSOS_POR_PAGINA;
    const fim = Math.min(inicio + CONCURSOS_POR_PAGINA, total);
    const pagina: Concurso[] = [];
    for (let i = inicio; i < fim; i++) pagina.push(concursos[total - 1 - i]);
    return pagina;
  });

  protected readonly subtituloTabela = computed(
    () =>
      `todos os ${FORMATADOR_INTEIRO.format(this._concursos().length)} concursos · ${CONCURSOS_POR_PAGINA} por página, do mais recente ao mais antigo`,
  );

  protected readonly acumuladosPorAno = computed<ItemColuna[]>(() =>
    this._resumosAnuais()
      .filter((r) => r.ano >= ANO_INICIAL_GRAFICOS)
      .map((r) => ({
        rotulo: String(r.ano).slice(2),
        valor: r.acumulados,
        dica: `${r.ano}: <b>${r.acumulados}</b> de ${r.concursos}`,
      })),
  );

  protected readonly ganhadoresPorAno = computed<ItemColuna[]>(() =>
    this._resumosAnuais()
      .filter((r) => r.ano >= ANO_INICIAL_GRAFICOS)
      .map((r) => ({
        rotulo: String(r.ano).slice(2),
        valor: r.ganhadores,
        dica: `${r.ano}: <b>${r.ganhadores}</b> apostas premiadas`,
      })),
  );

  /** Soma de `quantidade` por UF em todos os `locaisGanhadores`; ignora locais sem UF (ex.: canal eletrônico). */
  protected readonly ganhadoresPorUf = computed<ItemListaBarras[]>(() => {
    const porUf = new Map<string, number>();
    for (const concurso of this._concursos()) {
      for (const local of concurso.locaisGanhadores) {
        const uf = local.uf?.trim().toUpperCase();
        if (!uf || !/^[A-Z]{2}$/.test(uf)) continue;
        porUf.set(uf, (porUf.get(uf) ?? 0) + local.quantidade);
      }
    }
    return [...porUf.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAXIMO_UF)
      .map(([uf, quantidade]) => ({ rotulo: uf, valor: quantidade }));
  });

  /** Maiores rateios do prêmio principal por aposta vencedora: rótulo "2150 05/2019". */
  protected readonly maioresPremios = computed<ItemListaBarras[]>(() => {
    const premiados: { numero: number; data: string; rateio: bigint }[] = [];
    for (const concurso of this._concursos()) {
      const principal = concurso.premiacoes.find((p) => p.faixa === 1);
      if (principal && principal.ganhadores > 0 && principal.rateioCentavos > BigInt(0)) {
        premiados.push({ numero: concurso.numero, data: concurso.data, rateio: principal.rateioCentavos });
      }
    }
    premiados.sort((a, b) => (a.rateio > b.rateio ? -1 : a.rateio < b.rateio ? 1 : b.numero - a.numero));
    return premiados.slice(0, MAXIMO_PREMIOS).map((p) => ({
      rotulo: `${p.numero} ${formatarDataBR(p.data).slice(3)}`,
      valor: Number(p.rateio),
      valorTexto: formatarReais(p.rateio),
    }));
  });

  /** Linhas do rodapé: fonte dos dados, momento da atualização e aviso de dados vindos só do cache. */
  protected readonly notasRodape = computed(() => {
    const notas = ['Fonte: resultados oficiais da Caixa Econômica Federal, servidos pela API do Sorteios. Este app não é afiliado à Caixa Econômica Federal e não realiza apostas.'];
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

  protected paginaAnterior(): void {
    this.pagina.update((p) => Math.max(0, p - 1));
  }

  protected proximaPagina(): void {
    this.pagina.update((p) => Math.min(this.totalPaginas() - 1, p + 1));
  }

  protected tentarNovamente(): void {
    this._store.atualizar().catch(() => undefined);
  }
}
