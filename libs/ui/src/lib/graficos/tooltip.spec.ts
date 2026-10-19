import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TooltipDirective } from './tooltip.directive';

@Component({
  selector: 'srt-teste-tooltip',
  imports: [TooltipDirective],
  template: `
    <button id="botao" [srtTooltip]="texto()">botão</button>
    <svg viewBox="0 0 10 10">
      <g id="grupo" srtTooltip="grupo <b>svg</b>"><rect width="5" height="5" /></g>
    </svg>
  `,
})
class HospedeTesteComponent {
  readonly texto = signal('dezena <b>07</b>: 12×');
}

describe('TooltipDirective', () => {
  let fixture: ComponentFixture<HospedeTesteComponent>;
  const dica = () => document.body.querySelector('.srt-tip') as HTMLElement | null;
  const elemento = (id: string) => fixture.nativeElement.querySelector(`#${id}`) as Element;
  const mover = (alvo: Element, x: number, y: number) =>
    alvo.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));

  beforeEach(async () => {
    fixture = TestBed.createComponent(HospedeTesteComponent);
    await fixture.whenStable();
  });

  it('não cria a dica antes de qualquer interação', () => {
    expect(dica()).toBeNull();
  });

  it('mostra a dica no body ao mover o mouse, posicionada com 12px de deslocamento', () => {
    mover(elemento('botao'), 100, 50);

    expect(dica()?.style.display).toBe('block');
    expect(dica()?.innerHTML).toBe('dezena <b>07</b>: 12×');
    expect(dica()?.style.left).toBe('112px');
    expect(dica()?.style.top).toBe('62px');
    expect(dica()?.parentElement).toBe(document.body);
  });

  it('limita a posição horizontal à largura da janela', () => {
    mover(elemento('botao'), window.innerWidth + 500, 10);

    expect(dica()?.style.left).toBe(`${window.innerWidth - 250}px`);
  });

  it('esconde a dica ao sair com o mouse', () => {
    mover(elemento('botao'), 10, 10);
    elemento('botao').dispatchEvent(new MouseEvent('mouseleave'));

    expect(dica()?.style.display).toBe('none');
  });

  it('funciona em elemento SVG (<g>)', () => {
    mover(elemento('grupo'), 30, 40);
    expect(dica()?.style.display).toBe('block');
    expect(dica()?.innerHTML).toBe('grupo <b>svg</b>');

    elemento('grupo').dispatchEvent(new MouseEvent('mouseleave'));
    expect(dica()?.style.display).toBe('none');
  });

  it('mostra no foco e esconde no blur', () => {
    elemento('botao').dispatchEvent(new FocusEvent('focus'));
    expect(dica()?.style.display).toBe('block');

    elemento('botao').dispatchEvent(new FocusEvent('blur'));
    expect(dica()?.style.display).toBe('none');
  });

  it('não mostra nada quando o texto está vazio', async () => {
    fixture.componentInstance.texto.set('');
    await fixture.whenStable();

    mover(elemento('botao'), 10, 10);

    expect(dica()?.style.display ?? 'none').toBe('none');
  });
});
