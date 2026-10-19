import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { map } from 'rxjs';
import { HistoricoStore } from '../dados/historico.store';
import { BarraSuperiorComponent } from '../navegacao/barra-superior.component';
import '../navegacao/icones';
import { CorLoteriaServico } from '../tema/cor-loteria.servico';
import { TemaServico } from '../tema/tema.servico';

/**
 * Casca de um jogo (`/:loteria/...`): lê o id da rota, ativa a loteria no `HistoricoStore`, aplica a cor do jogo e
 * mostra a navegação (barra superior no desktop, tab bar no celular) em volta das telas Gerar, Resultados e
 * Estatísticas. Id desconhecido volta para a tela inicial.
 */
@Component({
  selector: 'srt-jogo-shell',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, RouterLink, BarraSuperiorComponent],
  templateUrl: './jogo-shell.page.html',
  styleUrl: './jogo-shell.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JogoShellPage {
  private readonly rota = inject(ActivatedRoute);
  private readonly roteador = inject(Router);
  private readonly historicoStore = inject(HistoricoStore);
  private readonly cor = inject(CorLoteriaServico);
  protected readonly tema = inject(TemaServico);

  /** Id do jogo na URL (`/:loteria/...`); muda sem recriar a casca quando só o parâmetro troca. */
  private readonly idDaRota = toSignal(this.rota.paramMap.pipe(map((params) => params.get('loteria') ?? '')), {
    initialValue: this.rota.snapshot.paramMap.get('loteria') ?? '',
  });

  /** Definição do jogo da rota, quando a loteria é conhecida. */
  protected readonly jogo = computed(() => this.historicoStore.loterias().find((l) => l.id === this.idDaRota()));

  constructor() {
    effect(() => this.cor.definir(this.jogo()?.cor));
    effect(() => {
      const id = this.idDaRota();
      untracked(() => void this.abrir(id));
    });
  }

  /** Ao voltar a esta casca pela pilha de páginas do Ionic (ela não é recriada), reaplica a cor do jogo. */
  ionViewWillEnter(): void {
    this.cor.definir(this.jogo()?.cor);
  }

  private async abrir(id: string): Promise<void> {
    if (!this.historicoStore.loterias().some((l) => l.id === id)) {
      // Link direto para uma loteria que este aparelho nunca viu: só a lista da API diz se o id existe.
      await this.historicoStore.aguardarLoterias();
      if (id !== this.idDaRota()) return; // a rota mudou enquanto esperava
      if (!this.historicoStore.loterias().some((l) => l.id === id)) {
        await this.roteador.navigateByUrl('/', { replaceUrl: true });
        return;
      }
    }
    // A troca é síncrona; a leitura do histórico segue em segundo plano (falhas ficam em `erro()` da loteria).
    this.historicoStore.selecionarLoteria(id).catch(() => undefined);
  }
}
