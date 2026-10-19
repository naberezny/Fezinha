import { Injectable } from '@nestjs/common';
import {
  obterLoteria,
  type Concurso,
  type LoteriaDefinicao,
} from '@sorteios/core';
import { PrismaService } from '../prisma/prisma.service';
import {
  agruparConcursos,
  assinaturaConcurso,
  INCLUIR_FILHOS,
  paraConcurso,
  paraEscalaresPrisma,
  paraFilhosPrisma,
} from './concurso.mapeador';

export type ResultadoUpsert = 'novo' | 'atualizado' | 'inalterado';

export interface OpcoesListagem {
  limite: number;
  /** Base 1. */
  pagina: number;
}

/** Acesso ao banco para concursos. Único ponto que conhece o Prisma nesta área. */
@Injectable()
export class ConcursosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  /** Cria a loteria no banco se ainda não existir (e mantém o nome atualizado). */
  async garantirLoteria(def: LoteriaDefinicao): Promise<void> {
    await this.prisma.loteria.upsert({
      where: { id: def.id },
      create: { id: def.id, nome: def.nome },
      update: { nome: def.nome },
    });
  }

  /**
   * Grava um concurso: `novo` (não existia), `atualizado` (conteúdo diferente; filhos regravados)
   * ou `inalterado` (mesma assinatura; nada é escrito). Tudo em uma transação.
   */
  async upsertConcurso(
    loteriaId: string,
    concurso: Concurso,
    origem: string,
  ): Promise<ResultadoUpsert> {
    const def = this.definicaoOuUndefined(loteriaId);
    const agora = new Date().toISOString();

    return this.prisma.$transaction(async (tx) => {
      const existente = await tx.concurso.findUnique({
        where: { loteriaId_numero: { loteriaId, numero: concurso.numero } },
        include: INCLUIR_FILHOS,
      });

      const filhos = paraFilhosPrisma(concurso, def);
      if (!existente) {
        await tx.concurso.create({
          data: {
            loteriaId,
            numero: concurso.numero,
            ...paraEscalaresPrisma(concurso, origem, agora),
            dezenas: { create: filhos.dezenas },
            premiacoes: { create: filhos.premiacoes },
            locais: { create: filhos.locais },
          },
        });
        return 'novo' as const;
      }

      if (
        assinaturaConcurso(paraConcurso(existente)) ===
        assinaturaConcurso(concurso)
      ) {
        return 'inalterado' as const;
      }

      await tx.dezena.deleteMany({ where: { concursoId: existente.id } });
      await tx.premiacao.deleteMany({ where: { concursoId: existente.id } });
      await tx.localGanhador.deleteMany({
        where: { concursoId: existente.id },
      });
      await tx.concurso.update({
        where: { id: existente.id },
        data: {
          ...paraEscalaresPrisma(concurso, origem, agora),
          dezenas: { create: filhos.dezenas },
          premiacoes: { create: filhos.premiacoes },
          locais: { create: filhos.locais },
        },
      });
      return 'atualizado' as const;
    });
  }

  /** Concursos em ordem decrescente de número, paginados (página base 1). */
  async listar(
    loteriaId: string,
    { limite, pagina }: OpcoesListagem,
  ): Promise<{ itens: Concurso[]; total: number }> {
    const [linhas, total] = await Promise.all([
      this.prisma.concurso.findMany({
        where: { loteriaId },
        orderBy: { numero: 'desc' },
        skip: Math.max(0, pagina - 1) * limite,
        take: limite,
        include: INCLUIR_FILHOS,
      }),
      this.prisma.concurso.count({ where: { loteriaId } }),
    ]);
    return { itens: linhas.map(paraConcurso), total };
  }

  async obter(loteriaId: string, numero: number): Promise<Concurso | null> {
    const linha = await this.prisma.concurso.findUnique({
      where: { loteriaId_numero: { loteriaId, numero } },
      include: INCLUIR_FILHOS,
    });
    return linha ? paraConcurso(linha) : null;
  }

  /**
   * Todos os concursos em ordem crescente de número.
   * Quatro consultas planas (sem `include`): o `include` com milhares de ids gera um `IN (...)` gigante
   * (no SQLite estourava o limite de parâmetros, P2029). Os filhos são agrupados em memória.
   */
  async historico(loteriaId: string): Promise<Concurso[]> {
    const filtro = { concurso: { loteriaId } };
    const [concursos, dezenas, premiacoes, locais] = await Promise.all([
      this.prisma.concurso.findMany({
        where: { loteriaId },
        orderBy: { numero: 'asc' },
      }),
      this.prisma.dezena.findMany({
        where: filtro,
        orderBy: [{ concursoId: 'asc' }, { ordem: 'asc' }],
      }),
      this.prisma.premiacao.findMany({
        where: filtro,
        orderBy: [{ concursoId: 'asc' }, { faixa: 'asc' }],
      }),
      this.prisma.localGanhador.findMany({
        where: filtro,
        orderBy: [{ concursoId: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return agruparConcursos(concursos, dezenas, premiacoes, locais);
  }

  async ultimoNumero(loteriaId: string): Promise<number | null> {
    const agregado = await this.prisma.concurso.aggregate({
      where: { loteriaId },
      _max: { numero: true },
    });
    return agregado._max.numero ?? null;
  }

  async total(loteriaId: string): Promise<number> {
    return this.prisma.concurso.count({ where: { loteriaId } });
  }

  private definicaoOuUndefined(
    loteriaId: string,
  ): LoteriaDefinicao | undefined {
    try {
      return obterLoteria(loteriaId);
    } catch {
      return undefined;
    }
  }
}
