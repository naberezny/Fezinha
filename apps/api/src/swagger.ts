import { INestApplication } from '@nestjs/common';
import {
  ResultadoSincronizacaoDto,
  SincronizacaoDto,
} from '@sorteios/contratos';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { VERSAO_API } from './versao';

/** Documento OpenAPI da API (fonte única do cliente gerado em `libs/contratos`). */
export function criarDocumentoOpenApi(app: INestApplication): OpenAPIObject {
  const configuracao = new DocumentBuilder()
    .setTitle('Sorteios API')
    .setDescription(
      'Resultados, estatísticas e histórico de loterias da Caixa.',
    )
    .setVersion(VERSAO_API)
    .addApiKey(
      { type: 'apiKey', name: 'X-Chave-Admin', in: 'header' },
      'chave-admin',
    )
    .build();
  // Os DTOs de sincronização entram no contrato antes de a rota existir (usados pelo cliente tipado).
  return SwaggerModule.createDocument(app, configuracao, {
    extraModels: [SincronizacaoDto, ResultadoSincronizacaoDto],
  });
}

/** Publica o Swagger UI em `/docs` (JSON em `/docs-json`). */
export function configurarSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, criarDocumentoOpenApi(app));
}
