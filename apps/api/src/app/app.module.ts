import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BigIntInterceptor } from '../comum/bigint.interceptor';
import { LoteriasModule } from '../loterias/loterias.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SincronizacaoModule } from '../sincronizacao/sincronizacao.module';

/** Limite global: 100 requisições por minuto por IP. */
export const LIMITE_REQUISICOES = { ttl: 60_000, limit: 100 };

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    ThrottlerModule.forRoot([LIMITE_REQUISICOES]),
    PrismaModule,
    LoteriasModule,
    SincronizacaoModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: BigIntInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
