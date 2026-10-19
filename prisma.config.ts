import { defineConfig } from 'prisma/config';

// O Prisma 7 não lê .env sozinho: carrega o da raiz, se existir.
try {
  process.loadEnvFile('.env');
} catch {
  // sem .env: usa o padrão abaixo
}

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: { path: 'apps/api/prisma/migrations' },
  datasource: {
    // Mesmo padrão de apps/api/src/prisma/url-banco.ts: o PostgreSQL do docker-compose.yml.
    url:
      process.env['DATABASE_URL'] ??
      'postgresql://sorteios:sorteios@localhost:5432/sorteios',
  },
});
