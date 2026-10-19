import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** Interruptor acessível (`.toggle` do protótipo): checkbox visualmente oculto + trilho `.sw`. */
@Component({
  selector: 'srt-switch',
  template: `
    <label class="toggle">
      <input
        type="checkbox"
        [attr.id]="id()"
        [checked]="ligado()"
        [disabled]="desabilitado()"
        (change)="ligado.set($any($event.target).checked)"
      />
      <span class="sw"></span>
      <span>
        {{ rotulo() }}
        @if (ajuda()) {
          <span class="hint">{{ ajuda() }}</span>
        }
      </span>
    </label>
  `,
  styles: `
    :host {
      display: block;
    }
    .toggle {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      align-items: center;
      font-size: 14px;
      cursor: pointer;
    }
    input {
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1px;
    }
    .sw {
      width: 36px;
      height: 20px;
      border-radius: 999px;
      background: var(--line);
      position: relative;
      transition: background 0.15s;
    }
    .sw::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--surface);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
      transition: left 0.15s;
    }
    input:checked + .sw {
      background: var(--accent);
    }
    input:checked + .sw::after {
      left: 18px;
    }
    input:focus-visible + .sw {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    input:disabled + .sw {
      opacity: 0.4;
    }
    .hint {
      font-size: 12.5px;
      color: var(--muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // `id` é do <input> interno; evita duplicar o atributo estático no elemento host.
    '[attr.id]': 'null',
  },
})
export class SwitchComponent {
  readonly ligado = model(false);
  readonly rotulo = input.required<string>();
  /** Texto auxiliar (`.hint`) ao lado do rótulo. */
  readonly ajuda = input<string>();
  readonly desabilitado = input(false);
  /** `id` do `<input>` interno. */
  readonly id = input<string>();
}
