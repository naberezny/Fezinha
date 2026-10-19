import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Concurso, LoteriaDefinicao } from '@sorteios/core';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena';
import { AppModule } from '../app/app.module';
import { ConcursosRepositorio } from '../loterias/concursos.repositorio';
import { PrismaService, URL_BANCO } from '../prisma/prisma.service';
import { configurarSwagger } from '../swagger';
import { caminhoFixture, lerFixture } from '../carga/leitor-fixture';
import { carregarConcursos } from '../carga/carga';

export interface OpcoesAppDeTeste {
  /**
   * Marca as loterias como recém-sincronizadas, para que as leituras não consultem a Caixa (padrão: `true`).
   * Passe `false` nos testes da própria sincronização.
   */
  marcarSincronizada?: boolean;
  /** Providers substituídos (ex.: `{ provide: CONFIG_SINCRONIZACAO, useValue: ... }`). */
  substituir?: Array<{ provide: unknown; useValue: unknown }>;
}

/** Sobe a aplicação inteira em memória (sem porta) apontando para o banco informado. */
export async function criarAppDeTeste(
  urlBanco: string,
  { marcarSincronizada = true, substituir = [] }: OpcoesAppDeTeste = {},
): Promise<INestApplication> {
  let construtor = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(URL_BANCO)
    .useValue(urlBanco);
  for (const { provide, useValue } of substituir) {
    construtor = construtor.overrideProvider(provide).useValue(useValue);
  }
  const modulo = await construtor.compile();
  const app = modulo.createNestApplication();
  configurarSwagger(app);
  await app.init();
  if (marcarSincronizada) await marcarComoSincronizada(app);
  return app;
}

/** Grava `ultimaEm = agora` para as loterias registradas: a sincronização lazy não vence nas próximas 24 h. */
async function marcarComoSincronizada(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const ultimaEm = new Date().toISOString();
  for (const loteria of await prisma.loteria.findMany()) {
    await prisma.sincronizacao.upsert({
      where: { loteriaId: loteria.id },
      create: { loteriaId: loteria.id, ultimaEm },
      update: { ultimaEm },
    });
  }
}

/** Concursos do fixture congelado da loteria; `ultimos` limita aos N mais recentes (padrão: todos). */
export function concursosDoFixture(
  ultimos?: number,
  def: LoteriaDefinicao = MEGA_SENA,
): Concurso[] {
  const todos = lerFixture(caminhoFixture(def.id));
  return ultimos ? todos.slice(-ultimos) : todos;
}

/** Grava concursos do fixture pelo mesmo caminho da carga histórica (Mega-Sena, salvo se `def` for informada). */
export async function carregarFixtureNoBanco(
  app: INestApplication,
  ultimos?: number,
  def: LoteriaDefinicao = MEGA_SENA,
) {
  const repositorio = app.get(ConcursosRepositorio);
  return carregarConcursos(
    repositorio,
    def,
    concursosDoFixture(ultimos, def),
    'planilha',
  );
}
