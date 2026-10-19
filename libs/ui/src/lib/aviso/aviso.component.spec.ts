import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvisoComponent } from './aviso.component';

@Component({
  imports: [AvisoComponent],
  template: `<srt-aviso><b>Cada sorteio é independente.</b> A chance real de cada jogo não muda.</srt-aviso>`,
})
class AnfitriaComponent {}

describe('AvisoComponent', () => {
  let fixture: ComponentFixture<AnfitriaComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(AnfitriaComponent);
    await fixture.whenStable();
  });

  it('renderiza o ícone e projeta o conteúdo', () => {
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('srt-aviso') as HTMLElement;

    expect(aviso.textContent).toContain('ⓘ');
    expect(aviso.querySelector('b')?.textContent).toBe('Cada sorteio é independente.');
    expect(aviso.textContent).toContain('A chance real de cada jogo não muda.');
  });

  it('expõe o papel de nota para tecnologias assistivas', () => {
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('srt-aviso');

    expect(aviso?.getAttribute('role')).toBe('note');
  });
});
