import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatarDezena } from '@sorteios/core';

/** Bola de uma dezena, com badge opcional de atraso no canto (`.bola` do protótipo). */
@Component({
  selector: 'srt-bola',
  template: `{{ texto() }}@if (atraso() !== undefined) {<span class="at">{{ atraso() }}</span>}`,
  styles: `
    :host {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--ball);
      color: var(--ball-ink);
      display: grid;
      place-items: center;
      font-family: var(--mono);
      font-weight: 700;
      font-size: 14px;
      position: relative;
    }
    :host(.pequena) {
      width: 28px;
      height: 28px;
      font-size: 12px;
    }
    :host(.fixa) {
      box-shadow:
        0 0 0 2px var(--surface),
        0 0 0 4px var(--accent);
    }
    .at {
      position: absolute;
      bottom: -6px;
      right: -6px;
      font-size: 9px;
      background: var(--surface);
      color: var(--muted);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 0 4px;
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.pequena]': 'pequena()',
    '[class.fixa]': 'fixa()',
    '[attr.title]': 'titulo()',
  },
})
export class BolaComponent {
  readonly dezena = input.required<number>();
  readonly pequena = input(false);
  readonly fixa = input(false);
  /** Concursos desde que a dezena saiu pela última vez (0 = saiu no último). Sem valor, não há badge. */
  readonly atraso = input<number>();

  protected readonly texto = computed(() => formatarDezena(this.dezena()));

  protected readonly titulo = computed(() => {
    const atraso = this.atraso();
    if (atraso === undefined) return null;
    return `a dezena ${this.texto()} não sai há ${atraso} ${atraso === 1 ? 'concurso' : 'concursos'}`;
  });
}
