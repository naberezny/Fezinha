import { listarLoterias, registrarLoteria } from '@sorteios/core';
import { LOTOMANIA } from './definicao';

/** Registra a Lotomania no registro central (idempotente). */
export function registrarLotomania(): void {
  if (!listarLoterias().some((l) => l.id === LOTOMANIA.id)) {
    registrarLoteria(LOTOMANIA);
  }
}
