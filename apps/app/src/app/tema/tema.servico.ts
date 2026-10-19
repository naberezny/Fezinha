import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

export type Tema = 'sistema' | 'claro' | 'escuro';

export const CHAVE_TEMA = 'sorteios.tema';
const CONSULTA_ESCURO = '(prefers-color-scheme: dark)';

/**
 * Tema explícito do app. "sistema" segue o `prefers-color-scheme` (sem atributo);
 * "claro" e "escuro" gravam `data-theme` no <html>, que os tokens de
 * `styles/tokens.scss` usam para sobrepor o tema do sistema.
 */
@Injectable({ providedIn: 'root' })
export class TemaServico {
  private readonly documento = inject(DOCUMENT);

  private readonly _tema = signal<Tema>(this.lerPersistido());
  private readonly sistemaEscuro = signal(this.sistemaPrefereEscuro());

  readonly tema = this._tema.asReadonly();
  /** Verdadeiro quando o tema efetivo (explícito ou do sistema) é o escuro. */
  readonly escuroEfetivo = computed(() => {
    const tema = this._tema();
    return tema === 'escuro' || (tema === 'sistema' && this.sistemaEscuro());
  });

  /** Ícone da ação de alternar: sol quando o tema atual é escuro (clicar vai para o claro) e lua no inverso. */
  readonly iconeAlternar = computed(() => (this.escuroEfetivo() ? 'sunny-outline' : 'moon-outline'));
  readonly rotuloAlternar = computed(() => (this.escuroEfetivo() ? 'Usar tema claro' : 'Usar tema escuro'));

  constructor() {
    this.aplicar(this._tema());
    this.acompanharSistema();
  }

  definir(tema: Tema): void {
    this._tema.set(tema);
    this.aplicar(tema);
    this.persistir(tema);
  }

  /** Alterna entre claro e escuro, a partir do tema efetivo atual. */
  alternar(): void {
    this.definir(this.escuroEfetivo() ? 'claro' : 'escuro');
  }

  private aplicar(tema: Tema): void {
    const raiz = this.documento.documentElement;
    if (tema === 'sistema') {
      raiz.removeAttribute('data-theme');
    } else {
      raiz.setAttribute('data-theme', tema === 'escuro' ? 'dark' : 'light');
    }
  }

  private lerPersistido(): Tema {
    try {
      const valor = localStorage.getItem(CHAVE_TEMA);
      return valor === 'claro' || valor === 'escuro' ? valor : 'sistema';
    } catch {
      return 'sistema';
    }
  }

  private persistir(tema: Tema): void {
    try {
      localStorage.setItem(CHAVE_TEMA, tema);
    } catch {
      // Armazenamento indisponível (modo privado, cota): o tema vale só na sessão.
    }
  }

  private sistemaPrefereEscuro(): boolean {
    return this.consultaSistema()?.matches ?? false;
  }

  private acompanharSistema(): void {
    this.consultaSistema()?.addEventListener('change', (evento) =>
      this.sistemaEscuro.set(evento.matches),
    );
  }

  private consultaSistema(): MediaQueryList | null {
    const janela = this.documento.defaultView;
    return typeof janela?.matchMedia === 'function'
      ? janela.matchMedia(CONSULTA_ESCURO)
      : null;
  }
}
