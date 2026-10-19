/**
 * Gera o contrato da API:
 *   1. sobe a app em modo de pré-visualização (sem abrir banco nem porta) e escreve libs/contratos/openapi.json;
 *   2. roda openapi-typescript para produzir libs/contratos/src/lib/cliente/tipos-api.ts.
 *
 *   pnpm gerar:cliente
 */
import { NestFactory } from '@nestjs/core';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../src/app/app.module';
import { criarDocumentoOpenApi } from '../src/swagger';

const RAIZ = resolve(__dirname, '..', '..', '..');
const CAMINHO_OPENAPI = resolve(RAIZ, 'libs', 'contratos', 'openapi.json');
const CAMINHO_TIPOS = resolve(
  RAIZ,
  'libs',
  'contratos',
  'src',
  'lib',
  'cliente',
  'tipos-api.ts',
);

async function gerar(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    preview: true,
  });
  const documento = criarDocumentoOpenApi(app);
  await app.close();

  mkdirSync(dirname(CAMINHO_OPENAPI), { recursive: true });
  writeFileSync(
    CAMINHO_OPENAPI,
    JSON.stringify(documento, null, 2) + '\n',
    'utf-8',
  );
  console.log(`OpenAPI: ${CAMINHO_OPENAPI}`);

  const cli = resolve(
    RAIZ,
    'node_modules',
    'openapi-typescript',
    'bin',
    'cli.js',
  );
  const resultado = spawnSync(
    process.execPath,
    [cli, CAMINHO_OPENAPI, '-o', CAMINHO_TIPOS],
    {
      cwd: RAIZ,
      stdio: 'inherit',
    },
  );
  if (resultado.status !== 0) {
    throw new Error(`openapi-typescript falhou (código ${resultado.status})`);
  }
  console.log(`Tipos: ${CAMINHO_TIPOS}`);
}

gerar().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
