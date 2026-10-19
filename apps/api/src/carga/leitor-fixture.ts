import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Concurso } from '@sorteios/core';

const PASTA_FIXTURES = resolve(__dirname, '..', '..', '..', '..', 'tools', 'fixtures');

/** Fixture congelado de cada loteria (id da loteria → nome do arquivo em tools/fixtures). */
export const ARQUIVOS_FIXTURE: Record<string, string> = {
  megasena: 'megasena-3070.json',
  lotomania: 'lotomania-2987.json',
};

/** Caminho do fixture congelado da loteria; lança erro se ela não tem fixture. */
export function caminhoFixture(loteriaId: string): string {
  const arquivo = ARQUIVOS_FIXTURE[loteriaId];
  if (!arquivo)
    throw new Error(`Não há fixture para a loteria '${loteriaId}'`);
  return resolve(PASTA_FIXTURES, arquivo);
}

/** Caminho padrão do histórico congelado da Mega-Sena (3.070 concursos). */
export const CAMINHO_FIXTURE_PADRAO = caminhoFixture('megasena');

export interface ConcursoFixture {
  numero: number;
  data: string;
  dezenas: number[];
  acumulou: boolean;
  premiacoes: {
    faixa: number;
    descricao: string;
    ganhadores: number;
    rateioCentavos: number;
  }[];
  valorAcumuladoCentavos: number;
  estimativaProximoCentavos: number;
  arrecadacaoCentavos: number;
  acumuladoEspecialCentavos: number;
  observacao: string | null;
  locaisGanhadores: {
    cidade: string | null;
    uf: string | null;
    descricao: string;
    quantidade: number;
  }[];
}

/** Lê o JSON de fixture (valores monetários em centavos inteiros) e devolve `Concurso[]` do core, em ordem crescente. */
export function lerFixture(
  caminho: string = CAMINHO_FIXTURE_PADRAO,
): Concurso[] {
  const bruto = JSON.parse(readFileSync(caminho, 'utf-8')) as {
    concursos: ConcursoFixture[];
  };
  return bruto.concursos
    .map((c): Concurso => ({
      numero: c.numero,
      data: c.data,
      dezenas: [...c.dezenas].sort((a, b) => a - b),
      acumulou: c.acumulou,
      premiacoes: c.premiacoes.map((p) => ({
        faixa: p.faixa,
        ganhadores: p.ganhadores,
        rateioCentavos: BigInt(p.rateioCentavos),
      })),
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
    }))
    .sort((a, b) => a.numero - b.numero);
}
