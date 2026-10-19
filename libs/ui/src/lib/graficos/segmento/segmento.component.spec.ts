import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SegmentoComponent } from './segmento.component';

describe('SegmentoComponent', () => {
  let fixture: ComponentFixture<SegmentoComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const botoes = () => Array.from(host().querySelectorAll('button'));
  const pressionados = () => botoes().map((b) => b.getAttribute('aria-pressed'));

  beforeEach(async () => {
    fixture = TestBed.createComponent(SegmentoComponent);
    fixture.componentRef.setInput('opcoes', [
      { valor: 'ult50', rotulo: 'Últimos 50' },
      { valor: 'ult100', rotulo: 'Últimos 100' },
      { valor: 'a2026', rotulo: '2026' },
    ]);
    fixture.componentRef.setInput('selecionado', 'ult50');
    await fixture.whenStable();
  });

  it('renderiza um botão por opção, só o selecionado com aria-pressed verdadeiro', () => {
    expect(botoes().map((b) => b.textContent?.trim())).toEqual(['Últimos 50', 'Últimos 100', '2026']);
    expect(botoes().every((b) => b.type === 'button')).toBe(true);
    expect(pressionados()).toEqual(['true', 'false', 'false']);
  });

  it('alterna a seleção ao clicar e atualiza o model', async () => {
    botoes()[2].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.selecionado()).toBe('a2026');
    expect(pressionados()).toEqual(['false', 'false', 'true']);

    botoes()[1].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.selecionado()).toBe('ult100');
    expect(pressionados()).toEqual(['false', 'true', 'false']);
  });

  it('reflete a seleção vinda de fora', async () => {
    fixture.componentRef.setInput('selecionado', 'ult100');
    await fixture.whenStable();

    expect(pressionados()).toEqual(['false', 'true', 'false']);
  });
});
