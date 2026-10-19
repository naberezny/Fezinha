import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/** Aviso informativo com ícone ⓘ; o conteúdo projetado pode usar `<b>` para destaque (`.aviso` do protótipo). */
@Component({
  selector: 'srt-aviso',
  template: `
    <span aria-hidden="true">ⓘ</span>
    <span><ng-content /></span>
  `,
  // Sem encapsulamento: o `<b>` projetado pertence ao escopo do componente pai.
  encapsulation: ViewEncapsulation.None,
  styles: `
    srt-aviso {
      font-size: 12.5px;
      color: var(--muted);
      padding: 10px 12px;
      background: var(--surface-2);
      border-radius: 8px;
      display: flex;
      gap: 8px;
    }
    srt-aviso b {
      color: var(--fg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'note' },
})
export class AvisoComponent {}
