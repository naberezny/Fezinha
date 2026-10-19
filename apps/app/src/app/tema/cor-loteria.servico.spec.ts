import { TestBed } from '@angular/core/testing';
import { CorLoteriaServico } from './cor-loteria.servico';

describe('CorLoteriaServico', () => {
  let raiz: HTMLElement;
  let servico: CorLoteriaServico;

  beforeEach(() => {
    raiz = document.documentElement;
    raiz.style.removeProperty('--cor-loteria');
    raiz.removeAttribute('data-tinta');
    raiz.removeAttribute('data-tinta-escuro');
    servico = TestBed.inject(CorLoteriaServico);
  });

  it('grava --cor-loteria e as tintas no <html> (verde: texto claro no claro e escuro no escuro)', () => {
    // Arrange / Act
    servico.definir('#209869');

    // Assert
    expect(raiz.style.getPropertyValue('--cor-loteria')).toBe('#209869');
    expect(raiz.getAttribute('data-tinta')).toBe('clara');
    expect(raiz.getAttribute('data-tinta-escuro')).toBe('escura');
  });

  it('laranja leva texto escuro nos dois temas', () => {
    // Arrange / Act
    servico.definir('#f78100');

    // Assert
    expect(raiz.getAttribute('data-tinta')).toBe('escura');
    expect(raiz.getAttribute('data-tinta-escuro')).toBe('escura');
  });

  it('cor muito escura leva texto claro nos dois temas, mesmo clareada', () => {
    // Arrange / Act
    servico.definir('#000000');

    // Assert
    expect(raiz.getAttribute('data-tinta')).toBe('clara');
    expect(raiz.getAttribute('data-tinta-escuro')).toBe('clara');
  });

  it('trocar de jogo substitui a cor anterior', () => {
    // Arrange
    servico.definir('#209869');

    // Act
    servico.definir('#f78100');

    // Assert
    expect(raiz.style.getPropertyValue('--cor-loteria')).toBe('#f78100');
    expect(raiz.getAttribute('data-tinta')).toBe('escura');
  });

  it.each([undefined, '', 'verde', '#12345'])('sem cor válida (%j) volta ao neutro dos tokens', (cor) => {
    // Arrange
    servico.definir('#209869');

    // Act
    servico.definir(cor);

    // Assert
    expect(raiz.style.getPropertyValue('--cor-loteria')).toBe('');
    expect(raiz.hasAttribute('data-tinta')).toBe(false);
    expect(raiz.hasAttribute('data-tinta-escuro')).toBe(false);
  });

  it('limpar remove cor e tintas', () => {
    // Arrange
    servico.definir('#f78100');

    // Act
    servico.limpar();

    // Assert
    expect(raiz.style.getPropertyValue('--cor-loteria')).toBe('');
    expect(raiz.hasAttribute('data-tinta')).toBe(false);
  });
});
