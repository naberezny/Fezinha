import type {
  Concurso,
  LocalGanhador,
  LoteriaDefinicao,
  Premiacao,
} from '@sorteios/core';
import type { Prisma } from '../prisma/gerado/client';
import type {
  Concurso as LinhaConcurso,
  Dezena as LinhaDezena,
  LocalGanhador as LinhaLocal,
  Premiacao as LinhaPremiacao,
} from '../prisma/gerado/client';

/** Concurso com os filhos carregados, como devolvido pelo Prisma. */
export type ConcursoComFilhos = Prisma.ConcursoGetPayload<{
  include: { dezenas: true; premiacoes: true; locais: true };
}>;

/** Cláusula `include` que traz os filhos na ordem canônica. */
export const INCLUIR_FILHOS = {
  dezenas: { orderBy: { ordem: 'asc' } },
  premiacoes: { orderBy: { faixa: 'asc' } },
  locais: { orderBy: { id: 'asc' } },
} as const;

/** Linha Prisma para `Concurso` do core. */
export function paraConcurso(linha: ConcursoComFilhos): Concurso {
  return {
    numero: linha.numero,
    data: linha.dataSorteio,
    dezenas: [...linha.dezenas]
      .sort((a, b) => a.ordem - b.ordem)
      .map((d) => d.dezena),
    acumulou: linha.acumulou,
    premiacoes: [...linha.premiacoes]
      .sort((a, b) => a.faixa - b.faixa)
      .map((p): Premiacao => ({
        faixa: p.faixa,
        ganhadores: p.ganhadores,
        rateioCentavos: p.rateioCentavos,
      })),
    valorAcumuladoCentavos: linha.valorAcumuladoCentavos,
    estimativaProximoCentavos: linha.estimativaProximoCentavos,
    arrecadacaoCentavos: linha.arrecadacaoCentavos,
    acumuladoEspecialCentavos: linha.acumuladoEspecialCentavos,
    proximoNumero: linha.proximoNumero ?? undefined,
    dataProximoSorteio: linha.dataProximoSorteio ?? undefined,
    observacao: linha.observacao ?? undefined,
    locaisGanhadores: [...linha.locais]
      .sort((a, b) => a.id - b.id)
      .map((l): LocalGanhador => ({
        cidade: l.cidade ?? undefined,
        uf: l.uf ?? undefined,
        descricao: l.descricao,
        quantidade: l.quantidade,
      })),
  };
}

/** Descrição da faixa conforme a definição da loteria (ex.: "Sena"); cai em "Faixa N" quando desconhecida. */
function nomeDaFaixa(def: LoteriaDefinicao | undefined, faixa: number): string {
  return def?.faixas.find((f) => f.faixa === faixa)?.nome ?? `Faixa ${faixa}`;
}

/** Concurso do core para os dados de criação dos filhos (create/update aninhado do Prisma). */
export function paraFilhosPrisma(
  concurso: Concurso,
  def: LoteriaDefinicao | undefined,
) {
  return {
    dezenas: concurso.dezenas.map((dezena, i) => ({ ordem: i + 1, dezena })),
    premiacoes: concurso.premiacoes.map((p) => ({
      faixa: p.faixa,
      descricao: nomeDaFaixa(def, p.faixa),
      ganhadores: p.ganhadores,
      rateioCentavos: p.rateioCentavos,
    })),
    locais: concurso.locaisGanhadores.map((l) => ({
      cidade: l.cidade ?? null,
      uf: l.uf ?? null,
      descricao: l.descricao,
      quantidade: l.quantidade,
    })),
  };
}

/** Campos escalares do concurso (sem filhos), prontos para o Prisma. */
export function paraEscalaresPrisma(
  concurso: Concurso,
  origem: string,
  atualizadoEm: string,
) {
  return {
    dataSorteio: concurso.data,
    acumulou: concurso.acumulou,
    valorAcumuladoCentavos: concurso.valorAcumuladoCentavos,
    estimativaProximoCentavos: concurso.estimativaProximoCentavos,
    arrecadacaoCentavos: concurso.arrecadacaoCentavos,
    acumuladoEspecialCentavos: concurso.acumuladoEspecialCentavos,
    proximoNumero: concurso.proximoNumero ?? null,
    dataProximoSorteio: concurso.dataProximoSorteio ?? null,
    observacao: concurso.observacao ?? null,
    origem,
    atualizadoEm,
  };
}

/**
 * Assinatura canônica do conteúdo de um concurso (campos, dezenas, premiações e locais).
 * Dois concursos com a mesma assinatura são considerados iguais no upsert ("inalterado").
 */
export function assinaturaConcurso(c: Concurso): string {
  return JSON.stringify([
    c.numero,
    c.data,
    c.dezenas,
    c.acumulou,
    [...c.premiacoes]
      .sort((a, b) => a.faixa - b.faixa)
      .map((p) => [p.faixa, p.ganhadores, p.rateioCentavos.toString()]),
    c.valorAcumuladoCentavos.toString(),
    c.estimativaProximoCentavos.toString(),
    c.arrecadacaoCentavos.toString(),
    c.acumuladoEspecialCentavos.toString(),
    c.proximoNumero ?? null,
    c.dataProximoSorteio ?? null,
    c.observacao ?? null,
    c.locaisGanhadores.map((l) => [
      l.cidade ?? null,
      l.uf ?? null,
      l.descricao,
      l.quantidade,
    ]),
  ]);
}

function agruparPorConcurso<T extends { concursoId: number }>(
  linhas: T[],
): Map<number, T[]> {
  const grupos = new Map<number, T[]>();
  for (const linha of linhas) {
    const grupo = grupos.get(linha.concursoId);
    if (grupo) grupo.push(linha);
    else grupos.set(linha.concursoId, [linha]);
  }
  return grupos;
}

/** Monta `Concurso[]` a partir de linhas planas (concursos e filhos lidos em consultas separadas). */
export function agruparConcursos(
  concursos: LinhaConcurso[],
  dezenas: LinhaDezena[],
  premiacoes: LinhaPremiacao[],
  locais: LinhaLocal[],
): Concurso[] {
  const dezenasPorConcurso = agruparPorConcurso(dezenas);
  const premiacoesPorConcurso = agruparPorConcurso(premiacoes);
  const locaisPorConcurso = agruparPorConcurso(locais);
  return concursos.map((linha) =>
    paraConcurso({
      ...linha,
      dezenas: dezenasPorConcurso.get(linha.id) ?? [],
      premiacoes: premiacoesPorConcurso.get(linha.id) ?? [],
      locais: locaisPorConcurso.get(linha.id) ?? [],
    }),
  );
}
