import { Global, Module } from '@nestjs/common';
import { LoteriasModule } from '../loterias/loterias.module';
import { CaixaCliente } from './caixa.cliente';
import { ChaveAdminGuard } from './chave-admin.guard';
import {
  CONFIG_SINCRONIZACAO,
  CONFIG_SINCRONIZACAO_PADRAO,
} from './configuracao';
import { GarantirAtualizadoInterceptor } from './garantir-atualizado.interceptor';
import { SincronizacaoController } from './sincronizacao.controller';
import { SincronizacaoService } from './sincronizacao.service';

/**
 * Sincronização com a Caixa. Global para que o `LoteriasController` use o
 * `GarantirAtualizadoInterceptor` sem `LoteriasModule` importar este módulo (evita dependência circular).
 */
@Global()
@Module({
  imports: [LoteriasModule],
  controllers: [SincronizacaoController],
  providers: [
    { provide: CONFIG_SINCRONIZACAO, useValue: CONFIG_SINCRONIZACAO_PADRAO },
    CaixaCliente,
    SincronizacaoService,
    GarantirAtualizadoInterceptor,
    ChaveAdminGuard,
  ],
  exports: [SincronizacaoService, GarantirAtualizadoInterceptor],
})
export class SincronizacaoModule {}
