import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { TemaServico } from '../tema/tema.servico';
import './icones';

/** O que a barra precisa saber do jogo aberto. */
export interface JogoDaBarra {
  id: string;
  nome: string;
}

/**
 * Barra superior do app. Sem `jogo` (tela inicial): só a marca "Sorteios" e o botão de tema, em qualquer largura.
 * Com `jogo`: marca, nome do jogo e os links Gerar / Resultados / Estatísticas; só aparece no desktop (>= 860 px),
 * porque no celular a navegação do jogo é a tab bar da casca.
 */
@Component({
  selector: 'srt-barra-superior',
  imports: [IonIcon, RouterLink, RouterLinkActive],
  templateUrl: './barra-superior.component.html',
  styleUrl: './barra-superior.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraSuperiorComponent {
  protected readonly tema = inject(TemaServico);

  readonly jogo = input<JogoDaBarra | undefined>(undefined);
}
