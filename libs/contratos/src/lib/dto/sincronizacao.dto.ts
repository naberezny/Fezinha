import { ApiProperty } from '@nestjs/swagger';

/** Estado da última sincronização com a Caixa . */
export class SincronizacaoDto {
  @ApiProperty() loteriaId!: string;
  @ApiProperty({ type: String, nullable: true, description: 'ISO 8601' })
  ultimaEm!: string | null;
  @ApiProperty({ type: Number, nullable: true }) ultimoConcurso!: number | null;
  @ApiProperty({ type: String, nullable: true, description: 'ISO 8601' })
  proximoSorteioEm!: string | null;
  @ApiProperty({ type: String, nullable: true }) ultimoErro!: string | null;
  @ApiProperty({ description: 'Informativo: há uma sincronização em curso' })
  emAndamento!: boolean;
}

/** Resultado de uma sincronização forçada. */
export class ResultadoSincronizacaoDto {
  @ApiProperty() novos!: number;
  @ApiProperty() atualizados!: number;
  @ApiProperty() inalterados!: number;
  @ApiProperty({ type: Number, nullable: true }) ultimoConcurso!: number | null;
}
