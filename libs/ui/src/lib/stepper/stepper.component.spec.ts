import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepperComponent } from './stepper.component';

describe('StepperComponent', () => {
  let fixture: ComponentFixture<StepperComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const campo = () => host().querySelector('input') as HTMLInputElement;
  const botao = (rotulo: 'menos' | 'mais') => host().querySelector(`button[aria-label="${rotulo}"]`) as HTMLButtonElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(StepperComponent);
    fixture.componentRef.setInput('min', 6);
    fixture.componentRef.setInput('max', 8);
    fixture.componentRef.setInput('valor', 7);
    fixture.componentRef.setInput('rotulo', 'Dezenas por jogo');
    fixture.componentRef.setInput('id', 'dez');
    await fixture.whenStable();
  });

  it('incrementa e decrementa com os botões', async () => {
    botao('mais').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.valor()).toBe(8);
    expect(campo().value).toBe('8');

    botao('menos').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.valor()).toBe(7);
  });

  it('não passa do máximo nem do mínimo', async () => {
    botao('mais').click();
    botao('mais').click();
    botao('mais').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.valor()).toBe(8);

    for (let i = 0; i < 5; i++) botao('menos').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.valor()).toBe(6);
  });

  it('desabilitado (valor fixo) mostra o valor e bloqueia campo e botões', async () => {
    // Arrange
    fixture.componentRef.setInput('min', 50);
    fixture.componentRef.setInput('max', 50);
    fixture.componentRef.setInput('valor', 50);
    fixture.componentRef.setInput('desabilitado', true);
    await fixture.whenStable();

    // Act
    botao('mais').click();
    botao('menos').click();
    await fixture.whenStable();

    // Assert
    expect(campo().value).toBe('50');
    expect(campo().disabled).toBe(true);
    expect(botao('mais').disabled).toBe(true);
    expect(botao('menos').disabled).toBe(true);
    expect(host().classList).toContain('desabilitado');
    expect(fixture.componentInstance.valor()).toBe(50);
  });

  it('habilitado por padrão', () => {
    expect(campo().disabled).toBe(false);
    expect(botao('mais').disabled).toBe(false);
    expect(host().classList).not.toContain('desabilitado');
  });

  it('limita o valor digitado e ignora texto inválido', async () => {
    campo().value = '99';
    campo().dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.valor()).toBe(8);
    expect(campo().value).toBe('8');

    campo().value = '';
    campo().dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.valor()).toBe(8);
    expect(campo().value).toBe('8');
  });

  it('aplica id e rótulo acessível ao input interno, sem duplicar o id no host', () => {
    expect(campo().id).toBe('dez');
    expect(campo().getAttribute('aria-label')).toBe('Dezenas por jogo');
    expect(campo().classList).toContain('num');
    expect(host().hasAttribute('id')).toBe(false);
  });
});
