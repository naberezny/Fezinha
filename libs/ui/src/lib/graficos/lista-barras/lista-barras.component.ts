import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BolaComponent } from '../../bola/bola.component';
import { formatarInteiro, maximo } from '../formatos';

export interface ItemListaBarras {
  /** Texto da primeira coluna (em mono). Ignorado visualmente quando há `bola`. */
  rotulo: string;
  valor: number;
  /** Texto da coluna da direita. Padrão: o valor formatado. */
  valorTexto?: string;
  /** Dezena a mostrar como bola pequena no lugar do rótulo. */
  bola?: number;
}

/** Lista de barras proporcionais ao maior valor, ou a `maximo` quando informado (`.lista/.li/.track` do protótipo). */
@Component({
  selector: 'srt-lista-barras',
  imports: [BolaComponent],
  template: `
    @for (item of linhas(); track $index) {
      <div class="li" role="listitem">
        @if (item.bola !== undefined) {
          <srt-bola [dezena]="item.bola" [pequena]="true" />
        } @else {
          <span class="rotulo num">{{ item.rotulo }}</span>
        }
        <div class="track"><i [style.width.%]="item.percentual"></i></div>
        <span class="num">{{ item.valorTexto }}</span>
      </div>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(34px, auto) 1fr auto;
      column-gap: 10px;
      row-gap: 6px;
      min-width: 0;
    }
    .li {
      display: grid;
      grid-template-columns: subgrid;
      grid-column: 1 / -1;
      align-items: center;
      font-size: 13px;
    }
    .num {
      font-family: var(--mono);
      font-variant-numeric: tabular-nums;
    }
    .rotulo {
      font-weight: 600;
    }
    .track {
      height: 8px;
      background: var(--surface-2);
      border-radius: 4px;
      overflow: hidden;
    }
    .track i {
      display: block;
      height: 100%;
      background: var(--s1);
      border-radius: 4px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'list' },
})
export class ListaBarrasComponent {
  readonly itens = input.required<readonly ItemListaBarras[]>();
  /** Valor que corresponde a 100% da barra; padrão: o maior valor da própria lista. Permite comparar listas distintas. */
  readonly maximo = input<number>();

  protected readonly linhas = computed(() => {
    const itens = this.itens();
    const max = this.maximo() || maximo(itens.map((i) => i.valor)) || 1;
    return itens.map((item) => ({
      rotulo: item.rotulo,
      bola: item.bola,
      valorTexto: item.valorTexto ?? formatarInteiro(item.valor),
      percentual: Math.min(100, (100 * Math.max(item.valor, 0)) / max),
    }));
  });
}
