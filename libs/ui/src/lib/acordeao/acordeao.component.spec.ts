import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AcordeaoSecaoComponent } from './acordeao-secao.component';
import { AcordeaoComponent } from './acordeao.component';

@Component({
  imports: [AcordeaoComponent, AcordeaoSecaoComponent],
  template: `
    <srt-acordeao>
      <srt-acordeao-secao titulo="Modo de geração" resumo="Dezenas atrasadas" [aberta]="primeiraAberta()">
        <p class="corpo-1">conteúdo um</p>
      </srt-acordeao-secao>
      <srt-acordeao-secao titulo="Regras" resumo="3 regras">
        <p class="corpo-2">conteúdo dois</p>
      </srt-acordeao-secao>
    </srt-acordeao>
  `,
})
class AnfitriaComponent {
  readonly primeiraAberta = signal(false);
}

describe('AcordeaoComponent', () => {
  let fixture: ComponentFixture<AnfitriaComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const secoes = () => Array.from(host().querySelectorAll('srt-acordeao-secao'));
  const resumoDe = (indice: number) => secoes()[indice].querySelector('.val')?.textContent?.trim();

  beforeEach(async () => {
    fixture = TestBed.createComponent(AnfitriaComponent);
    await fixture.whenStable();
  });

  it('mostra o resumo apenas quando a seção está fechada', async () => {
    expect(resumoDe(0)).toBe('Dezenas atrasadas');
    expect(resumoDe(1)).toBe('3 regras');

    fixture.componentInstance.primeiraAberta.set(true);
    await fixture.whenStable();

    expect(resumoDe(0)).toBeUndefined();
    expect(secoes()[0].querySelector('details')?.hasAttribute('open')).toBe(true);
    expect(resumoDe(1)).toBe('3 regras');
  });

  it('projeta o conteúdo e o título de cada seção', () => {
    expect(secoes()[0].querySelector('.lbl')?.textContent).toBe('Modo de geração');
    expect(secoes()[0].querySelector('.sec-body .corpo-1')?.textContent).toBe('conteúdo um');
    expect(secoes()[1].querySelector('.sec-body .corpo-2')?.textContent).toBe('conteúdo dois');
  });

  it('sincroniza o estado aberto quando o usuário abre o details', async () => {
    const details = secoes()[1].querySelector('details') as HTMLDetailsElement;

    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    await fixture.whenStable();

    expect(resumoDe(1)).toBeUndefined();
  });
});
