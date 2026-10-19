import { listarLoterias, registrarLoteria } from '@sorteios/core';
import { MEGA_SENA } from './definicao';

/** Registra a Mega-Sena no registro central (idempotente). */
export function registrarMegaSena(): void {
  if (!listarLoterias().some((l) => l.id === MEGA_SENA.id)) {
    registrarLoteria(MEGA_SENA);
  }
}
