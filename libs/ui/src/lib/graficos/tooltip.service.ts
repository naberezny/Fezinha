import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';

const CLASSE = 'tip srt-tip';
const ESTILO_ID = 'srt-tip-estilo';
const LARGURA_RESERVADA = 250;
const DESLOCAMENTO = 12;

/**
 * Dica flutuante única (`.tip` do protótipo): um só elemento fixo no `document.body`,
 * reaproveitado por todos os gráficos.
 *
 * O conteúdo é HTML simples (`<b>`, `<br>`) montado pelos componentes da lib; nunca passe
 * texto digitado pelo usuário sem antes escapá-lo.
 */
@Injectable({ providedIn: 'root' })
export class TooltipService {
  private readonly documento = inject(DOCUMENT);
  private elemento?: HTMLElement;
  private conteudoAtual = '';

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.elemento?.remove();
      this.elemento = undefined;
    });
  }

  /** Mostra a dica perto do ponto (coordenadas de viewport), limitada à largura da janela. */
  mostrar(html: string, clientX: number, clientY: number): void {
    const dica = this.obterElemento();
    if (html !== this.conteudoAtual) {
      dica.innerHTML = html;
      this.conteudoAtual = html;
    }
    const largura = this.documento.defaultView?.innerWidth ?? 0;
    const esquerda = Math.max(0, Math.min(clientX + DESLOCAMENTO, largura - LARGURA_RESERVADA));
    dica.style.left = `${esquerda}px`;
    dica.style.top = `${clientY + DESLOCAMENTO}px`;
    dica.style.display = 'block';
  }

  esconder(): void {
    if (this.elemento) this.elemento.style.display = 'none';
  }

  private obterElemento(): HTMLElement {
    if (this.elemento) return this.elemento;

    this.injetarEstilo();
    const dica = this.documento.createElement('div');
    dica.className = CLASSE;
    dica.setAttribute('role', 'tooltip');
    dica.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'background:var(--fg)',
      'color:var(--bg)',
      'font-size:12px',
      'padding:6px 8px',
      'border-radius:6px',
      'z-index:9',
      'display:none',
      'max-width:240px',
      'line-height:1.3',
    ].join(';');
    this.documento.body.appendChild(dica);
    this.elemento = dica;
    return dica;
  }

  /** `.tip b` do protótipo (mono nos números): não dá para expressar em estilo inline. */
  private injetarEstilo(): void {
    if (this.documento.getElementById(ESTILO_ID)) return;
    const estilo = this.documento.createElement('style');
    estilo.id = ESTILO_ID;
    estilo.textContent = '.srt-tip b{font-family:var(--mono)}';
    this.documento.head.appendChild(estilo);
  }
}
