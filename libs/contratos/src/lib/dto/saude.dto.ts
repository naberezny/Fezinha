import { ApiProperty } from '@nestjs/swagger';

export class SaudeDto {
  @ApiProperty() ok!: boolean;
  @ApiProperty({ example: '0.1.0' }) versao!: string;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Maior número de concurso gravado',
  })
  ultimoConcurso!: number | null;
}
