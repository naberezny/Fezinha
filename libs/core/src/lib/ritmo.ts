import { dezenasDe, ultimaDezena } from './tipos';
import type { Historico, LoteriaDefinicao } from './tipos';

/**
 * Ritmo de reaparecimento de uma dezena: de quantos em quantos concursos ela volta a sair.
 *
 * É descrição do passado. Medido nos resultados reais, o ritmo de cada dezena fica dentro do que o acaso produz e não
 * prevê o concurso seguinte (ver a tela "Teste" e `testarEstrategias`).
 */
export interface RitmoDezena {
  dezena: number;
  /** Vezes que saiu no histórico. */
  aparicoes: number;
  /** Média de concursos entre uma aparição e a seguinte (1 = saiu no concurso seguinte). Ausente com menos de 2 aparições. */
  intervaloMedio?: number;
  /** Desvio padrão desses intervalos. Ausente com menos de 2 aparições. */
  intervaloDesvio?: number;
  /** Maior sequência de concursos sem sair entre duas aparições (não conta o trecho inicial nem o atraso atual). */
  maiorAusencia: number;
  /** Concursos desde a última aparição (0 = saiu no último), como `EstatisticaDezena.atraso`. */
  atraso: number;
  /**
   * Fração (0..1) das ausências já encerradas da dezena que foram mais curtas que o atraso atual: 0,9 = "ela já está
   * fora há mais tempo do que em 90% das vezes". 0 quando ainda não há ausência encerrada.
   */
  passouDe: number;
}

/**
 * Acompanha o ritmo concurso a concurso (para o teste das estratégias, que precisa do ritmo "até ali" em cada ponto).
 * Os concursos devem chegar em ordem crescente.
 */
export class AcompanhamentoRitmo {
  private readonly dezenas: number[];
  private readonly ultimoIndice: number[];
  private readonly aparicoes: number[];
  private readonly somaIntervalos: number[];
  private readonly somaQuadrados: number[];
  /** Por dezena: contagem de ausências encerradas por duração (posição = concursos sem sair). */
  private readonly ausencias: number[][];
  private total = 0;

  constructor(def: LoteriaDefinicao) {
    const tamanho = ultimaDezena(def) + 1;
    this.dezenas = dezenasDe(def);
    this.ultimoIndice = new Array<number>(tamanho).fill(-1);
    this.aparicoes = new Array<number>(tamanho).fill(0);
    this.somaIntervalos = new Array<number>(tamanho).fill(0);
    this.somaQuadrados = new Array<number>(tamanho).fill(0);
    this.ausencias = Array.from({ length: tamanho }, () => []);
  }

  /** Registra o próximo concurso. */
  adicionar(dezenas: readonly number[]): void {
    for (const dezena of dezenas) {
      const anterior = this.ultimoIndice[dezena];
      if (anterior >= 0) {
        const intervalo = this.total - anterior;
        this.somaIntervalos[dezena] += intervalo;
        this.somaQuadrados[dezena] += intervalo * intervalo;
        const contagem = this.ausencias[dezena];
        const ausencia = intervalo - 1;
        while (contagem.length <= ausencia) contagem.push(0);
        contagem[ausencia]++;
      }
      this.ultimoIndice[dezena] = this.total;
      this.aparicoes[dezena]++;
    }
    this.total++;
  }

  /** Concursos desde a última aparição (o total registrado, se nunca saiu). */
  atraso(dezena: number): number {
    const indice = this.ultimoIndice[dezena];
    return indice < 0 ? this.total : this.total - 1 - indice;
  }

  /** Ver `RitmoDezena.passouDe`. */
  passouDe(dezena: number): number {
    const encerradas = Math.max(this.aparicoes[dezena] - 1, 0);
    if (encerradas === 0) return 0;
    const contagem = this.ausencias[dezena];
    const limite = Math.min(this.atraso(dezena), contagem.length);
    let maisCurtas = 0;
    for (let ausencia = 0; ausencia < limite; ausencia++) maisCurtas += contagem[ausencia];
    return maisCurtas / encerradas;
  }

  ritmo(dezena: number): RitmoDezena {
    const intervalos = Math.max(this.aparicoes[dezena] - 1, 0);
    const ritmo: RitmoDezena = {
      dezena,
      aparicoes: this.aparicoes[dezena],
      maiorAusencia: Math.max(this.ausencias[dezena].length - 1, 0),
      atraso: this.atraso(dezena),
      passouDe: this.passouDe(dezena),
    };
    if (intervalos > 0) {
      const media = this.somaIntervalos[dezena] / intervalos;
      ritmo.intervaloMedio = media;
      ritmo.intervaloDesvio = Math.sqrt(Math.max(this.somaQuadrados[dezena] / intervalos - media * media, 0));
    }
    return ritmo;
  }

  /** Uma entrada por dezena válida, na ordem do volante. */
  listar(): RitmoDezena[] {
    return this.dezenas.map((dezena) => this.ritmo(dezena));
  }
}

/** Ritmo de cada dezena válida no histórico inteiro, na ordem do volante. */
export function calcularRitmo(historico: Historico): RitmoDezena[] {
  const acompanhamento = new AcompanhamentoRitmo(historico.loteria);
  for (const concurso of historico.concursos) acompanhamento.adicionar(concurso.dezenas);
  return acompanhamento.listar();
}
