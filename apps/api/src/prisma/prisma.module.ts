import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, URL_BANCO } from './prisma.service';
import { URL_BANCO_PADRAO } from './url-banco';

@Global()
@Module({
  providers: [
    {
      provide: URL_BANCO,
      inject: [ConfigService],
      useFactory: (config: ConfigService): string =>
        config.get<string>('DATABASE_URL') ?? URL_BANCO_PADRAO,
    },
    PrismaService,
  ],
  exports: [PrismaService, URL_BANCO],
})
export class PrismaModule {}
