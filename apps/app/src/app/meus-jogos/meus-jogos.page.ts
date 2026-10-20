import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { calcularAssertividade, concursoAlvo, conferirJogo } from '@sorteios/core';
import type { Concurso, ConferenciaJogo } from '@sorteios/core';
import { BolaComponent, KpiComponent, formatarDataBR } from '@sorteios/ui';
import { HistoricoStore, JogosSalvosStore, type JogoSalvo } from '../dados/historico.store';
import { MODOS_GERACAO, formatarMilhar } from '../gerar/gerar.estado';

const FORMATADOR_MEDIA = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const FORMATADOR_PERCENTUAL = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

/** "1 acerto", "4 acertos", "nenhum acerto". */
function textoAcertos(quantidade: number): string {
  if (quantidade === 0) return 'nenhum acerto';
  return `${quantidade} acerto${quantidade > 1 ? 's' : ''}`;
}

/** Um jogo salvo pronto para a tela, conferido quando o concurso alvo já está no histórico. */
interface ItemJogo {
  jogo: JogoSalvo;
  alvo: number;
  salvoEm: string;
  modo: string;
  conferencia?: ConferenciaJogo;
  acertos: ReadonlySet<number>;
  status: string;
}

/**
 * Aba "Meus jogos": jogos salvos neste navegador (sem cadastro) para a loteria ativa. Cada jogo é conferido com o
 * concurso seguinte ao da geração assim que o resultado entra no histórico, e o resumo mede a assertividade dos
 * jogos conferidos contra o que o acaso daria.
 */
@Component({
  selector: 'srt-meus-jogos-page',
  imports: [IonContent, NgTemplateOutlet, RouterLink, BolaComponent, KpiComponent],
  templateUrl: './meus-jogos.page.html',
  styleUrl: './meus-jogos.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeusJogosPage implements OnInit {
  private readonly _historicoStore = inject(HistoricoStore);
  private readonly _jogosSalvosStore = inject(JogosSalvosStore);

  protected readonly loteria = this._historicoStore.loteria;
  protected readonly erroRemover = signal<string | undefined>(undefined);

  /** Concursos do histórico da loteria ativa, por número. */
  private readonly _concursos = computed(() => {
    const historico = this._historicoStore.historico();
    return new Map<number, Concurso>(historico?.concursos.map((c) => [c.numero, c]) ?? []);
  });

  protected readonly itens = computed<ItemJogo[]>(() => {
    const def = this.loteria();
    const concursos = this._concursos();
    const carregado = this._historicoStore.historico() !== undefined;
    const ultimo = this._historicoStore.ultimo();
    return this._jogosSalvosStore
      .jogos()
      .filter((jogo) => jogo.loteriaId === def.id)
      .map((jogo) => {
        const alvo = concursoAlvo(jogo.concursoBase);
        const concurso = concursos.get(alvo);
        const conferencia = concurso ? conferirJogo(def, jogo.dezenas, concurso) : undefined;
        let status: string;
        if (conferencia) {
          const premio = conferencia.faixa ? ` · ${conferencia.faixa.nome}` : '';
          status = `Concurso ${formatarMilhar(alvo)} (${formatarDataBR(conferencia.data)}): ${textoAcertos(conferencia.acertos.length)}${premio}`;
        } else if (!carregado) {
          status = `Conferência com o concurso ${formatarMilhar(alvo)} assim que os resultados carregarem`;
        } else {
          const previsto =
            ultimo?.proximoNumero === alvo && ultimo.dataProximoSorteio
              ? `, previsto para ${formatarDataBR(ultimo.dataProximoSorteio)}`
              : '';
          status = `Aguardando o sorteio do concurso ${formatarMilhar(alvo)}${previsto}`;
        }
        return {
          jogo,
          alvo,
          salvoEm: new Date(jogo.criadoEm).toLocaleDateString('pt-BR'),
          modo: MODOS_GERACAO.find((m) => m.id === jogo.estrategia)?.nomeCurto ?? jogo.estrategia,
          conferencia,
          acertos: new Set(conferencia?.acertos ?? []),
          status,
        };
      });
  });

  protected readonly aguardando = computed(() => this.itens().filter((item) => !item.conferencia));
  protected readonly conferidos = computed(() => this.itens().filter((item) => item.conferencia));

  protected readonly assertividade = computed(() =>
    calcularAssertividade(
      this.loteria(),
      this.conferidos().flatMap(({ jogo, conferencia }) =>
        conferencia ? [{ tamanho: jogo.dezenas.length, conferencia }] : [],
      ),
    ),
  );

  protected readonly kpis = computed(() => {
    const a = this.assertividade();
    const total = this.itens().length;
    const conferidos = a.conferidos;
    return [
      {
        titulo: 'Jogos salvos',
        valor: formatarMilhar(total),
        detalhe: `${formatarMilhar(this.aguardando().length)} aguardando sorteio`,
      },
      {
        titulo: 'Conferidos',
        valor: formatarMilhar(conferidos),
        detalhe: conferidos ? `melhor: ${textoAcertos(a.melhor)}` : 'nenhum sorteio ainda',
      },
      {
        titulo: 'Média de acertos',
        valor: conferidos ? FORMATADOR_MEDIA.format(a.mediaAcertos) : '–',
        detalhe: conferidos ? `o acaso daria ${FORMATADOR_MEDIA.format(a.mediaAcaso)} por jogo` : 'por jogo conferido',
      },
      {
        titulo: 'Premiados',
        valor: formatarMilhar(a.premiados),
        detalhe: conferidos
          ? `${FORMATADOR_PERCENTUAL.format(a.premiados / conferidos)} dos conferidos`
          : 'em alguma faixa',
      },
    ];
  });

  /** "0 acertos: 3 jogos · 1 acerto: 5 jogos · …", só quantidades que aconteceram. */
  protected readonly textoDistribuicao = computed(() =>
    this.assertividade()
      .distribuicao.map((jogos, acertos) => ({ jogos, acertos }))
      .filter(({ jogos }) => jogos > 0)
      .map(({ jogos, acertos }) => `${textoAcertos(acertos)}: ${jogos} jogo${jogos > 1 ? 's' : ''}`)
      .join(' · '),
  );

  ngOnInit(): void {
    this._jogosSalvosStore.carregar().catch(() => undefined);
    // Falhas de rede ficam em `erro()` do store; a conferência usa o que houver em cache.
    this._historicoStore.carregar().catch(() => undefined);
  }

  protected async remover(item: ItemJogo): Promise<void> {
    this.erroRemover.set(undefined);
    try {
      await this._jogosSalvosStore.remover(item.jogo.id);
    } catch {
      this.erroRemover.set('Não foi possível remover o jogo. Tente de novo.');
    }
  }
}
