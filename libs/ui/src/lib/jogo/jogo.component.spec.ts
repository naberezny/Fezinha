import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Jogo } from '@sorteios/core';
import { JogoComponent } from './jogo.component';

describe('JogoComponent', () => {
  let fixture: ComponentFixture<JogoComponent>;
  const host = () => fixture.nativeElement as HTMLElement;

  const jogo: Jogo = { dezenas: [5, 12, 23, 34, 41, 58], atrasoMedio: 21.2, pares: 4, quadrantes: 4 };
  const atrasos: Record<number, number> = { 5: 3, 12: 10, 23: 0, 34: 43, 41: 30, 58: 41 };

  beforeEach(async () => {
    fixture = TestBed.createComponent(JogoComponent);
    fixture.componentRef.setInput('indice', 3);
    fixture.componentRef.setInput('jogo', jogo);
    fixture.componentRef.setInput('atrasos', atrasos);
    fixture.componentRef.setInput('fixas', [23]);
    await fixture.whenStable();
  });

  it('mostra o índice com dois dígitos e uma bola por dezena com o atraso', () => {
    const bolas = Array.from(host().querySelectorAll('srt-bola'));

    expect(host().querySelector('.idx')?.textContent).toBe('03');
    expect(bolas.map((b) => b.firstChild?.textContent)).toEqual(['05', '12', '23', '34', '41', '58']);
    expect(bolas[3].querySelector('.at')?.textContent).toBe('43');
    expect(bolas[3].getAttribute('title')).toBe('a dezena 34 não sai há 43 concursos');
  });

  it('destaca apenas as dezenas fixas', () => {
    const fixas = Array.from(host().querySelectorAll('srt-bola.fixa'));

    expect(fixas).toHaveLength(1);
    expect(fixas[0].textContent).toContain('23');
  });

  it('mostra o atraso médio com vírgula decimal e a explicação no title', () => {
    const meta = host().querySelector('.meta') as HTMLElement;
    const linhaAtraso = meta.querySelector('span') as HTMLElement;

    expect(linhaAtraso.textContent?.replace(/\s+/g, ' ').trim()).toBe('sem sair há 21,2 concursos, em média');
    expect(linhaAtraso.getAttribute('title')).toContain('o esperado por dezena é 10');
  });

  it('mostra pares, ímpares e quadrantes', () => {
    const resumo = host().querySelectorAll('.meta span')[1].textContent?.replace(/\s+/g, ' ').trim();

    expect(resumo).toBe('4 pares · 2 ímpares · 4 quadrantes');
  });

  it('sem quadrantes no jogo (Lotofácil), o resumo mostra só pares e ímpares', async () => {
    fixture.componentRef.setInput('mostrarQuadrantes', false);
    await fixture.whenStable();

    const resumo = host().querySelectorAll('.meta span')[1].textContent?.replace(/\s+/g, ' ').trim();

    expect(resumo).toBe('4 pares · 2 ímpares');
  });
});
