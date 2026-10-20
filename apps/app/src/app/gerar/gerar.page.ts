import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import type { LoteriaDefinicao } from '@sorteios/core';
import {
  AcordeaoComponent,
  AcordeaoSecaoComponent,
  AvisoComponent,
  JogoComponent,
  StepperComponent,
  SwitchComponent,
  VolanteComponent,
  formatarDataBR,
} from '@sorteios/ui';
import { HistoricoStore, JogosSalvosStore } from '../dados/historico.store';
import {
  ATRASO_MINIMO_MAX,
  ATRASO_MINIMO_MIN,
  GerarEstado,
  INTENSIDADE_MAX,
  INTENSIDADE_MIN,
  INTENSIDADE_PASSO,
  MODOS_GERACAO,
  PROPORCAO_FRIAS_PASSO,
  QUANTIDADE_JOGOS_MAX,
  QUANTIDADE_JOGOS_MIN,
  formatarMilhar,
  type JanelaFrequencia,
} from './gerar.estado';

const DURACAO_ROTULO_MS = 1500;

/** "6 a 20 dezenas de 60"; aposta fixa: "50 dezenas de 100". */
function descricaoDaAposta({ aposta, universo }: LoteriaDefinicao): string {
  const dezenas = aposta.min === aposta.max ? `${aposta.min} dezenas` : `${aposta.min} a ${aposta.max} dezenas`;
  return `${dezenas} de ${universo}`;
}

type NavegadorComShare = Navigator & { share?: (dados: { title?: string; text?: string }) => Promise<void> };

/** Tela "Gerar jogos": configuração à esquerda, jogos gerados à direita (docs/01-especificacao.md, 6.2). */
@Component({
  selector: 'srt-gerar-page',
  imports: [
    IonContent,
    RouterLink,
    AcordeaoComponent,
    AcordeaoSecaoComponent,
    AvisoComponent,
    JogoComponent,
    StepperComponent,
    SwitchComponent,
    VolanteComponent,
  ],
  templateUrl: './gerar.page.html',
  styleUrl: './gerar.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GerarPage implements OnInit {
  protected readonly estado = inject(GerarEstado);
  protected readonly historicoStore = inject(HistoricoStore);
  private readonly jogosSalvosStore = inject(JogosSalvosStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly modos = MODOS_GERACAO;
  protected readonly descricaoDaAposta = computed(() => descricaoDaAposta(this.estado.loteria()));
  protected readonly limites = {
    quantidade: { min: QUANTIDADE_JOGOS_MIN, max: QUANTIDADE_JOGOS_MAX },
    atrasoMinimo: { min: ATRASO_MINIMO_MIN, max: ATRASO_MINIMO_MAX },
    intensidade: { min: INTENSIDADE_MIN, max: INTENSIDADE_MAX, passo: INTENSIDADE_PASSO },
    proporcaoFrias: { min: 0, max: 1, passo: PROPORCAO_FRIAS_PASSO },
  };

  // ---------- Histórico ----------
  protected readonly historicoPronto = computed(() => this.historicoStore.historico() !== undefined);

  /** Cabeçalho: "Base: 3.070 concursos, último em 14/10/2026". */
  protected readonly textoBase = computed(() => {
    const historico = this.historicoStore.historico();
    const ultimo = this.historicoStore.ultimo();
    if (!historico || !ultimo) return undefined;
    return `Base: ${formatarMilhar(historico.concursos.length)} concursos, último em ${formatarDataBR(ultimo.data)}`;
  });

  /** Mensagem que acompanha o botão Gerar desabilitado (sem cache nem rede ainda). */
  protected readonly mensagemSemHistorico = computed(() =>
    this.historicoPronto() ? undefined : (this.historicoStore.erro() ?? 'Carregando histórico…'),
  );

  /** Erro de rede com cache disponível: aviso discreto, não bloqueia. */
  protected readonly avisoComCache = computed(() => (this.historicoPronto() ? this.historicoStore.erro() : undefined));

  // ---------- Ações da saída ----------
  protected readonly rotuloCopiar = signal('Copiar');
  protected readonly rotuloExportar = signal('Exportar');
  protected readonly salvando = signal(false);
  protected readonly erroSalvar = signal<string | undefined>(undefined);
  /** Resultado que já foi salvo (para não duplicar o salvamento e mostrar a confirmação inline). */
  private readonly resultadoSalvo = signal<unknown>(undefined);
  protected readonly jaSalvo = computed(
    () => this.estado.resultado() !== undefined && this.resultadoSalvo() === this.estado.resultado(),
  );

  private readonly temporizadores = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    this.destroyRef.onDestroy(() => this.temporizadores.forEach((id) => clearTimeout(id)));
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.historicoStore.carregar();
    } catch {
      // O erro de rede é exposto por `historicoStore.erro()`; a tela segue com o cache, se houver.
    }
  }

  // ---------- Formulário ----------
  protected aoSubmeter(evento: Event): void {
    evento.preventDefault();
    this.estado.gerar();
  }

  protected aoMudarJanela(evento: Event): void {
    this.estado.definirJanelaFrequencia((evento.target as HTMLSelectElement).value as JanelaFrequencia);
  }

  protected aoMudarAtrasoMinimo(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    if (Number.isNaN(campo.valueAsNumber)) return;
    this.estado.definirAtrasoMinimo(campo.valueAsNumber);
    // Valor fora dos limites: o signal pode não mudar, então força o campo a mostrar o valor aceito.
    if (campo.valueAsNumber !== this.estado.atrasoMinimo()) campo.value = String(this.estado.atrasoMinimo());
  }

  protected aoMudarIntensidade(evento: Event): void {
    this.estado.definirIntensidade((evento.target as HTMLInputElement).valueAsNumber);
  }

  protected aoMudarProporcaoFrias(evento: Event): void {
    this.estado.definirProporcaoFrias((evento.target as HTMLInputElement).valueAsNumber);
  }

  // ---------- Saída ----------
  protected async copiar(): Promise<void> {
    const copiado = await this.copiarTexto(this.estado.textoJogos());
    if (copiado) this.piscar(this.rotuloCopiar, 'Copiado', 'Copiar');
  }

  protected async salvar(): Promise<void> {
    const jogos = this.estado.jogosParaSalvar();
    const resultado = this.estado.resultado();
    if (!jogos.length || this.salvando() || this.jaSalvo()) return;
    this.salvando.set(true);
    this.erroSalvar.set(undefined);
    try {
      await this.jogosSalvosStore.salvar(jogos);
      this.resultadoSalvo.set(resultado);
    } catch {
      this.erroSalvar.set('Não foi possível salvar os jogos. Tente de novo.');
    } finally {
      this.salvando.set(false);
    }
  }

  protected async exportar(): Promise<void> {
    const texto = this.estado.textoJogos();
    if (!texto) return;
    const navegador = navigator as NavegadorComShare;
    if (typeof navegador.share === 'function') {
      try {
        await navegador.share({ title: `Jogos da ${this.estado.loteria().nome}`, text: texto });
        return;
      } catch (erro) {
        // Cancelar o painel de compartilhamento não é falha; qualquer outra falha cai na cópia.
        if ((erro as { name?: string }).name === 'AbortError') return;
      }
    }
    if (await this.copiarTexto(texto)) this.piscar(this.rotuloExportar, 'Copiado', 'Exportar');
  }

  protected textoSalvo(): string {
    const quantidade = this.estado.jogos().length;
    return `${quantidade} jogo${quantidade > 1 ? 's' : ''} salvo${quantidade > 1 ? 's' : ''} em Meus jogos`;
  }

  /** Área de transferência moderna; sem ela (ou se recusar), cai para textarea + execCommand. */
  private async copiarTexto(texto: string): Promise<boolean> {
    if (!texto) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        return true;
      }
    } catch {
      // segue para o fallback
    }
    return this.copiarComTextarea(texto);
  }

  private copiarComTextarea(texto: string): boolean {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    try {
      return typeof document.execCommand === 'function' && document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }

  /** Troca o rótulo do botão por `temporario` durante 1,5 s. */
  private piscar(rotulo: WritableSignal<string>, temporario: string, original: string): void {
    rotulo.set(temporario);
    const id = setTimeout(() => {
      rotulo.set(original);
      this.temporizadores.delete(id);
    }, DURACAO_ROTULO_MS);
    this.temporizadores.add(id);
  }
}
