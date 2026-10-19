import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Agrupador de seções `srt-acordeao-secao`: só desenha a borda comum (`.acordeao` do protótipo). */
@Component({
  selector: 'srt-acordeao',
  template: `<ng-content />`,
  styles: `
    :host {
      display: grid;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcordeaoComponent {}
