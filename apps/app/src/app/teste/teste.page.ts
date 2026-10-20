import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, linkedSignal, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { executarTesteEstrategias, vereditoDe } from '@sorteios/core';
import type { EstrategiaTestada, ResultadoTesteEstrategias, Veredito } from '@sorteios/core';
import { KpiComponent, SegmentoComponent } from '@sorteios/ui';
import type { OpcaoSegmento } from '@sorteios/ui';
import { HistoricoStore } from '../dados/historico.store';

type ChaveJanela = '100' | '500' | '1000' | 'tudo';

/** Concursos iniciais que nunca são testados: as estratégias precisam de algum histórico para ter o que pesar. */
export const AQUECIMENTO = 100;
/** Jogos por estratégia em cada concurso testado. */
export const JOGOS_POR_CONCURSO = 10;
/** Tempo máximo de cálculo seguido antes de devolver a vez à tela (ms). */
const FATIA_MS = 40;

const OPCOES_JANELA: readonly OpcaoSegmento[] = [
  { valor: '100', rotulo: 'Últimos 100' },
  { valor: '500', rotulo: 'Últimos 500' },
  { valor: '1000', rotulo: 'Últimos 1.000' },
  { valor: 'tudo', rotulo: 'Histórico' },
];

const NOMES: Record<EstrategiaTestada, { nome: string; curto: string; descricao: string }> = {
  aleatorio: { nome: 'Totalmente aleatório', curto: 'Aleatório', descricao: 'todas as dezenas com o mesmo peso' },
  atrasadas: { nome: 'Dezenas atrasadas', curto: 'Atrasadas', descricao: 'peso maior para quem está há mais tempo sem sair' },
  frequentes: { nome: 'Dezenas frequentes', curto: 'Frequentes', descricao: 'peso maior para quem mais saiu nos últimos 50' },
  mista: { nome: 'Mista', curto: 'Mista', descricao: 'metade do peso para as que mais saíram, metade para as que menos' },
  ritmo: {
    nome: 'Ritmo de cada dezena',
    curto: 'Ritmo',
    descricao: 'peso maior para quem já está fora há mais tempo do que costuma ficar',
  },
};

const FORMATADOR_INTEIRO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const FORMATADOR_ACERTOS = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const FORMATADOR_DIFERENCA = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
  signDisplay: 'exceptZero',
});
const FORMATADOR_PERCENTUAL = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface LinhaResultado {
  estrategia: EstrategiaTestada;
  nome: string;
  curto: string;
  descricao: string;
  acertos: string;
  diferenca: string;
  margem: string;
  premiados: string;
  veredito: Veredito;
  vereditoTexto: string;
}

const TEXTO_VEREDITO: Record<Veredito, string> = {
  dentro: 'dentro do acaso',
  acima: 'acima do acaso',
  abaixo: 'abaixo do acaso',
};

/** Gráfico de intervalos: ponto na média de acertos, traço de ± margem, linha vertical no acaso. */
const LARGURA = 560;
const MARGEM_ESQ = 92;
const MARGEM_DIR = 16;
const ALTURA_LINHA = 30;
const TOPO = 8;
const RODAPE = 26;

/**
 * Aba "Teste": roda o teste das estratégias (`executarTesteEstrategias` do core) sobre o histórico da loteria ativa,
 * em fatias para a tela não travar, e compara cada estratégia com o acaso.
 */
@Component({
  selector: 'srt-teste-page',
  imports: [IonContent, KpiComponent, SegmentoComponent],
  templateUrl: './teste.page.html',
  styleUrl: './teste.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestePage implements OnInit, OnDestroy {
  private readonly _store = inject(HistoricoStore);

  protected readonly loteria = this._store.loteria;
  protected readonly historico = this._store.historico;
  protected readonly carregando = this._store.carregando;
  protected readonly erro = this._store.erro;
  protected readonly temDados = computed(() => (this._store.historico()?.concursos.length ?? 0) > AQUECIMENTO);

  protected readonly opcoesJanela = OPCOES_JANELA;
  protected readonly jogosPorConcurso = JOGOS_POR_CONCURSO;
  protected readonly aquecimento = AQUECIMENTO;
  protected readonly chaveJanela = signal<string>('500');

  private readonly _idLoteria = computed(() => this._store.loteria().id);
  /** O resultado pertence à loteria em que foi calculado: trocar de loteria limpa a tela. */
  protected readonly resultado = linkedSignal<string, ResultadoTesteEstrategias | undefined>({
    source: this._idLoteria,
    computation: () => undefined,
  });
  protected readonly executando = linkedSignal<string, boolean>({ source: this._idLoteria, computation: () => false });
  protected readonly progresso = signal(0);
  protected readonly progressoTexto = computed(() => `${Math.round(this.progresso() * 100)}%`);

  /** Cada execução ganha um número; uma execução antiga que perceber que não é mais a atual para sozinha. */
  private _execucao = 0;
  /** Semente da próxima execução: rodar de novo sorteia jogos diferentes e mostra quanto o resultado varia. */
  private _semente = 1;

  /** Concursos que a janela escolhida testa (sempre deixando o aquecimento de fora). */
  protected readonly concursosATestar = computed(() => {
    const total = this._store.historico()?.concursos.length ?? 0;
    const disponiveis = Math.max(total - AQUECIMENTO, 0);
    const chave = this.chaveJanela() as ChaveJanela;
    return chave === 'tudo' ? disponiveis : Math.min(Number(chave), disponiveis);
  });

  protected readonly dezenasPorJogo = computed(() => this._store.loteria().aposta.min);

  protected readonly kpis = computed(() => {
    const resultado = this.resultado();
    if (!resultado) return [];
    const { acaso } = resultado;
    const linhas = this.linhas();
    const fora = linhas.filter((l) => l.veredito !== 'dentro');
    const jogos = resultado.concursosTestados * resultado.jogosPorConcurso;
    return [
      {
        titulo: 'Concursos testados',
        valor: FORMATADOR_INTEIRO.format(resultado.concursosTestados),
        detalhe: `do ${resultado.primeiroConcurso} ao ${resultado.ultimoConcurso}`,
      },
      {
        titulo: 'Jogos por estratégia',
        valor: FORMATADOR_INTEIRO.format(jogos),
        detalhe: `${resultado.jogosPorConcurso} por concurso, de ${resultado.dezenasPorJogo} dezenas`,
      },
      {
        titulo: 'Acaso',
        valor: FORMATADOR_ACERTOS.format(acaso.mediaAcertos),
        detalhe: `acertos por jogo · prêmio em ${FORMATADOR_PERCENTUAL.format(acaso.probPremio)} dos jogos`,
      },
      {
        titulo: 'Conclusão',
        valor: fora.length === 0 ? 'Empate' : `${fora.length} fora`,
        detalhe:
          fora.length === 0
            ? 'nenhuma estratégia se afastou do acaso'
            : `${fora.map((l) => `${l.curto} ${TEXTO_VEREDITO[l.veredito]}`).join(', ')}` +
              // O aleatório não usa estatística nenhuma: se até ele passou da margem, a diferença é sorte da rodada.
              (fora.some((l) => l.estrategia === 'aleatorio') ? ' · até o aleatório passou: é sorte da rodada' : ''),
      },
    ];
  });

  protected readonly linhas = computed<LinhaResultado[]>(() => {
    const resultado = this.resultado();
    if (!resultado) return [];
    const acaso = resultado.acaso.mediaAcertos;
    return resultado.estrategias.map((e) => {
      const veredito = vereditoDe(e.mediaAcertos, e.margem, acaso);
      return {
        estrategia: e.estrategia,
        ...NOMES[e.estrategia],
        acertos: FORMATADOR_ACERTOS.format(e.mediaAcertos),
        diferenca: FORMATADOR_DIFERENCA.format(e.mediaAcertos - acaso),
        margem: `± ${FORMATADOR_ACERTOS.format(e.margem)}`,
        premiados: FORMATADOR_PERCENTUAL.format(e.jogos > 0 ? e.premiados / e.jogos : 0),
        veredito,
        vereditoTexto: TEXTO_VEREDITO[veredito],
      };
    });
  });

  protected readonly premioAcaso = computed(() => {
    const resultado = this.resultado();
    return resultado ? FORMATADOR_PERCENTUAL.format(resultado.acaso.probPremio) : '';
  });

  protected readonly acasoTexto = computed(() => {
    const resultado = this.resultado();
    return resultado ? FORMATADOR_ACERTOS.format(resultado.acaso.mediaAcertos) : '';
  });

  /** Geometria do gráfico de intervalos, centrado no acaso. */
  protected readonly grafico = computed(() => {
    const resultado = this.resultado();
    if (!resultado) return undefined;
    const acaso = resultado.acaso.mediaAcertos;
    let meiaEscala = 0;
    for (const e of resultado.estrategias) {
      meiaEscala = Math.max(meiaEscala, Math.abs(e.mediaAcertos - acaso) + e.margem);
    }
    meiaEscala = Math.max(meiaEscala * 1.2, acaso * 0.005, 0.001);
    const largura = LARGURA - MARGEM_ESQ - MARGEM_DIR;
    const x = (valor: number) => MARGEM_ESQ + ((valor - (acaso - meiaEscala)) / (2 * meiaEscala)) * largura;
    const altura = TOPO + resultado.estrategias.length * ALTURA_LINHA + RODAPE;
    const linhas = resultado.estrategias.map((e, i) => {
      const y = TOPO + i * ALTURA_LINHA + ALTURA_LINHA / 2;
      return {
        rotulo: NOMES[e.estrategia].curto,
        y,
        x: x(e.mediaAcertos),
        x1: x(e.mediaAcertos - e.margem),
        x2: x(e.mediaAcertos + e.margem),
        veredito: vereditoDe(e.mediaAcertos, e.margem, acaso),
      };
    });
    const escala = [acaso - meiaEscala, acaso, acaso + meiaEscala].map((valor) => ({
      x: x(valor),
      texto: FORMATADOR_ACERTOS.format(valor),
    }));
    return {
      largura: LARGURA,
      altura,
      xAcaso: x(acaso),
      yFimLinhas: altura - RODAPE,
      yEscala: altura - 8,
      linhas,
      escala,
    };
  });

  ngOnInit(): void {
    this._store.carregar().catch(() => undefined);
  }

  ngOnDestroy(): void {
    this._execucao++;
  }

  protected tentarNovamente(): void {
    this._store.atualizar().catch(() => undefined);
  }

  /** Roda o teste em fatias de ~40 ms; trocar de loteria, rodar de novo ou sair da tela interrompe a execução. */
  async rodar(): Promise<void> {
    const historico = this._store.historico();
    const concursos = this.concursosATestar();
    if (!historico || concursos <= 0) return;

    const execucao = ++this._execucao;
    const idLoteria = historico.loteria.id;
    const passos = executarTesteEstrategias(historico, {
      concursos,
      dezenasPorJogo: historico.loteria.aposta.min,
      jogosPorConcurso: JOGOS_POR_CONCURSO,
      semente: this._semente++,
    });
    const atual = () => execucao === this._execucao && this._idLoteria() === idLoteria;

    this.executando.set(true);
    this.progresso.set(0);
    try {
      for (;;) {
        const limite = Date.now() + FATIA_MS;
        let passo = passos.next();
        while (!passo.done && Date.now() < limite) passo = passos.next();
        if (!atual()) return;
        if (passo.done) {
          this.resultado.set(passo.value);
          return;
        }
        this.progresso.set(passo.value);
        await new Promise<void>((resolver) => setTimeout(resolver, 0));
        if (!atual()) return;
      }
    } finally {
      if (atual()) this.executando.set(false);
    }
  }
}
