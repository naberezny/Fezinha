import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface OpcaoSegmento {
  valor: string;
  rotulo: string;
}

/** Controle segmentado de escolha única (`.seg` do protótipo), com `aria-pressed` em cada botão. */
@Component({
  selector: 'srt-segmento',
  template: `
    <div class="seg" role="group" [attr.aria-label]="rotuloAria() ?? null">
      @for (opcao of opcoes(); track opcao.valor) {
        <button type="button" [attr.aria-pressed]="opcao.valor === selecionado()" (click)="selecionado.set(opcao.valor)">
          {{ opcao.rotulo }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .seg {
      display: inline-flex;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background: var(--surface);
    }
    button {
      border: 0;
      background: transparent;
      padding: 7px 12px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      font-family: inherit;
      color: var(--muted);
    }
    button[aria-pressed='true'] {
      background: var(--accent);
      color: var(--accent-ink);
    }
    button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentoComponent {
  readonly opcoes = input.required<readonly OpcaoSegmento[]>();
  readonly selecionado = model('');
  /** Nome do grupo para leitores de tela (ex.: "Período"). */
  readonly rotuloAria = input<string>();
}
