import { ApiProperty } from '@nestjs/swagger';

export class FaixaPremiacaoDto {
  @ApiProperty({ description: '1 = prêmio principal' }) faixa!: number;
  @ApiProperty() acertos!: number;
  @ApiProperty({ example: 'Sena' }) nome!: string;
}

export class ApostaDto {
  @ApiProperty() min!: number;
  @ApiProperty() max!: number;
}

export class VolanteDto {
  @ApiProperty() colunas!: number;
  @ApiProperty() linhas!: number;
}

/** Definição declarativa de uma loteria registrada. */
export class LoteriaDto {
  @ApiProperty({ example: 'megasena' }) id!: string;
  @ApiProperty({ example: 'Mega-Sena' }) nome!: string;
  @ApiProperty({ example: '#209869', description: 'cor base da marca, hex' })
  cor!: string;
  @ApiProperty({
    description:
      'Quantidade de dezenas do volante: as válidas vão de primeiraDezena a primeiraDezena + universo - 1',
  })
  universo!: number;
  @ApiProperty({
    enum: [0, 1],
    description: 'Menor dezena do volante: 1 (Mega-Sena, 01..60) ou 0 (Lotomania, 00..99)',
  })
  primeiraDezena!: 0 | 1;
  @ApiProperty({ description: 'Dezenas sorteadas por concurso' })
  sorteadas!: number;
  @ApiProperty({ type: () => ApostaDto }) aposta!: ApostaDto;
  @ApiProperty({ type: () => VolanteDto }) volante!: VolanteDto;
  @ApiProperty() quadrantes!: number;
  @ApiProperty({ type: () => [FaixaPremiacaoDto] })
  faixas!: FaixaPremiacaoDto[];
  @ApiProperty({ type: [Number], description: '0 = domingo … 6 = sábado' })
  diasSorteio!: number[];
  @ApiProperty({ type: [String] }) regrasDisponiveis!: string[];
}
