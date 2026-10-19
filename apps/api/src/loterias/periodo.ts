import { BadRequestException } from '@nestjs/common';
import type { Periodo } from '@sorteios/core';

export const PERIODO_PADRAO = 'ultimos:50';

/**
 * Interpreta `ultimos:50`, `ano:2026` ou `tudo`. Qualquer outra forma é 400.
 * Devolve o período do core e a forma textual normalizada.
 */
export function interpretarPeriodo(texto: string | undefined): {
  periodo: Periodo;
  texto: string;
} {
  const bruto = (texto ?? PERIODO_PADRAO).trim().toLowerCase();
  if (bruto === 'tudo') {
    return { periodo: { tipo: 'tudo' }, texto: 'tudo' };
  }
  const partes = /^(ultimos|ano):(\d+)$/.exec(bruto);
  if (partes) {
    const valor = Number(partes[2]);
    if (partes[1] === 'ultimos' && valor >= 1 && valor <= 100_000) {
      return {
        periodo: { tipo: 'ultimos', quantidade: valor },
        texto: `ultimos:${valor}`,
      };
    }
    if (partes[1] === 'ano' && valor >= 1900 && valor <= 2200) {
      return { periodo: { tipo: 'ano', ano: valor }, texto: `ano:${valor}` };
    }
  }
  throw new BadRequestException(
    `Período inválido: '${texto}'. Use ultimos:N, ano:AAAA ou tudo.`,
  );
}
