import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Concurso, Historico } from '@sorteios/core';
import { MEGA_SENA } from '../lib/definicao';

interface ConcursoFixture {
  numero: number;
  data: string;
  dezenas: number[];
  acumulou: boolean;
  premiacoes: { faixa: number; descricao: string; ganhadores: number; rateioCentavos: number }[];
  valorAcumuladoCentavos: number;
  estimativaProximoCentavos: number;
  arrecadacaoCentavos: number;
  acumuladoEspecialCentavos: number;
  observacao: string | null;
  locaisGanhadores: { cidade: string | null; uf: string | null; descricao: string; quantidade: number }[];
}

let cache: Historico | undefined;

/** Caminho do fixture congelado (3.070 concursos), relativo à raiz do workspace. */
export const CAMINHO_FIXTURE = join(__dirname, '..', '..', '..', '..', '..', 'tools', 'fixtures', 'megasena-3070.json');

/** Carrega o histórico da Mega-Sena a partir do fixture (cacheado por processo de teste). */
export function carregarHistoricoFixture(): Historico {
  if (cache) return cache;
  const bruto = JSON.parse(readFileSync(CAMINHO_FIXTURE, 'utf-8')) as { concursos: ConcursoFixture[] };
  const concursos: Concurso[] = bruto.concursos.map((c) => ({
    numero: c.numero,
    data: c.data,
    dezenas: [...c.dezenas].sort((a, b) => a - b),
    acumulou: c.acumulou,
    premiacoes: c.premiacoes.map((p) => ({ faixa: p.faixa, ganhadores: p.ganhadores, rateioCentavos: BigInt(p.rateioCentavos) })),
    valorAcumuladoCentavos: BigInt(c.valorAcumuladoCentavos),
    estimativaProximoCentavos: BigInt(c.estimativaProximoCentavos),
    arrecadacaoCentavos: BigInt(c.arrecadacaoCentavos),
    acumuladoEspecialCentavos: BigInt(c.acumuladoEspecialCentavos),
    observacao: c.observacao ?? undefined,
    locaisGanhadores: c.locaisGanhadores.map((l) => ({
      cidade: l.cidade ?? undefined,
      uf: l.uf ?? undefined,
      descricao: l.descricao,
      quantidade: l.quantidade,
    })),
  }));
  cache = { loteria: MEGA_SENA, concursos };
  return cache;
}
