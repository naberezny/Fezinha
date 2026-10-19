import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { configurarSwagger } from './swagger';

async function iniciar() {
  const app = await NestFactory.create(AppModule);
  // Sem prefixo global: as rotas ficam na raiz (/loterias/..., /saude, /docs).
  // ETag exposta: o app (outra origem) lê o cabeçalho para o GET condicional do histórico.
  app.enableCors({ origin: true, exposedHeaders: ['ETag'] });
  configurarSwagger(app);
  const config = app.get(ConfigService);
  const porta = Number(config.get('PORTA') ?? config.get('PORT') ?? 3000);
  await app.listen(porta);
  Logger.log(`API em http://localhost:${porta} (documentação em /docs)`);
}

iniciar();
