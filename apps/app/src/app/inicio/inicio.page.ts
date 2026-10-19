import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import type { Concurso, LoteriaDefinicao } from '@sorteios/core';
import { formatarDataBR, formatarReais } from '@sorteios/ui';
import { HistoricoStore } from '../dados/historico.store';
import { BarraSuperiorComponent } from '../navegacao/barra-superior.component';
import { tintaSobre, type Tinta } from '../tema/cor-loteria';
import { CorLoteriaServico } from '../tema/cor-loteria.servico';

/**
 * Loterias ainda não disponíveis, mostradas como cartões "em breve". Quem a API já entrega
 * (`HistoricoStore.loterias`) sai desta lista e vira cartão ativo.
 */
const LOTERIAS_EM_BREVE = [
  { id: 'lotofacil', nome: 'Lotofácil' },
  { id: 'quina', nome: 'Quina' },
  { id: 'duplasena', nome: 'Dupla Sena' },
] as const;

/** Cartão de uma loteria disponível; `ultimo` só vem quando o histórico dela já está carregado. */
interface CartaoLoteria {
  definicao: LoteriaDefinicao;
  /** Dezenas sorteadas com 2 dígitos ("06", "20"): vai no selo do cartão. */
  selo: string;
  /** Texto de contraste do selo e do botão sobre a cor do jogo. */
  tinta: Tinta;
  ultimo?: { titulo: string; situacao: string; estimativa: string };
}

function resumirUltimo(concurso: Concurso, nomePrincipal: string): NonNullable<CartaoLoteria['ultimo']> {
  const ganhadores = concurso.premiacoes.find((p) => p.faixa === 1)?.ganhadores ?? 0;
  return {
    titulo: `Concurso ${concurso.numero} · ${formatarDataBR(concurso.data)}`,
    situacao: concurso.acumulou
      ? `Acumulado em ${formatarReais(concurso.valorAcumuladoCentavos)}`
      : `Teve ${ganhadores === 1 ? '1 ganhador' : `${ganhadores} ganhadores`} (${nomePrincipal})`,
    estimativa: `Estimativa do próximo: ${formatarReais(concurso.estimativaProximoCentavos)}`,
  };
}

/** Tela inicial: um cartão por loteria, com atalhos para gerar jogos e ver todos os resultados. */
@Component({
  selector: 'srt-inicio-page',
  imports: [IonContent, RouterLink, BarraSuperiorComponent],
  templateUrl: './inicio.page.html',
  styleUrl: './inicio.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPage implements OnInit {
  private readonly historicoStore = inject(HistoricoStore);
  private readonly cor = inject(CorLoteriaServico);

  protected readonly cartoes = computed<CartaoLoteria[]>(() => {
    const historico = this.historicoStore.historico();
    const ultimo = this.historicoStore.ultimo();
    return this.historicoStore.loterias().map((definicao) => {
      const carregada = historico?.loteria.id === definicao.id && ultimo !== undefined;
      return {
        definicao,
        selo: String(definicao.sorteadas).padStart(2, '0'),
        tinta: tintaSobre(definicao.cor),
        ultimo: carregada ? resumirUltimo(ultimo, definicao.faixas[0]?.nome ?? 'prêmio principal') : undefined,
      };
    });
  });

  protected readonly emBreve = computed(() => {
    const disponiveis = new Set(this.historicoStore.loterias().map((loteria) => loteria.id));
    return LOTERIAS_EM_BREVE.filter((loteria) => !disponiveis.has(loteria.id));
  });

  ngOnInit(): void {
    this.cor.limpar();
    // Mostra o último concurso da loteria ativa; o estado de falha fica em `erro()` e o cartão segue só com o nome.
    this.historicoStore.carregar().catch(() => undefined);
  }

  /** Ao voltar à tela inicial pela pilha de páginas do Ionic (ela não é recriada), volta ao neutro. */
  ionViewWillEnter(): void {
    this.cor.limpar();
  }
}
