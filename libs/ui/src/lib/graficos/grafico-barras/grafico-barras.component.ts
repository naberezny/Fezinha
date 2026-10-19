import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ESTILOS_SVG } from '../estilos';
import { escaparHtml, formatarInteiro, maximo } from '../formatos';
import { TooltipDirective } from '../tooltip.directive';

export interface ItemBarraVertical {
  rotulo: string;
  valor: number;
  /** Destaca a barra (as demais ficam esmaecidas, classe `dim`). */
  destaque?: boolean;
  /** HTML simples da dica (gerado pela aplicação). Padrão: "<b>rótulo</b>: valor". */
  dica?: string;
}

interface BarraCalculada {
  x: number;
  y: number;
  largura: number;
  altura: number;
  centro: number;
  rotulo: string;
  valorTexto: string;
  esmaecida: boolean;
  mostrarValor: boolean;
  dica: string;
  zonaX: number;
  zonaLargura: number;
}

const LARGURA_PADRAO = 1080;
const ALTURA = 240;
const MARGEM_ESQ = 36;
const MARGEM_INF = 28;
const MARGEM_SUP = 12;
const MARGEM_DIR = 8;
const DIVISOES = 4;

/** Barras verticais com grade e eixo (`chFreq` do protótipo): uma barra por item, qualquer quantidade. */
@Component({
  selector: 'srt-grafico-barras',
  imports: [TooltipDirective],
  template: `
    @let g = geometria();
    <div class="rolagem">
      <svg
        role="img"
        [attr.viewBox]="'0 0 ' + g.largura + ' ' + g.altura"
        [attr.aria-label]="rotuloAria()"
        [style.min-width.px]="g.larguraMinimaSvg"
      >
        @for (linha of g.linhas; track $index) {
          <line class="grid" [attr.x1]="g.margemEsq" [attr.x2]="g.largura" [attr.y1]="linha.y" [attr.y2]="linha.y" />
          <text class="ax" [attr.x]="g.margemEsq - 6" [attr.y]="linha.y + 4" text-anchor="end">{{ linha.texto }}</text>
        }
        @for (b of g.barras; track $index) {
          <g [srtTooltip]="b.dica">
            <rect
              class="bar"
              [class.dim]="b.esmaecida"
              [attr.x]="b.x"
              [attr.y]="b.y"
              [attr.width]="b.largura"
              [attr.height]="b.altura"
              rx="3"
            />
            @if (b.mostrarValor) {
              <text [attr.x]="b.centro" [attr.y]="b.y - 4" text-anchor="middle" font-weight="600">{{ b.valorTexto }}</text>
            }
            <text class="ax rotulo" [attr.x]="b.centro" [attr.y]="g.altura - g.margemInf + 14" text-anchor="middle" font-size="9">{{
              b.rotulo
            }}</text>
            <rect
              class="zona"
              [attr.x]="b.zonaX"
              [attr.y]="g.margemSup"
              [attr.width]="b.zonaLargura"
              [attr.height]="g.altura - g.margemSup - g.margemInf"
              fill="transparent"
            />
          </g>
        }
      </svg>
    </div>
  `,
  styles: [
    ESTILOS_SVG,
    `
      .rolagem {
        overflow-x: auto;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraficoBarrasVerticaisComponent {
  readonly itens = input.required<readonly ItemBarraVertical[]>();
  readonly rotuloAria = input.required<string>();
  /**
   * `destaque`: valor só acima das barras destacadas; `todos`: acima de todas; `nenhum`: nunca.
   */
  readonly mostrarValorEm = input<'destaque' | 'todos' | 'nenhum'>('destaque');
  /**
   * Largura mínima (unidades do viewBox, ~px) de cada barra. Se a largura padrão do gráfico não comportar
   * os itens com essa largura, o viewBox cresce e o gráfico ganha rolagem horizontal.
   */
  readonly larguraMinimaBarra = input<number>();

  protected readonly geometria = computed(() => {
    const itens = this.itens();
    const minima = this.larguraMinimaBarra();
    const modo = this.mostrarValorEm();
    const quantidade = itens.length;

    const larguraNecessaria = minima ? MARGEM_ESQ + MARGEM_DIR + quantidade * minima : 0;
    const largura = Math.max(LARGURA_PADRAO, larguraNecessaria);
    const larguraSlot = quantidade ? (largura - MARGEM_ESQ - MARGEM_DIR) / quantidade : 0;
    const alturaUtil = ALTURA - MARGEM_SUP - MARGEM_INF;
    const max = maximo(itens.map((i) => i.valor)) || 1;
    const haDestaque = itens.some((i) => i.destaque);

    const linhas = Array.from({ length: DIVISOES + 1 }, (_, i) => {
      const valor = Math.round((max * i) / DIVISOES);
      return { y: MARGEM_SUP + alturaUtil * (1 - valor / max), texto: formatarInteiro(valor) };
    });

    const barras: BarraCalculada[] = itens.map((item, i) => {
      const altura = (alturaUtil * Math.max(item.valor, 0)) / max;
      const x = MARGEM_ESQ + i * larguraSlot + 1;
      const larguraBarra = Math.max(larguraSlot - 2, 1);
      const destacada = !!item.destaque;
      return {
        x,
        y: ALTURA - MARGEM_INF - altura,
        largura: larguraBarra,
        altura,
        centro: x + larguraBarra / 2,
        rotulo: item.rotulo,
        valorTexto: formatarInteiro(item.valor),
        esmaecida: haDestaque && !destacada,
        mostrarValor: modo === 'todos' || (modo === 'destaque' && destacada),
        dica: item.dica ?? `<b>${escaparHtml(item.rotulo)}</b>: ${formatarInteiro(item.valor)}`,
        zonaX: x - 1,
        zonaLargura: larguraSlot,
      };
    });

    return {
      largura,
      altura: ALTURA,
      margemEsq: MARGEM_ESQ,
      margemInf: MARGEM_INF,
      margemSup: MARGEM_SUP,
      larguraMinimaSvg: minima ? larguraNecessaria : null,
      linhas,
      barras,
    };
  });
}
