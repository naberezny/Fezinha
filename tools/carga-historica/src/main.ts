/**
 * Carga histórica de uma loteria no banco da API.
 *
 *   pnpm carga:megasena                                  # lê tools/fixtures/megasena-3070.json
 *   pnpm carga:megasena -- --planilha Mega-Sena.xlsx     # lê o export oficial da Caixa
 *   pnpm carga:lotomania                                 # lê tools/fixtures/lotomania-2987.json
 *   pnpm carga:lotomania -- --planilha Lotomania.xlsx    # lê o export oficial da Caixa
 *
 * Opções: `--loteria <id>` (padrão megasena), `--planilha <arquivo.xlsx>`, `--exportar-fixture <arquivo.json>`
 * (grava os concursos lidos no formato de tools/fixtures; com ele, o banco NÃO é tocado).
 *
 * Idempotente: pode rodar quantas vezes quiser; só grava o que for novo ou diferente.
 * Banco: DATABASE_URL (padrão file:./apps/api/dados/sorteios.db). Aplique antes `pnpm prisma:migrar`.
 */
import { resolve } from 'node:path';
import {
  caminhoFixture,
  carregarConcursos,
  escreverFixture,
  lerFixture,
  lerPlanilha,
} from '../../../apps/api/src/carga';
import { ConcursosRepositorio } from '../../../apps/api/src/loterias/concursos.repositorio';
import {
  LOTERIAS_SUPORTADAS,
  loteriaSuportada,
} from '../../../apps/api/src/loterias/loterias-suportadas';
import { PrismaService } from '../../../apps/api/src/prisma/prisma.service';
import { URL_BANCO_PADRAO } from '../../../apps/api/src/prisma/url-banco';

function argumento(nome: string): string | undefined {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] : undefined;
}

async function principal(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // sem .env: usa o padrão
  }

  const loteriaId = argumento('--loteria') ?? 'megasena';
  const suportada = loteriaSuportada(loteriaId);
  if (!suportada) {
    const ids = LOTERIAS_SUPORTADAS.map((l) => l.def.id).join(', ');
    throw new Error(`Loteria '${loteriaId}' desconhecida. Suportadas: ${ids}`);
  }
  const { def } = suportada;
  suportada.registrar();

  const planilha = argumento('--planilha');
  const fonte = planilha ? resolve(planilha) : caminhoFixture(def.id);
  const origem = 'planilha';
  const concursos = planilha
    ? await lerPlanilha(fonte, def)
    : lerFixture(fonte);
  console.log(`Fonte: ${fonte} (${concursos.length} concursos de ${def.nome})`);

  const destinoFixture = argumento('--exportar-fixture');
  if (destinoFixture) {
    escreverFixture(resolve(destinoFixture), def, concursos);
    console.log(`Fixture gravado em ${resolve(destinoFixture)}`);
    return;
  }

  const prisma = new PrismaService(
    process.env['DATABASE_URL'] ?? URL_BANCO_PADRAO,
  );
  await prisma.onModuleInit();
  try {
    const repositorio = new ConcursosRepositorio(prisma);
    const resumo = await carregarConcursos(
      repositorio,
      def,
      concursos,
      origem,
      (feitos, total) => console.log(`  ${feitos}/${total}`),
    );
    const ultimoNoBanco = await repositorio.ultimoNumero(def.id);
    console.log(
      `${resumo.novos} novos, ${resumo.atualizados} atualizados, ${resumo.inalterados} inalterados`,
    );
    console.log(`Último concurso no banco: ${ultimoNoBanco ?? 'nenhum'}`);
  } finally {
    await prisma.onModuleDestroy();
  }
}

principal().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
