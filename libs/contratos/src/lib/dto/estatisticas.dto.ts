import { ApiProperty } from '@nestjs/swagger';

export class EstatisticaDezenaDto {
  @ApiProperty() dezena!: number;
  @ApiProperty({ description: 'Vezes que saiu no período' })
  frequencia!: number;
  @ApiProperty({
    description: 'Concursos desde a última aparição (0 = saiu no último)',
  })
  atraso!: number;
  @ApiProperty({ description: 'Maior intervalo sem sair já registrado' })
  atrasoMaximo!: number;
  @ApiProperty({ required: false }) ultimoConcurso?: number;
  @ApiProperty({ required: false }) ultimaData?: string;
  @ApiProperty({ description: '(1 - sorteadas/universo) ^ atraso' })
  probAusencia!: number;
}

export class DistribuicaoParesDto {
  @ApiProperty({ description: 'Quantidade de dezenas pares no sorteio' })
  pares!: number;
  @ApiProperty({ description: 'Quantos concursos tiveram essa quantidade' })
  total!: number;
}

export class FaixaSomaDto {
  @ApiProperty({
    description: 'Início da faixa (múltiplo do tamanho da faixa)',
  })
  inicio!: number;
  @ApiProperty() total!: number;
}

export class ResumoAnoDto {
  @ApiProperty() ano!: number;
  @ApiProperty() concursos!: number;
  @ApiProperty() acumulados!: number;
  @ApiProperty() ganhadores!: number;
  @ApiProperty() maiorPremioCentavos!: number;
}

export class FrequenciaMesDto {
  @ApiProperty({ example: '2026-10' }) anoMes!: string;
  @ApiProperty() dezena!: number;
  @ApiProperty() total!: number;
}

export class EstatisticasDto {
  @ApiProperty({ example: 'ultimos:50' }) periodo!: string;
  @ApiProperty() concursosNoPeriodo!: number;
  @ApiProperty({ type: () => [EstatisticaDezenaDto] })
  dezenas!: EstatisticaDezenaDto[];
  @ApiProperty({ type: () => [DistribuicaoParesDto] })
  pares!: DistribuicaoParesDto[];
  @ApiProperty({
    type: () => [FaixaSomaDto],
    description: 'Soma das dezenas por faixa de 20',
  })
  soma!: FaixaSomaDto[];
  @ApiProperty({ type: () => [ResumoAnoDto] }) porAno!: ResumoAnoDto[];
  @ApiProperty({
    type: () => [FrequenciaMesDto],
    description: 'Últimos 12 meses',
  })
  porMes!: FrequenciaMesDto[];
}
