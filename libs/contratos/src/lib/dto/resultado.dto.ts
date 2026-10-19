import { ApiProperty } from '@nestjs/swagger';

export class PremiacaoDto {
  @ApiProperty() faixa!: number;
  @ApiProperty() ganhadores!: number;
  @ApiProperty({ description: 'Prêmio por ganhador, em centavos' })
  rateioCentavos!: number;
}

export class LocalGanhadorDto {
  @ApiProperty({ required: false }) cidade?: string;
  @ApiProperty({ required: false }) uf?: string;
  @ApiProperty({ description: 'Texto original da fonte (ex.: "DOURADOS/MS")' })
  descricao!: string;
  @ApiProperty() quantidade!: number;
}

/** Um concurso. Valores monetários em centavos (number). */
export class ResultadoDto {
  @ApiProperty() numero!: number;
  @ApiProperty({ example: '2026-10-14', description: 'ISO yyyy-mm-dd' })
  data!: string;
  @ApiProperty({ type: [Number], description: 'Em ordem crescente' })
  dezenas!: number[];
  @ApiProperty() acumulou!: boolean;
  @ApiProperty({ type: () => [PremiacaoDto] }) premiacoes!: PremiacaoDto[];
  @ApiProperty() valorAcumuladoCentavos!: number;
  @ApiProperty() estimativaProximoCentavos!: number;
  @ApiProperty() arrecadacaoCentavos!: number;
  @ApiProperty() acumuladoEspecialCentavos!: number;
  @ApiProperty({ required: false }) proximoNumero?: number;
  @ApiProperty({ required: false, description: 'ISO yyyy-mm-dd' })
  dataProximoSorteio?: string;
  @ApiProperty({ required: false }) observacao?: string;
  @ApiProperty({ type: () => [LocalGanhadorDto] })
  locaisGanhadores!: LocalGanhadorDto[];
}

/** Página de resultados em ordem decrescente de concurso. */
export class PaginaResultadosDto {
  @ApiProperty({ type: () => [ResultadoDto] }) itens!: ResultadoDto[];
  @ApiProperty({ description: 'Total de concursos da loteria' }) total!: number;
  @ApiProperty({ description: 'Base 1' }) pagina!: number;
  @ApiProperty() limite!: number;
}
