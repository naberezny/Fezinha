import { TestBed } from '@angular/core/testing';
import { CHAVE_TEMA, TemaServico } from './tema.servico';

describe('TemaServico', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  function criar(): TemaServico {
    TestBed.resetTestingModule();
    return TestBed.inject(TemaServico);
  }

  it('começa em "sistema", sem data-theme, quando nada foi persistido', () => {
    // Arrange / Act
    const servico = criar();

    // Assert
    expect(servico.tema()).toBe('sistema');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('aplica data-theme="dark" e persiste ao escolher o tema escuro', () => {
    // Arrange
    const servico = criar();

    // Act
    servico.definir('escuro');

    // Assert
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('escuro');
    expect(servico.escuroEfetivo()).toBe(true);
  });

  it('aplica data-theme="light" ao escolher o tema claro', () => {
    // Arrange
    const servico = criar();

    // Act
    servico.definir('claro');

    // Assert
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(servico.escuroEfetivo()).toBe(false);
  });

  it('remove data-theme ao voltar para "sistema"', () => {
    // Arrange
    const servico = criar();
    servico.definir('escuro');

    // Act
    servico.definir('sistema');

    // Assert
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('sistema');
  });

  it('restaura o tema persistido na criação do serviço', () => {
    // Arrange
    localStorage.setItem(CHAVE_TEMA, 'escuro');

    // Act
    const servico = criar();

    // Assert
    expect(servico.tema()).toBe('escuro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ignora valor persistido inválido', () => {
    // Arrange
    localStorage.setItem(CHAVE_TEMA, 'roxo');

    // Act
    const servico = criar();

    // Assert
    expect(servico.tema()).toBe('sistema');
  });

  it('alterna entre claro e escuro a partir do tema efetivo', () => {
    // Arrange
    const servico = criar();
    servico.definir('claro');

    // Act
    servico.alternar();
    const depoisDoPrimeiro = servico.tema();
    servico.alternar();

    // Assert
    expect(depoisDoPrimeiro).toBe('escuro');
    expect(servico.tema()).toBe('claro');
  });

  it('funciona mesmo quando o localStorage lança erro', () => {
    // Arrange
    const leitura = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('bloqueado');
      });
    const escrita = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('bloqueado');
      });

    try {
      // Act
      const servico = criar();
      servico.definir('escuro');

      // Assert
      expect(servico.tema()).toBe('escuro');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    } finally {
      leitura.mockRestore();
      escrita.mockRestore();
    }
  });

  it('o ícone e o rótulo de alternar são a ação oposta ao tema atual (sol e "claro" no escuro; lua e "escuro" no claro)', () => {
    // Arrange
    const servico = criar();

    // Act
    servico.definir('claro');
    const noClaro = [servico.iconeAlternar(), servico.rotuloAlternar()];
    servico.definir('escuro');
    const noEscuro = [servico.iconeAlternar(), servico.rotuloAlternar()];

    // Assert
    expect(noClaro).toEqual(['moon-outline', 'Usar tema escuro']);
    expect(noEscuro).toEqual(['sunny-outline', 'Usar tema claro']);
  });
});
