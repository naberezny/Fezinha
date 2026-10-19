import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { compararDezenas, dezenasDe, formatarDezena, quadrante, type LoteriaDefinicao } from '@sorteios/core';

/** Volante da loteria: grade colunas × linhas de dezenas marcáveis, com divisórias dos quadrantes. */
@Component({
  selector: 'srt-volante',
  template: `
    @for (dezena of dezenas(); track dezena) {
      <button
        type="button"
        [attr.aria-pressed]="marcadas().has(dezena) ? 'true' : 'false'"
        [attr.aria-label]="'dezena ' + rotulo(dezena) + ', quadrante ' + (quadranteDe(dezena) + 1)"
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
    :host::before,
    :host::after {
      content: '';
      position: absolute;
      background: var(--accent);
      opacity: 0.45;
      pointer-events: none;
    }
    :host::before {
      left: 50%;
      top: 6px;
      bottom: 6px;
      width: 2px;
      transform: translateX(-50%);
    }
    :host::after {
      top: 50%;
      left: 6px;
      right: 6px;
      height: 2px;
      transform: translateY(-50%);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[style.grid-template-columns]': 'colunasCss()',
  },
})
export class VolanteComponent {
  readonly definicao = input.required<LoteriaDefinicao>();
  /** Máximo de dezenas marcadas; cliques em dezenas livres são ignorados ao atingi-lo. */
  readonly limite = input.required<number>();
  /** Dezenas marcadas, na ordem do volante (o 00 da Lotomania por último). */
  readonly selecionadas = model<number[]>([]);

  /** Dezenas da grade, na ordem do volante: 01..60 na Mega-Sena; 01..99 e 00 por último na Lotomania. */
  protected readonly dezenas = computed(() => dezenasDe(this.definicao()));
  protected readonly marcadas = computed(() => new Set(this.selecionadas()));
  protected readonly colunasCss = computed(() => `repeat(${this.definicao().volante.colunas}, minmax(0, 1fr))`);

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
