import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { descreverSaidaExterna } from './comum/saida-externa';
import { configurarSwagger } from './swagger';

async function iniciar() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Atrás de proxies (produção: nginx do servidor → nginx do container → API), o IP real do cliente vem no
  // X-Forwarded-For. CONFIAR_PROXY = quantos proxies confiáveis há na frente; sem ele, o limite de requisições
  // por IP valeria para todos os usuários juntos (todos chegariam com o IP do proxy).
  const saltosProxy = Number(process.env['CONFIAR_PROXY'] ?? 0);
  if (saltosProxy > 0) app.set('trust proxy', saltosProxy);
  // Sem prefixo global: as rotas ficam na raiz (/loterias/..., /saude, /docs).
  // ETag exposta: o app (outra origem) lê o cabeçalho para o GET condicional do histórico.
  app.enableCors({ origin: true, exposedHeaders: ['ETag'] });
  configurarSwagger(app);
  const config = app.get(ConfigService);
  const porta = Number(config.get('PORTA') ?? config.get('PORT') ?? 3000);
  await app.listen(porta);
  Logger.log(`API em http://localhost:${porta} (documentação em /docs)`);
  Logger.log(descreverSaidaExterna(process.env));
}

iniciar();
