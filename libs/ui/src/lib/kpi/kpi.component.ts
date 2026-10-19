import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Indicador numérico em um painel (`.panel.kpi` do protótipo). */
@Component({
  selector: 'srt-kpi',
  template: `
    <span class="eyebrow">{{ titulo() }}</span>
    <span class="v num">{{ valor() }}</span>
    <span class="s">{{ detalhe() }}</span>
  `,
  styles: `
    :host {
      padding: 14px 16px;
      display: grid;
      gap: 4px;
    }
    /* Filete na cor do jogo (--accent); o seletor mais específico vence a borda do .panel global. */
    :host.panel {
      border-inline-start: 4px solid var(--accent);
    }
    .v {
      font-family: var(--display);
      font-size: 26px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .s {
      font-size: 12.5px;
      color: var(--muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'panel' },
})
export class KpiComponent {
  readonly titulo = input.required<string>();
  readonly valor = input.required<string | number>();
  readonly detalhe = input<string>();
}
