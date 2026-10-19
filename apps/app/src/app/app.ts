import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

/** Raiz do app: só o `ion-app` e o outlet; barra superior e tab bar ficam na tela inicial e na casca de cada jogo. */
@Component({
  imports: [IonApp, IonRouterOutlet],
  selector: 'srt-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
