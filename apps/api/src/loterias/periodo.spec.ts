import { BadRequestException } from '@nestjs/common';
import { interpretarPeriodo } from './periodo';

describe('interpretarPeriodo', () => {
  it('usa ultimos:50 quando não informado', () => {
    // Act / Assert
    expect(interpretarPeriodo(undefined)).toEqual({
      periodo: { tipo: 'ultimos', quantidade: 50 },
      texto: 'ultimos:50',
    });
  });

  it.each([
    ['ultimos:100', { tipo: 'ultimos', quantidade: 100 }],
    ['ano:2026', { tipo: 'ano', ano: 2026 }],
    ['tudo', { tipo: 'tudo' }],
    ['  ULTIMOS:7 ', { tipo: 'ultimos', quantidade: 7 }],
  ])('interpreta %s', (texto, esperado) => {
    // Act / Assert
    expect(interpretarPeriodo(texto).periodo).toEqual(esperado);
  });

  it.each([
    '',
    'ultimos',
    'ultimos:0',
    'ultimos:-1',
    'ultimos:1.5',
    'ano:99',
    'ano:3000',
    'tudo:2',
    'foo',
  ])('lança 400 para %p', (texto) => {
    // Act / Assert
    expect(() => interpretarPeriodo(texto)).toThrow(BadRequestException);
  });
});
