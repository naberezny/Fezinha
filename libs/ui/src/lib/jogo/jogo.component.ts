import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatarAtraso, type Jogo } from '@sorteios/core';
import { BolaComponent } from '../bola/bola.component';

/** Um jogo gerado: índice, bolas com badge de atraso e métricas à direita (`.jogo` do protótipo). */
@Component({
  selector: 'srt-jogo',
  imports: [BolaComponent],
  template: `
    <span class="idx">{{ indiceTexto() }}</span>
    <div class="bolas">
      @for (dezena of jogo().dezenas; track dezena) {
        <srt-bola [dezena]="dezena" [fixa]="fixas().includes(dezena)" [atraso]="atrasos()[dezena]" />
      }
    </div>
    <div class="meta">
      <span [attr.title]="explicacaoAtraso()">
        sem sair há <b class="num">{{ atrasoMedioTexto() }}</b> concursos, em média
      </span>
      <span>
        <b class="num">{{ jogo().pares }}</b> pares · <b class="num">{{ impares() }}</b> ímpares ·
        <b class="num">{{ jogo().quadrantes }}</b> quadrantes
      </span>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
    }
    .idx {
      font-family: var(--mono);
      color: var(--muted);
      font-size: 13px;
      width: 28px;
    }
    .bolas {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
    }
    /* As bolas nunca encolhem: quebram em várias por linha. */
    .bolas srt-bola {
      flex: 0 0 auto;
    }
    .meta {
      display: grid;
      gap: 2px;
      text-align: right;
      font-size: 12px;
      color: var(--muted);
      /* Limita o resumo para a coluna das bolas ter espaço. */
      max-width: 230px;
    }
    /* Celular: resumo vai para baixo das bolas, ocupando a largura toda. */
    @media (max-width: 640px) {
      :host {
        grid-template-columns: auto minmax(0, 1fr);
        gap: 8px 12px;
      }
      .meta {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: 2px 12px;
        text-align: left;
        max-width: none;
      }
    }
    @media (prefers-reduced-motion: no-preference) {
      :host {
        animation: entrada 0.25s ease both;
        animation-delay: calc(var(--ordem, 0) * 40ms);
      }
      @keyframes entrada {
        from {
          opacity: 0.4;
          transform: translateY(4px);
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--ordem]': 'indice() - 1',
  },
})
export class JogoComponent {
  /** Posição do jogo na lista, a partir de 1. */
  readonly indice = input.required<number>();
  readonly jogo = input.required<Jogo>();
  /** Atraso de cada dezena (concursos sem sair), mostrado como badge na bola. */
  readonly atrasos = input<Record<number, number>>({});
  /** Dezenas escolhidas pelo usuário, destacadas com o anel de "fixa". */
  readonly fixas = input<number[]>([]);
  /** Atraso esperado por dezena, citado na explicação do atraso médio (Mega-Sena: 10). */
  readonly atrasoEsperado = input(10);

  protected readonly indiceTexto = computed(() => String(this.indice()).padStart(2, '0'));
  protected readonly impares = computed(() => this.jogo().dezenas.length - this.jogo().pares);
  protected readonly atrasoMedioTexto = computed(() => this.jogo().atrasoMedio.toFixed(1).replace('.', ','));
  protected readonly explicacaoAtraso = computed(
    () =>
      `média de concursos que cada dezena deste jogo está sem sair (o esperado por dezena é ${formatarAtraso(this.atrasoEsperado())})`,
  );
}
