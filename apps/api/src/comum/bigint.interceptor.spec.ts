import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { BigIntInterceptor, converterBigInt } from './bigint.interceptor';

describe('converterBigInt', () => {
  it('converte BigInt solto em number', () => {
    // Act / Assert
    expect(converterBigInt(123_456_789_012n)).toBe(123_456_789_012);
  });

  it('converte recursivamente em objetos e arrays aninhados', () => {
    // Arrange
    const entrada = {
      a: 1n,
      lista: [{ b: 2n }, 3n, 'texto'],
      interno: { c: { d: 4n } },
      nulo: null,
    };

    // Act
    const saida = converterBigInt(entrada);

    // Assert
    expect(saida).toEqual({
      a: 1,
      lista: [{ b: 2 }, 3, 'texto'],
      interno: { c: { d: 4 } },
      nulo: null,
    });
    expect(() => JSON.stringify(saida)).not.toThrow();
  });

  it('não mexe em Date nem em tipos primitivos', () => {
    // Arrange
    const data = new Date('2026-10-14T00:00:00Z');

    // Act / Assert
    expect(converterBigInt(data)).toBe(data);
    expect(converterBigInt('x')).toBe('x');
    expect(converterBigInt(undefined)).toBeUndefined();
    expect(converterBigInt(true)).toBe(true);
  });

  it('sem conversão, JSON.stringify de BigInt falha (motivo de existir o interceptor)', () => {
    // Act / Assert
    expect(() => JSON.stringify({ valor: 1n })).toThrow(TypeError);
  });
});

describe('BigIntInterceptor', () => {
  it('converte o corpo devolvido pelo handler', async () => {
    // Arrange
    const interceptor = new BigIntInterceptor();
    const manipulador: CallHandler = {
      handle: () => of({ premio: 5_000_000_00n }),
    };

    // Act
    const corpo = await lastValueFrom(
      interceptor.intercept({} as ExecutionContext, manipulador),
    );

    // Assert
    expect(corpo).toEqual({ premio: 500_000_000 });
  });
});
