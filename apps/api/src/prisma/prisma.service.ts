import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './gerado/client';

/** Token de injeção da URL do banco (`DATABASE_URL`). */
export const URL_BANCO = Symbol('URL_BANCO');

/**
 * Cliente Prisma 7 sobre PostgreSQL via driver adapter (`@prisma/adapter-pg`, driver `pg`). Não há engine Rust:
 * o adapter recebe a URL e abre o pool de conexões.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(URL_BANCO) url: string) {
    super({ adapter: new PrismaPg({ connectionString: url }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Banco conectado');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
