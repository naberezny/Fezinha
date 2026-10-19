import type { Concurso, LoteriaDefinicao } from '@sorteios/core';
import type {
  ConcursosRepositorio,
  ResultadoUpsert,
} from '../loterias/concursos.repositorio';

export interface ResumoCarga {
  novos: number;
  atualizados: number;
  inalterados: number;
  ultimoConcurso: number | null;
}

/**
 * Garante a loteria e faz upsert de cada concurso (idempotente: rodar de novo devolve tudo "inalterado").
 * Separada do `main.ts` para ser testada sem ler arquivo nem abrir o banco padrão.
 */
export async function carregarConcursos(
  repositorio: Pick<ConcursosRepositorio, 'garantirLoteria' | 'upsertConcurso'>,
  def: LoteriaDefinicao,
  concursos: Concurso[],
  origem: string,
  aoProgredir?: (feitos: number, total: number) => void,
): Promise<ResumoCarga> {
  await repositorio.garantirLoteria(def);
  const contagem: Record<ResultadoUpsert, number> = {
    novo: 0,
    atualizado: 0,
    inalterado: 0,
  };
  let feitos = 0;
  for (const concurso of concursos) {
    contagem[await repositorio.upsertConcurso(def.id, concurso, origem)] += 1;
    feitos += 1;
    if (aoProgredir && feitos % 500 === 0)
      aoProgredir(feitos, concursos.length);
  }
  return {
    novos: contagem.novo,
    atualizados: contagem.atualizado,
    inalterados: contagem.inalterado,
    ultimoConcurso: concursos.length
      ? Math.max(...concursos.map((c) => c.numero))
      : null,
  };
}
