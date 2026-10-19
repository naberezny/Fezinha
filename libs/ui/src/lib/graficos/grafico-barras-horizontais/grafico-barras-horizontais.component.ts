import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ESTILOS_SVG } from '../estilos';
import { escaparHtml, formatarInteiro, maximo } from '../formatos';
import { TooltipDirective } from '../tooltip.directive';

export interface ItemBarraHorizontal {
  rotulo: string;
  valor: number;
  /** HTML simples da dica (gerado pela aplicação). Padrão: "<b>rótulo</b>: valor". */
  dica?: string;
}

const LARGURA = 520;
const ALTURA_LINHA = 20;
const MARGEM_ESQ = 34;
const MARGEM_DIR = 30;

/** Barras horizontais com rótulo à esquerda, valor à direita e linha de referência opcional (`chAtraso`). */
@Component({
  selector: 'srt-grafico-barras-horizontais',
  imports: [TooltipDirective],
  template: `
    @let g = geometria();
    <svg role="img" [attr.viewBox]="'0 0 ' + g.largura + ' ' + g.altura" [attr.aria-label]="rotuloAria()">
      @for (linha of g.linhas; track $index) {
        <g [srtTooltip]="linha.dica">
          <text class="num rotulo" [attr.x]="g.margemEsq - 6" [attr.y]="linha.y + 13" text-anchor="end" font-weight="600">{{
            linha.rotulo
          }}</text>
          <rect class="bar" [attr.x]="g.margemEsq" [attr.y]="linha.y + 3" [attr.width]="linha.largura" [attr.height]="14" rx="3" />
          <text class="ax valor" [attr.x]="linha.xValor" [attr.y]="linha.y + 13">{{ linha.valorTexto }}</text>
          <rect class="zona" x="0" [attr.y]="linha.y" [attr.width]="g.largura" [attr.height]="20" fill="transparent" />
        </g>
      }
      @if (g.xReferencia !== null) {
        <line class="ref" [attr.x1]="g.xReferencia" [attr.x2]="g.xReferencia" y1="4" [attr.y2]="g.altura - 4" />
      }
    </svg>
  `,
  styles: [ESTILOS_SVG],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraficoBarrasHorizontaisComponent {
  readonly itens = input.required<readonly ItemBarraHorizontal[]>();
  /** Valor da linha vertical tracejada (ex.: atraso esperado). */
  readonly referencia = input<number>();
  readonly rotuloAria = input.required<string>();

  protected readonly geometria = computed(() => {
    const itens = this.itens();
    const referencia = this.referencia();
    const max = maximo([...itens.map((i) => i.valor), referencia ?? 0]) || 1;
    const escala = (valor: number) => MARGEM_ESQ + ((LARGURA - MARGEM_ESQ - MARGEM_DIR) * Math.max(valor, 0)) / max;
    const altura = itens.length * ALTURA_LINHA + 16;

    const linhas = itens.map((item, i) => {
      const xFim = escala(item.valor);
      return {
        y: 8 + i * ALTURA_LINHA,
        rotulo: item.rotulo,
        largura: xFim - MARGEM_ESQ,
        xValor: xFim + 5,
        valorTexto: formatarInteiro(item.valor),
        dica: item.dica ?? `<b>${escaparHtml(item.rotulo)}</b>: ${formatarInteiro(item.valor)}`,
      };
    });

    return {
      largura: LARGURA,
      altura,
      margemEsq: MARGEM_ESQ,
      linhas,
      xReferencia: referencia === undefined ? null : escala(referencia),
    };
  });
}
