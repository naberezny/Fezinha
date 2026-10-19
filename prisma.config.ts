import { isAbsolute, resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// O Prisma 7 não lê .env sozinho: carrega o da raiz, se existir.
try {
  process.loadEnvFile('.env');
} catch {
  // sem .env: usa o padrão abaixo
}

/** `file:./x.db` relativo à raiz do workspace (cwd) vira caminho absoluto. */
function resolverUrl(url: string): string {
  if (!url.startsWith('file:')) return url;
  const caminho = url.slice('file:'.length);
  return `file:${isAbsolute(caminho) ? caminho : resolve(process.cwd(), caminho)}`;
}

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: { path: 'apps/api/prisma/migrations' },
  datasource: {
    url: resolverUrl(process.env['DATABASE_URL'] ?? 'file:./apps/api/dados/sorteios.db'),
  },
});
