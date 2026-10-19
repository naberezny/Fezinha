import { clarear, corValida, luminancia, tintaSobre } from './cor-loteria';

describe('cor-loteria', () => {
  describe('luminancia', () => {
    it('é 0 para preto e 1 para branco', () => {
      // Arrange / Act / Assert
      expect(luminancia('#000000')).toBe(0);
      expect(luminancia('#ffffff')).toBeCloseTo(1, 5);
    });

    it('aceita a forma curta #rgb', () => {
      // Arrange / Act / Assert
      expect(luminancia('#fff')).toBeCloseTo(luminancia('#ffffff'), 10);
      expect(luminancia('#0f8')).toBeCloseTo(luminancia('#00ff88'), 10);
    });

    it('não diferencia maiúsculas de minúsculas', () => {
      // Arrange / Act / Assert
      expect(luminancia('#F78100')).toBe(luminancia('#f78100'));
    });

    it('lança RangeError para cor inválida', () => {
      // Arrange / Act / Assert
      expect(() => luminancia('verde')).toThrow(RangeError);
      expect(() => luminancia('#12345')).toThrow(RangeError);
    });

    it('o laranja da Lotomania é mais luminoso que o verde da Mega-Sena', () => {
      // Arrange / Act / Assert
      expect(luminancia('#f78100')).toBeGreaterThan(luminancia('#209869'));
    });
  });

  describe('tintaSobre', () => {
    it('Mega-Sena (verde) leva texto claro', () => {
      // Arrange / Act / Assert
      expect(tintaSobre('#209869')).toBe('clara');
    });

    it('Lotomania (laranja) leva texto escuro', () => {
      // Arrange / Act / Assert
      expect(tintaSobre('#f78100')).toBe('escura');
    });

    it.each([
      ['#000000', 'clara'],
      ['#260085', 'clara'],
      ['#ffffff', 'escura'],
      ['#fab219', 'escura'],
    ] as const)('%s leva texto %s', (cor, esperada) => {
      // Arrange / Act / Assert
      expect(tintaSobre(cor)).toBe(esperada);
    });
  });

  describe('clarear', () => {
    it('mistura 70% da cor com 30% de branco, como o color-mix dos tokens', () => {
      // Arrange / Act / Assert
      expect(clarear('#000000')).toBe('#4d4d4d');
      expect(clarear('#ffffff')).toBe('#ffffff');
      expect(clarear('#209869')).toBe('#63b796');
    });

    it('com proporção 1 devolve a própria cor', () => {
      // Arrange / Act / Assert
      expect(clarear('#f78100', 1)).toBe('#f78100');
    });

    it('a cor clareada nunca é mais escura que a original', () => {
      // Arrange / Act / Assert
      expect(luminancia(clarear('#260085'))).toBeGreaterThan(luminancia('#260085'));
    });

    it('lança RangeError para cor inválida', () => {
      // Arrange / Act / Assert
      expect(() => clarear('azul')).toThrow(RangeError);
    });
  });

  describe('corValida', () => {
    it.each([
      ['#209869', true],
      ['#FFF', true],
      ['209869', false],
      ['#2098', false],
      ['rgb(0,0,0)', false],
      ['', false],
    ])('%j → %s', (cor, esperado) => {
      // Arrange / Act / Assert
      expect(corValida(cor)).toBe(esperado);
    });
  });
});
