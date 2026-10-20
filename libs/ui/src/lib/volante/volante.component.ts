import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { compararDezenas, dezenasDe, formatarDezena, quadrante, type LoteriaDefinicao } from '@sorteios/core';

/** Volante da loteria: grade colunas × linhas de dezenas marcáveis, com divisórias dos quadrantes (opcionais). */
@Component({
  selector: 'srt-volante',
  template: `
    @for (dezena of dezenas(); track dezena) {
      <button
        type="button"
        [attr.aria-pressed]="marcadas().has(dezena) ? 'true' : 'false'"
        [attr.aria-label]="'dezena ' + rotulo(dezena) + (quadrantes() ? ', quadrante ' + (quadranteDe(dezena) + 1) : '')"
        (click)="alternar(dezena)"
      >
        {{ rotulo(dezena) }}
      </button>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 3px;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface-2);
      position: relative;
    }
    button {
      aspect-ratio: 1;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      color: var(--fg);
      font-family: var(--mono);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      min-width: 0;
    }
    button:hover {
      border-color: var(--accent);
    }
    button[aria-pressed='true'] {
      background: var(--ball);
      color: var(--ball-ink);
      border-color: var(--ball);
    }
    :host(.com-quadrantes)::before,
    :host(.com-quadrantes)::after {
      content: '';
      position: absolute;
      background: var(--accent);
      opacity: 0.45;
      pointer-events: none;
    }
    /*
     * Divisórias no vão depois de --antes-colunas colunas e --antes-linhas linhas (ver quadrante() no core).
     * Com 6px de padding e 3px de gap, cada casa mede (100% - 12px - (n - 1) * 3px) / n; o vão seguinte fica
     * 6px + k casas + (k - 1) gaps + 1,5px. Em grades pares isso dá exatamente 50%.
     */
    :host::before {
      left: calc(
        6px + (100% - 12px - (var(--colunas) - 1) * 3px) * var(--antes-colunas) / var(--colunas) +
          var(--antes-colunas) * 3px - 1.5px
      );
      top: 6px;
      bottom: 6px;
      width: 2px;
      transform: translateX(-50%);
    }
    :host::after {
      top: calc(
        6px + (100% - 12px - (var(--linhas) - 1) * 3px) * var(--antes-linhas) / var(--linhas) +
          var(--antes-linhas) * 3px - 1.5px
      );
      left: 6px;
      right: 6px;
      height: 2px;
      transform: translateY(-50%);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[class.com-quadrantes]': 'quadrantes()',
    '[style.grid-template-columns]': 'colunasCss()',
    '[style.--colunas]': 'definicao().volante.colunas',
    '[style.--linhas]': 'definicao().volante.linhas',
    '[style.--antes-colunas]': 'divisoria().colunas',
    '[style.--antes-linhas]': 'divisoria().linhas',
  },
})
export class VolanteComponent {
  readonly definicao = input.required<LoteriaDefinicao>();
  /** Mostra as divisórias dos quadrantes (e o quadrante no aria-label). Desligue quando o jogo não usa quadrantes. */
  readonly quadrantes = input(true);
  /** Máximo de dezenas marcadas; cliques em dezenas livres são ignorados ao atingi-lo. */
  readonly limite = input.required<number>();
  /** Dezenas marcadas, na ordem do volante (o 00 da Lotomania por último). */
  readonly selecionadas = model<number[]>([]);

  /** Dezenas da grade, na ordem do volante: 01..60 na Mega-Sena; 01..99 e 00 por último na Lotomania. */
  protected readonly dezenas = computed(() => dezenasDe(this.definicao()));
  protected readonly marcadas = computed(() => new Set(this.selecionadas()));
  protected readonly colunasCss = computed(() => `repeat(${this.definicao().volante.colunas}, minmax(0, 1fr))`);
  /**
   * Quantas colunas e linhas ficam antes das divisórias. Segue `quadrante()` do core: com número ímpar, a coluna e a
   * linha do meio pertencem aos quadrantes de cima e da esquerda (grade 5 × 5: divisórias depois da 3ª coluna e
   * da 3ª linha, não no meio delas).
   */
  protected readonly divisoria = computed(() => {
    const { colunas, linhas } = this.definicao().volante;
    return { colunas: Math.ceil(colunas / 2), linhas: Math.ceil(linhas / 2) };
  });

  protected rotulo(dezena: number): string {
    return formatarDezena(dezena);
  }

  protected quadranteDe(dezena: number): number {
    return quadrante(dezena, this.definicao());
  }

  protected alternar(dezena: number): void {
    const atuais = this.selecionadas();
    if (atuais.includes(dezena)) {
      this.selecionadas.set(atuais.filter((d) => d !== dezena));
    } else if (atuais.length < this.limite()) {
      this.selecionadas.set([...atuais, dezena].sort(compararDezenas(this.definicao())));
    }
  }
}
