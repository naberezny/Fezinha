import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** Campo numérico com botões − e +, limitado a [min, max] (`.stepper` do protótipo). */
@Component({
  selector: 'srt-stepper',
  template: `
    <button type="button" aria-label="menos" [disabled]="desabilitado()" (click)="ajustar(-1)">−</button>
    <input
      class="num"
      type="number"
      [attr.id]="id()"
      [attr.min]="min()"
      [attr.max]="max()"
      [attr.aria-label]="rotulo()"
      [disabled]="desabilitado()"
      [value]="valor()"
      (change)="aoDigitar($event)"
    />
    <button type="button" aria-label="mais" [disabled]="desabilitado()" (click)="ajustar(1)">+</button>
  `,
  styles: `
    :host {
      display: flex;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      height: 38px;
      background: var(--surface);
    }
    :host(.desabilitado) {
      opacity: 0.6;
    }
    button:disabled {
      cursor: not-allowed;
    }
    button {
      width: 38px;
      border: 0;
      background: var(--surface-2);
      color: var(--fg);
      cursor: pointer;
      font-size: 18px;
    }
    input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      border-radius: 0;
      text-align: center;
      padding: 0 10px;
      background: var(--surface);
      color: var(--fg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-label]': 'rotulo()',
    '[class.desabilitado]': 'desabilitado()',
    // `id` é do <input> interno; evita duplicar o atributo estático no elemento host.
    '[attr.id]': 'null',
  },
})
export class StepperComponent {
  readonly valor = model(0);
  readonly min = input(0);
  readonly max = input(100);
  /** Nome acessível do campo. */
  readonly rotulo = input<string>();
  /** `id` do `<input>` interno, para associar um `<label for>` externo. */
  readonly id = input<string>();
  /** Valor fixo: mostra o valor, mas não aceita digitação nem cliques em − e + (ex.: aposta fixa da Lotomania). */
  readonly desabilitado = input(false);

  protected ajustar(delta: number): void {
    this.definir(this.valor() + delta);
  }

  protected aoDigitar(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const digitado = campo.valueAsNumber;
    this.definir(Number.isNaN(digitado) ? this.valor() : digitado);
    // Se o valor limitado coincidir com o anterior, o binding não muda: força o DOM a refletir o signal.
    campo.value = String(this.valor());
  }

  private definir(candidato: number): void {
    this.valor.set(Math.min(this.max(), Math.max(this.min(), Math.round(candidato))));
  }
}
