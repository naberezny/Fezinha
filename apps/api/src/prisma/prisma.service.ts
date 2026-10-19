import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './gerado/client';
import { resolverUrlBanco } from './url-banco';

/** Token de injeção da URL do banco (`DATABASE_URL`). */
export const URL_BANCO = Symbol('URL_BANCO');

/**
 * Cliente Prisma 7 sobre SQLite via driver adapter (better-sqlite3). Não há engine Rust:
 * o adapter recebe a URL e abre o arquivo. Para PostgreSQL basta trocar o adapter e o provider (seção 9 da especificação).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(URL_BANCO) url: string) {
    super({ adapter: new PrismaBetterSqlite3({ url: resolverUrlBanco(url) }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    // WAL + synchronous=NORMAL: gravações muito mais rápidas (carga de 3.000 concursos) e leitura sem bloqueio.
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await this.$queryRawUnsafe('PRAGMA synchronous = NORMAL');
    await this.$queryRawUnsafe('PRAGMA foreign_keys = ON');
    this.logger.log('Banco conectado');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
