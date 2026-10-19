import { ApiProperty } from '@nestjs/swagger';
import { LoteriaDto } from './loteria.dto';
import { ResultadoDto } from './resultado.dto';

/**
 * Histórico completo da loteria para o cliente calcular estatísticas offline.
 * Mesmo formato de `/resultados` (valores em centavos como number), em ordem crescente de número.
 */
export class HistoricoDto {
  @ApiProperty({ type: () => LoteriaDto }) loteria!: LoteriaDto;
  @ApiProperty({
    type: () => [ResultadoDto],
    description: 'Concursos completos, ordem crescente de número',
  })
  concursos!: ResultadoDto[];
}
