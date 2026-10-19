import { Directive, ElementRef, OnDestroy, inject, input } from '@angular/core';
import { TooltipService } from './tooltip.service';

/**
 * Liga um elemento (HTML ou SVG, como `<g>`) à dica flutuante compartilhada.
 * Mostra em `mousemove`/`focus`, esconde em `mouseleave`/`blur`.
 *
 * O valor é HTML simples gerado pela aplicação (nunca texto de usuário); valor vazio não mostra nada.
 */
@Directive({
  selector: '[srtTooltip]',
  host: {
    '(mousemove)': 'aoMover($event)',
    '(mouseleave)': 'esconder()',
    '(focus)': 'aoFocar()',
    '(blur)': 'esconder()',
  },
})
export class TooltipDirective implements OnDestroy {
  readonly srtTooltip = input<string | null | undefined>('');

  private readonly servico = inject(TooltipService);
  private readonly elemento = inject<ElementRef<Element>>(ElementRef);
  private visivel = false;

  protected aoMover(evento: MouseEvent): void {
    this.mostrar(evento.clientX, evento.clientY);
  }

  protected aoFocar(): void {
    const caixa = this.elemento.nativeElement.getBoundingClientRect();
    this.mostrar(caixa.left + caixa.width / 2, caixa.top + caixa.height / 2);
  }

  protected esconder(): void {
    if (!this.visivel) return;
    this.visivel = false;
    this.servico.esconder();
  }

  ngOnDestroy(): void {
    this.esconder();
  }

  private mostrar(x: number, y: number): void {
    const texto = this.srtTooltip();
    if (!texto) return;
    this.visivel = true;
    this.servico.mostrar(texto, x, y);
  }
}
