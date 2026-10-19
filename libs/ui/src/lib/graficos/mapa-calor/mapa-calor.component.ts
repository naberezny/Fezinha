import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { doisDigitos, escaparHtml } from '../formatos';
import { TooltipDirective } from '../tooltip.directive';

export interface LinhaMapaCalor {
  /** Texto mostrado à esquerda da linha (ex.: "25/11"). */
  rotulo: string;
  /** Chave usada em `valores` (ex.: "2025-11"). */
  chave: string;
}

const COLUNA_ROTULO = 44;
/** Valores a partir deste são pintados com a cor mais escura (`--seq-700`). */
const NIVEL_MAXIMO = 4;

/**
 * Mapa de calor linhas × colunas (`heat()` do protótipo), ex.: mês × dezena.
 * As colunas são numeradas de 1 a `colunas`; o valor de cada célula vem de `valores["<chave>|<coluna>"]`
 * (ausente = 0). `data-v` vai de 0 a 4, sendo 4 = "4 ou mais".
 */
@Component({
  selector: 'srt-mapa-calor',
  imports: [TooltipDirective],
  template: `
    @let g = geometria();
    <div class="rolagem">
      <div class="heat" role="img" [attr.aria-label]="rotuloAria()" [style.min-width.px]="g.larguraMinima">
        <div class="hx" [style.grid-template-columns]="g.modelo">
          <span></span>
          @for (rotulo of g.cabecalho; track $index) {
            <span>{{ rotulo }}</span>
          }
        </div>
        @for (linha of g.linhas; track linha.chave) {
          <div class="r" [style.grid-template-columns]="g.modelo">
            <span class="l">{{ linha.rotulo }}</span>
            @for (celula of linha.celulas; track $index) {
              <span class="c" [attr.data-v]="celula.nivel" [srtTooltip]="celula.dica"></span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .rolagem {
      overflow-x: auto;
    }
    .heat {
      display: grid;
      gap: 2px;
    }
    .r,
    .hx {
      display: grid;
      gap: 2px;
      align-items: center;
    }
    .l {
      font-size: 11px;
      color: var(--muted);
      font-family: var(--mono);
    }
    .c {
      aspect-ratio: 1;
      border-radius: 2px;
      background: var(--seq-100);
      min-width: 0;
    }
    .c[data-v='1'] {
      background: var(--seq-250);
    }
    .c[data-v='2'] {
      background: var(--seq-400);
    }
    .c[data-v='3'] {
      background: var(--seq-550);
    }
    .c[data-v='4'] {
      background: var(--seq-700);
    }
    .hx {
      font-size: 9px;
      color: var(--muted);
      font-family: var(--mono);
    }
    .hx span {
      text-align: center;
      overflow: hidden;
    }
    @media (max-width: 860px) {
      .hx span:nth-child(n + 2):not(:nth-child(5n + 2)) {
        visibility: hidden;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaCalorComponent {
  readonly linhas = input.required<readonly LinhaMapaCalor[]>();
  /** Quantidade de colunas (numeradas de 1 a `colunas`). */
  readonly colunas = input.required<number>();
  /** Valor por célula, chave `"<chaveLinha>|<coluna>"`. */
  readonly valores = input.required<ReadonlyMap<string, number> | Readonly<Record<string, number>>>();
  /** Texto do cabeçalho de cada coluna (recebe 1..colunas). Padrão: número com dois dígitos. */
  readonly rotuloColuna = input<(coluna: number) => string>(doisDigitos);
  readonly rotuloAria = input('Mapa de calor');
  /**
   * Largura mínima (px) de cada coluna. Quando o mapa não couber com essa largura (ex.: 100 dezenas da Lotomania
   * num celular), ele ganha rolagem horizontal em vez de encolher as células. Sem valor, as colunas se ajustam à tela.
   */
  readonly larguraMinimaColuna = input<number>();

  protected readonly geometria = computed(() => {
    const total = Math.max(0, Math.floor(this.colunas()));
    const valores = this.valores();
    const rotuloColuna = this.rotuloColuna();
    const buscar = (chave: string): number =>
      (valores instanceof Map ? valores.get(chave) : (valores as Readonly<Record<string, number>>)[chave]) ?? 0;

    const numeros = Array.from({ length: total }, (_, i) => i + 1);
    const rotulos = numeros.map((c) => rotuloColuna(c));

    const linhas = this.linhas().map((linha) => ({
      rotulo: linha.rotulo,
      chave: linha.chave,
      celulas: numeros.map((c, i) => {
        const valor = buscar(`${linha.chave}|${c}`);
        return {
          nivel: Math.min(Math.max(valor, 0), NIVEL_MAXIMO),
          dica: `<b>${escaparHtml(rotulos[i])}</b> em ${escaparHtml(linha.rotulo)}: ${valor}×`,
        };
      }),
    }));

    const minima = this.larguraMinimaColuna();
    return {
      larguraMinima: minima ? COLUNA_ROTULO + total * (minima + 2) : null,
      modelo: `${COLUNA_ROTULO}px repeat(${total}, minmax(0, 1fr))`,
      cabecalho: rotulos,
      linhas,
    };
  });
}
