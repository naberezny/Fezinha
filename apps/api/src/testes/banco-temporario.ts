import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const PASTA_API = resolve(__dirname, '..', '..');
const PASTA_MIGRACOES = join(PASTA_API, 'prisma', 'migrations');
const PASTA_TEMPORARIA = join(PASTA_API, 'tmp');

export interface BancoTemporario {
  /** Caminho absoluto do arquivo SQLite. */
  caminho: string;
  /** URL no formato do Prisma (`file:<caminho absoluto>`). */
  url: string;
  /** Apaga o arquivo e os auxiliares do WAL. */
  remover(): void;
}

/** Cria um SQLite vazio em `apps/api/tmp/teste-<uuid>.db` e aplica todas as migrations, em ordem. */
export function criarBancoTemporario(): BancoTemporario {
  mkdirSync(PASTA_TEMPORARIA, { recursive: true });
  const caminho = join(PASTA_TEMPORARIA, `teste-${randomUUID()}.db`);

  const banco = new Database(caminho);
  try {
    const migracoes = readdirSync(PASTA_MIGRACOES, { withFileTypes: true })
      .filter((entrada) => entrada.isDirectory())
      .map((entrada) => entrada.name)
      .sort();
    for (const nome of migracoes) {
      banco.exec(
        readFileSync(join(PASTA_MIGRACOES, nome, 'migration.sql'), 'utf-8'),
      );
    }
  } finally {
    banco.close();
  }

  return {
    caminho,
    url: `file:${caminho}`,
    remover: () => {
      for (const sufixo of ['', '-journal', '-wal', '-shm']) {
        const arquivo = `${caminho}${sufixo}`;
        if (existsSync(arquivo)) rmSync(arquivo, { force: true });
      }
    },
  };
}
