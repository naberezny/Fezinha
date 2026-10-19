import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KpiComponent } from './kpi.component';

describe('KpiComponent', () => {
  let fixture: ComponentFixture<KpiComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(KpiComponent);
    fixture.componentRef.setInput('titulo', 'Concursos');
    fixture.componentRef.setInput('valor', '2.950');
    fixture.componentRef.setInput('detalhe', 'último em 14/10/2026');
    await fixture.whenStable();
  });

  it('renderiza título, valor e detalhe', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.eyebrow')?.textContent).toBe('Concursos');
    expect(host.querySelector('.v')?.textContent).toBe('2.950');
    expect(host.querySelector('.s')?.textContent).toBe('último em 14/10/2026');
  });

  it('usa o estilo de painel e fonte numérica', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.classList).toContain('panel');
    expect(host.querySelector('.v')?.classList).toContain('num');
  });
});
