import { writeFileSync } from 'node:fs';
import type { Concurso, LoteriaDefinicao } from '@sorteios/core';
import type { ConcursoFixture } from './leitor-fixture';

/** Concurso do core no formato do fixture JSON (valores monetários em centavos inteiros). */
export function paraConcursoFixture(
  concurso: Concurso,
  def: LoteriaDefinicao,
): ConcursoFixture {
  return {
    numero: concurso.numero,
    data: concurso.data,
    dezenas: [...concurso.dezenas],
    acumulou: concurso.acumulou,
    premiacoes: concurso.premiacoes.map((p) => ({
      faixa: p.faixa,
      descricao:
        def.faixas.find((f) => f.faixa === p.faixa)?.nome ?? `Faixa ${p.faixa}`,
      ganhadores: p.ganhadores,
      rateioCentavos: Number(p.rateioCentavos),
    })),
    valorAcumuladoCentavos: Number(concurso.valorAcumuladoCentavos),
    estimativaProximoCentavos: Number(concurso.estimativaProximoCentavos),
    arrecadacaoCentavos: Number(concurso.arrecadacaoCentavos),
    acumuladoEspecialCentavos: Number(concurso.acumuladoEspecialCentavos),
    observacao: concurso.observacao ?? null,
    locaisGanhadores: concurso.locaisGanhadores.map((l) => ({
      cidade: l.cidade ?? null,
      uf: l.uf ?? null,
      descricao: l.descricao,
      quantidade: l.quantidade,
    })),
  };
}

/**
 * Grava o histórico no formato de `tools/fixtures/*.json` (o mesmo lido por `lerFixture`):
 * `{ loteria, geradoEm, concursos }`, concursos em ordem crescente.
 */
export function escreverFixture(
  caminho: string,
  def: LoteriaDefinicao,
  concursos: Concurso[],
): void {
  const saida = {
    loteria: def.id,
    geradoEm: new Date().toISOString(),
    concursos: [...concursos]
      .sort((a, b) => a.numero - b.numero)
      .map((c) => paraConcursoFixture(c, def)),
  };
  writeFileSync(caminho, JSON.stringify(saida) + '\n', 'utf-8');
}
