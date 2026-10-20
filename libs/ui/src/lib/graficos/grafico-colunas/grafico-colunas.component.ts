import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ESTILOS_SVG } from '../estilos';
import { escaparHtml, formatarInteiro, maximo } from '../formatos';
import { TooltipDirective } from '../tooltip.directive';

export interface ItemColuna {
  rotulo: string;
  valor: number;
  /** HTML simples da dica (gerado pela aplicação). Padrão: "<b>rótulo</b>: valor". */
  dica?: string;
  /** Valor de comparação (ex.: o esperado pelo acaso), desenhado como um traço sobre a coluna. */
  referencia?: number;
}

const LARGURA = 520;
const ALTURA = 170;
const MARGEM_ESQ = 34;
const MARGEM_INF = 26;
const MARGEM_SUP = 14;
const MARGEM_DIR = 8;

/** Colunas com valor acima e linha de base (`colunas()` do protótipo, ex.: acumulados por ano). */
@Component({
  selector: 'srt-grafico-colunas',
  imports: [TooltipDirective],
  template: `
    @let g = geometria();
    <svg role="img" [attr.viewBox]="'0 0 ' + g.largura + ' ' + g.altura" [attr.aria-label]="rotuloAria()">
      <line class="grid base" [attr.x1]="g.margemEsq" [attr.x2]="g.largura" [attr.y1]="g.yBase" [attr.y2]="g.yBase" />
      @for (c of g.colunas; track $index) {
        <g [srtTooltip]="c.dica">
          <rect class="bar" [attr.x]="c.x" [attr.y]="c.y" [attr.width]="c.largura" [attr.height]="c.altura" rx="3" />
          <text class="valor" [attr.x]="c.centro" [attr.y]="c.y - 4" text-anchor="middle">{{ c.valorTexto }}</text>
          <text class="ax rotulo" [attr.x]="c.centro" [attr.y]="g.yBase + 14" text-anchor="middle" font-size="10">{{ c.rotulo }}</text>
          @if (c.yReferencia !== null) {
            <line class="ref" [attr.x1]="c.x - 2" [attr.x2]="c.x + c.largura + 2" [attr.y1]="c.yReferencia" [attr.y2]="c.yReferencia" stroke-width="2" />
          }
        </g>
      }
    </svg>
  `,
  styles: [ESTILOS_SVG],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraficoColunasComponent {
  readonly itens = input.required<readonly ItemColuna[]>();
  readonly rotuloAria = input.required<string>();

  protected readonly geometria = computed(() => {
    const itens = this.itens();
    const max = maximo(itens.flatMap((i) => [i.valor, i.referencia ?? 0])) || 1;
    const alturaUtil = ALTURA - MARGEM_SUP - MARGEM_INF;
    const larguraSlot = itens.length ? (LARGURA - MARGEM_ESQ - MARGEM_DIR) / itens.length : 0;
    const yBase = ALTURA - MARGEM_INF;

    const colunas = itens.map((item, i) => {
      const altura = (alturaUtil * Math.max(item.valor, 0)) / max;
      const x = MARGEM_ESQ + i * larguraSlot + 3;
      const largura = Math.max(larguraSlot - 6, 1);
      return {
        x,
        y: yBase - altura,
        largura,
        altura,
        centro: x + largura / 2,
        rotulo: item.rotulo,
        valorTexto: formatarInteiro(item.valor),
        dica: item.dica ?? `<b>${escaparHtml(item.rotulo)}</b>: ${formatarInteiro(item.valor)}`,
        yReferencia:
          item.referencia === undefined ? null : yBase - (alturaUtil * Math.max(item.referencia, 0)) / max,
      };
    });

    return { largura: LARGURA, altura: ALTURA, margemEsq: MARGEM_ESQ, yBase, colunas };
  });
}
