import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Concurso } from '@sorteios/core';
import { BolaComponent } from '../../bola/bola.component';
import { formatarDataBR, formatarReais } from '../formatos';

/** Tabela dos últimos concursos (`tabela()` do protótipo): dezenas, situação, ganhadores e prêmios. */
@Component({
  selector: 'srt-tabela-resultados',
  imports: [BolaComponent],
  template: `
    <div class="tbl-wrap">
      <table [attr.aria-label]="rotuloAria()">
        <thead>
          <tr>
            <th scope="col">Concurso</th>
            <th scope="col">Data</th>
            <th scope="col">Dezenas</th>
            <th scope="col">Situação</th>
            <th scope="col" class="dir">Ganhadores ({{ rotuloPrincipal() }})</th>
            <th scope="col" class="dir">Prêmio / acumulado</th>
            <th scope="col" class="dir">Estimativa seguinte</th>
          </tr>
        </thead>
        <tbody>
          @for (linha of linhas(); track linha.numero) {
            <tr>
              <td class="num">{{ linha.numero }}</td>
              <td>{{ linha.data }}</td>
              <td>
                <div class="bolas">
                  @for (dezena of linha.dezenas; track $index) {
                    <srt-bola [dezena]="dezena" [pequena]="true" />
                  }
                </div>
              </td>
              <td>
                @if (linha.acumulou) {
                  <span class="pill acum">Acumulou</span>
                } @else {
                  <span class="pill pago">Prêmio pago</span>
                }
              </td>
              <td class="num dir">{{ linha.ganhadores }}</td>
              <td class="num dir">{{ linha.premio }}</td>
              <td class="num dir">{{ linha.estimativa }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .tbl-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    th {
      text-align: left;
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 600;
      padding: 6px 8px;
      border-bottom: 1px solid var(--line);
    }
    td {
      padding: 8px;
      border-bottom: 1px solid var(--line);
      vertical-align: middle;
    }
    tr:last-child td {
      border-bottom: 0;
    }
    .dir {
      text-align: right;
    }
    .num {
      font-family: var(--mono);
      font-variant-numeric: tabular-nums;
    }
    .bolas {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      /* 20 bolas (Lotomania) quebram em duas linhas de 10 em vez de alargar a tabela;
         a largura mínima garante 10 por linha também no celular (a tabela rola na horizontal). */
      max-width: 330px;
      min-width: 316px;
    }
    .pill {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid var(--line);
      color: var(--muted);
    }
    .pill.acum {
      color: var(--crit);
      border-color: color-mix(in srgb, var(--crit) 40%, transparent);
      background: color-mix(in srgb, var(--crit) 10%, transparent);
    }
    .pill.pago {
      color: var(--good);
      border-color: color-mix(in srgb, var(--good) 40%, transparent);
      background: color-mix(in srgb, var(--good) 10%, transparent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabelaResultadosComponent {
  readonly concursos = input.required<readonly Concurso[]>();
  readonly rotuloAria = input('Resultados dos últimos concursos');
  /** Nome do prêmio principal da loteria (`faixas[0].nome`), citado no cabeçalho "Ganhadores (...)". */
  readonly rotuloPrincipal = input('Sena');

  protected readonly linhas = computed(() =>
    this.concursos().map((concurso) => {
      const principal = concurso.premiacoes.find((p) => p.faixa === 1);
      return {
        numero: concurso.numero,
        data: formatarDataBR(concurso.data),
        dezenas: concurso.dezenas,
        acumulou: concurso.acumulou,
        ganhadores: principal?.ganhadores ?? 0,
        premio: formatarReais(concurso.acumulou ? concurso.valorAcumuladoCentavos : (principal?.rateioCentavos ?? BigInt(0))),
        estimativa: formatarReais(concurso.estimativaProximoCentavos),
      };
    }),
  );
}
