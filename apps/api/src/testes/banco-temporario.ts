import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import { URL_BANCO_PADRAO } from '../prisma/url-banco';

const PASTA_API = resolve(__dirname, '..', '..');
const PASTA_MIGRACOES = join(PASTA_API, 'prisma', 'migrations');
const ARQUIVO_ENV = resolve(PASTA_API, '..', '..', '.env');

export interface BancoTemporario {
  /** Nome do database criado (`teste_<uuid>`). */
  nome: string;
  /** URL de conexão no formato do Prisma/`pg`. */
  url: string;
  /** Derruba o database (inclusive conexões ainda abertas). */
  remover(): Promise<void>;
}

/**
 * URL de manutenção do servidor onde os databases de teste são criados: `DATABASE_URL_TESTES` ou, sem ela,
 * o servidor de `DATABASE_URL` (padrão: o PostgreSQL do docker-compose.yml) apontando para o database `postgres`.
 */
function urlServidor(): string {
  try {
    process.loadEnvFile(ARQUIVO_ENV);
  } catch {
    // sem .env: usa as variáveis do processo ou o padrão
  }
  const explicita = process.env['DATABASE_URL_TESTES'];
  if (explicita) return explicita;
  return urlComDatabase(
    process.env['DATABASE_URL'] ?? URL_BANCO_PADRAO,
    'postgres',
  );
}

function urlComDatabase(base: string, database: string): string {
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

async function comCliente(
  url: string,
  acao: (cliente: Client) => Promise<unknown>,
): Promise<void> {
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    await acao(cliente);
  } finally {
    await cliente.end();
  }
}

/** Cria um database vazio `teste_<uuid>` no PostgreSQL de testes e aplica todas as migrations, em ordem. */
export async function criarBancoTemporario(): Promise<BancoTemporario> {
  const servidor = urlServidor();
  const nome = `teste_${randomUUID().replaceAll('-', '')}`;
  await comCliente(servidor, (cliente) =>
    cliente.query(`CREATE DATABASE "${nome}"`),
  );

  const url = urlComDatabase(servidor, nome);
  const migracoes = readdirSync(PASTA_MIGRACOES, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .sort();
  await comCliente(url, async (cliente) => {
    for (const migracao of migracoes) {
      await cliente.query(
        readFileSync(join(PASTA_MIGRACOES, migracao, 'migration.sql'), 'utf-8'),
      );
    }
  });

  return {
    nome,
    url,
    remover: () =>
      comCliente(servidor, (cliente) =>
        cliente.query(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`),
      ),
  };
}
