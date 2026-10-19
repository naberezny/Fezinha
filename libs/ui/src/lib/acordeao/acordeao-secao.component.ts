import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** Seção do acordeão: `<details>` com título e, enquanto fechada, o resumo do valor atual (`.sec` do protótipo). */
@Component({
  selector: 'srt-acordeao-secao',
  template: `
    <details [open]="aberta()" (toggle)="aoAlternar($event)">
      <summary>
        <span class="lbl">{{ titulo() }}</span>
        @if (!aberta() && resumo()) {
          <span class="val">{{ resumo() }}</span>
        }
      </summary>
      <div class="sec-body"><ng-content /></div>
    </details>
  `,
  styles: `
    :host {
      display: block;
      background: var(--surface);
    }
    :host + :host {
      border-top: 1px solid var(--line);
    }
    summary {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 12px;
      cursor: pointer;
      list-style: none;
      background: var(--surface);
    }
    summary::-webkit-details-marker {
      display: none;
    }
    summary::before {
      content: '';
      width: 8px;
      height: 8px;
      border-right: 2px solid var(--muted);
      border-bottom: 2px solid var(--muted);
      transform: rotate(-45deg);
      transition: transform 0.15s;
      flex: none;
      margin-left: 2px;
    }
    details[open] summary::before {
      transform: rotate(45deg);
    }
    .lbl {
      font-weight: 600;
      font-size: 14px;
    }
    .val {
      margin-left: auto;
      font-size: 12.5px;
      color: var(--muted);
      text-align: right;
      max-width: 55%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sec-body {
      padding: 4px 12px 14px;
      display: grid;
      gap: 10px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcordeaoSecaoComponent {
  readonly titulo = input.required<string>();
  /** Valor atual da seção, mostrado ao lado do título somente enquanto ela está fechada. */
  readonly resumo = input<string>();
  readonly aberta = model(false);

  protected aoAlternar(evento: Event): void {
    this.aberta.set((evento.target as HTMLDetailsElement).open);
  }
}
