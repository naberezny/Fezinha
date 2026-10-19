import { Module } from '@nestjs/common';
import { ConcursosRepositorio } from './concursos.repositorio';
import { EstatisticasService } from './estatisticas.service';
import { LoteriasController } from './loterias.controller';
import { LoteriasService } from './loterias.service';
import { SaudeController } from './saude.controller';

@Module({
  controllers: [LoteriasController, SaudeController],
  providers: [ConcursosRepositorio, LoteriasService, EstatisticasService],
  // A frente de sincronização usa o repositório e `LoteriasService.invalidar`.
  exports: [ConcursosRepositorio, LoteriasService, EstatisticasService],
})
export class LoteriasModule {}
