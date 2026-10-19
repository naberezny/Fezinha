import { listarLoterias, registrarLoteria } from '@sorteios/core';
import { LOTOFACIL } from './definicao';

/** Registra a Lotofácil no registro central (idempotente). */
export function registrarLotofacil(): void {
  if (!listarLoterias().some((l) => l.id === LOTOFACIL.id)) {
    registrarLoteria(LOTOFACIL);
  }
}
