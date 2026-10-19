import type { LoteriaDefinicao } from '@sorteios/core';
import { MEGA_SENA, registrarMegaSena } from '@sorteios/loterias/mega-sena';
import {
  LOTOMANIA,
  registrarLotomania,
} from '@sorteios/loterias/lotomania/definicao';
import {
  LOTOFACIL,
  registrarLotofacil,
} from '@sorteios/loterias/lotofacil/definicao';

/** Loteria que a API sabe servir: definição + registro no registro central do core. */
export interface LoteriaSuportada {
  def: LoteriaDefinicao;
  registrar(): void;
}

/** Fonte única das loterias suportadas (a API, a carga histórica e os testes partem daqui). */
export const LOTERIAS_SUPORTADAS: readonly LoteriaSuportada[] = [
  { def: MEGA_SENA, registrar: registrarMegaSena },
  { def: LOTOMANIA, registrar: registrarLotomania },
  { def: LOTOFACIL, registrar: registrarLotofacil },
];

/** Registra todas as loterias suportadas (idempotente). */
export function registrarLoteriasSuportadas(): void {
  for (const { registrar } of LOTERIAS_SUPORTADAS) registrar();
}

/** Loteria suportada pelo id, ou `undefined`. */
export function loteriaSuportada(id: string): LoteriaSuportada | undefined {
  return LOTERIAS_SUPORTADAS.find((l) => l.def.id === id);
}
