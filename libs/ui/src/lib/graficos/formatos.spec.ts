import { formatarDataBR, formatarReais } from './formatos';

describe('formatarReais', () => {
  it('abrevia valores a partir de 1 milhão com uma casa decimal e "mi"', () => {
    expect(formatarReais(BigInt(15269598822))).toBe('R$ 152,7 mi');
  });

  it('mostra valores abaixo de 1 milhão em reais inteiros com separador de milhar', () => {
    expect(formatarReais(BigInt(123400))).toBe('R$ 1.234');
  });

  it('mostra zero', () => {
    expect(formatarReais(BigInt(0))).toBe('R$ 0');
  });
});

describe('formatarDataBR', () => {
  it('converte ISO em dd/mm/aaaa', () => {
    expect(formatarDataBR('2026-10-14')).toBe('14/10/2026');
  });
});
