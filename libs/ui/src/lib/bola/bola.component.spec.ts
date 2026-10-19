import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BolaComponent } from './bola.component';

describe('BolaComponent', () => {
  let fixture: ComponentFixture<BolaComponent>;
  const host = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(BolaComponent);
  });

  it('mostra a dezena com dois dígitos e o badge de atraso', async () => {
    fixture.componentRef.setInput('dezena', 7);
    fixture.componentRef.setInput('atraso', 43);
    await fixture.whenStable();

    expect(host().textContent).toContain('07');
    expect(host().querySelector('.at')?.textContent).toBe('43');
  });

  it('mostra a dezena 0 como "00" (Lotomania)', async () => {
    fixture.componentRef.setInput('dezena', 0);
    fixture.componentRef.setInput('atraso', 3);
    await fixture.whenStable();

    expect(host().textContent).toContain('00');
    expect(host().getAttribute('title')).toBe('a dezena 00 não sai há 3 concursos');
  });

  it('descreve o atraso no title', async () => {
    fixture.componentRef.setInput('dezena', 34);
    fixture.componentRef.setInput('atraso', 43);
    await fixture.whenStable();

    expect(host().getAttribute('title')).toBe('a dezena 34 não sai há 43 concursos');
  });

  it('não renderiza badge nem title sem atraso, e mostra o badge quando o atraso é 0', async () => {
    fixture.componentRef.setInput('dezena', 5);
    await fixture.whenStable();
    expect(host().querySelector('.at')).toBeNull();
    expect(host().hasAttribute('title')).toBe(false);

    fixture.componentRef.setInput('atraso', 0);
    await fixture.whenStable();
    expect(host().querySelector('.at')?.textContent).toBe('0');
  });

  it('aplica as classes de pequena e fixa', async () => {
    fixture.componentRef.setInput('dezena', 12);
    fixture.componentRef.setInput('pequena', true);
    fixture.componentRef.setInput('fixa', true);
    await fixture.whenStable();

    expect(host().classList).toContain('pequena');
    expect(host().classList).toContain('fixa');
  });
});
