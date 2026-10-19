import { atrasoEsperado, formatarAtraso } from './tipos';
import { LOTERIA_TESTE, LOTERIA_TESTE_100, LOTERIA_TESTE_25 } from '../testes/loteria-teste';

describe('formatarAtraso', () => {
  it('inteiros saem sem casa decimal', () => {
    expect(formatarAtraso(10)).toBe('10');
    expect(formatarAtraso(0)).toBe('0');
  });

  it('frações saem com 1 casa e vírgula decimal', () => {
    expect(formatarAtraso(1.6666666666666667)).toBe('1,7');
    expect(formatarAtraso(4.25)).toBe('4,3');
  });

  it('formata o atraso esperado das loterias de teste (60/6, 100/20, 25/15)', () => {
    expect(formatarAtraso(atrasoEsperado(LOTERIA_TESTE))).toBe('10');
    expect(formatarAtraso(atrasoEsperado(LOTERIA_TESTE_100))).toBe('5');
    expect(formatarAtraso(atrasoEsperado(LOTERIA_TESTE_25))).toBe('1,7');
  });
});
