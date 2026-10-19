import { criarRng, rngPadrao } from './rng';

describe('criarRng', () => {
  it('reproduz a mesma sequência para a mesma semente', () => {
    // Arrange
    const a = criarRng(42);
    const b = criarRng(42);

    // Act
    const sequenciaA = Array.from({ length: 50 }, () => a());
    const sequenciaB = Array.from({ length: 50 }, () => b());

    // Assert
    expect(sequenciaA).toEqual(sequenciaB);
  });

  it('gera sequências diferentes para sementes diferentes', () => {
    // Arrange
    const a = criarRng(1);
    const b = criarRng(2);

    // Act
    const sequenciaA = Array.from({ length: 10 }, () => a());
    const sequenciaB = Array.from({ length: 10 }, () => b());

    // Assert
    expect(sequenciaA).not.toEqual(sequenciaB);
  });

  it('gera valores sempre no intervalo [0, 1)', () => {
    // Arrange
    const rng = criarRng(123456789);

    // Act
    const valores = Array.from({ length: 5000 }, () => rng());

    // Assert
    expect(valores.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('distribui os valores de forma aproximadamente uniforme', () => {
    // Arrange
    const rng = criarRng(7);

    // Act
    const media = Array.from({ length: 20000 }, () => rng()).reduce((s, v) => s + v, 0) / 20000;

    // Assert
    expect(media).toBeGreaterThan(0.48);
    expect(media).toBeLessThan(0.52);
  });

  it('trata sementes negativas e fracionárias sem lançar erro', () => {
    // Arrange / Act
    const valor = criarRng(-5.7)();

    // Assert
    expect(valor).toBeGreaterThanOrEqual(0);
    expect(valor).toBeLessThan(1);
  });
});

describe('rngPadrao', () => {
  it('gera valores no intervalo [0, 1) usando crypto quando disponível', () => {
    // Arrange
    const rng = rngPadrao();

    // Act
    const valores = Array.from({ length: 1000 }, () => rng());

    // Assert
    expect(valores.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Set(valores).size).toBeGreaterThan(900);
  });

  it('recorre a Math.random quando crypto não existe', () => {
    // Arrange
    const descritor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    const espiao = jest.spyOn(Math, 'random').mockReturnValue(0.25);

    try {
      // Act
      const valor = rngPadrao()();

      // Assert
      expect(valor).toBe(0.25);
      expect(espiao).toHaveBeenCalled();
    } finally {
      espiao.mockRestore();
      if (descritor) Object.defineProperty(globalThis, 'crypto', descritor);
      else delete (globalThis as { crypto?: unknown }).crypto;
    }
  });
});
