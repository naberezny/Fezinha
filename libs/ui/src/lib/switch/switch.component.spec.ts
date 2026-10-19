import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwitchComponent } from './switch.component';

describe('SwitchComponent', () => {
  let fixture: ComponentFixture<SwitchComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const campo = () => host().querySelector('input') as HTMLInputElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(SwitchComponent);
    fixture.componentRef.setInput('rotulo', 'Nunca repetir um resultado já sorteado');
    fixture.componentRef.setInput('id', 'fHist');
    await fixture.whenStable();
  });

  it('alterna o estado ao clicar', async () => {
    expect(fixture.componentInstance.ligado()).toBe(false);

    campo().click();
    await fixture.whenStable();
    expect(fixture.componentInstance.ligado()).toBe(true);
    expect(campo().checked).toBe(true);

    campo().click();
    await fixture.whenStable();
    expect(fixture.componentInstance.ligado()).toBe(false);
  });

  it('não alterna quando está desabilitado', async () => {
    fixture.componentRef.setInput('desabilitado', true);
    await fixture.whenStable();

    campo().click();
    await fixture.whenStable();

    expect(campo().disabled).toBe(true);
    expect(fixture.componentInstance.ligado()).toBe(false);
  });

  it('mostra rótulo e ajuda, e aplica o id ao checkbox sem duplicar no host', async () => {
    fixture.componentRef.setInput('ajuda', '(Q1 a Q4)');
    await fixture.whenStable();

    expect(host().textContent).toContain('Nunca repetir um resultado já sorteado');
    expect(host().querySelector('.hint')?.textContent).toBe('(Q1 a Q4)');
    expect(campo().id).toBe('fHist');
    expect(host().hasAttribute('id')).toBe(false);
  });

  it('reflete o valor vindo de fora', async () => {
    fixture.componentRef.setInput('ligado', true);
    await fixture.whenStable();

    expect(campo().checked).toBe(true);
  });
});
