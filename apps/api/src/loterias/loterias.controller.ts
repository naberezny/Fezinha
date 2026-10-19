import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  EstatisticasDto,
  HistoricoDto,
  LoteriaDto,
  PaginaResultadosDto,
  ResultadoDto,
} from '@sorteios/contratos';
import { GarantirAtualizadoInterceptor } from '../sincronizacao/garantir-atualizado.interceptor';
import { EstatisticasService } from './estatisticas.service';
import { LoteriasService } from './loterias.service';
import { PERIODO_PADRAO } from './periodo';

const LIMITE_MAXIMO = 200;

/** Parte da resposta HTTP usada aqui (evita depender dos tipos do express, que o Nest traz internamente). */
interface RespostaHttp {
  setHeader(nome: string, valor: string): unknown;
  status(codigo: number): unknown;
}

/** Verdadeiro quando algum validador de `If-None-Match` coincide com a ETag atual. */
function etagCoincide(cabecalho: string | undefined, etag: string): boolean {
  if (!cabecalho) return false;
  return cabecalho
    .split(',')
    .map((valor) => valor.trim().replace(/^W\//, ''))
    .some((valor) => valor === '*' || valor === etag);
}

@ApiTags('loterias')
@Controller('loterias')
export class LoteriasController {
  constructor(
    private readonly loterias: LoteriasService,
    private readonly estatisticas: EstatisticasService,
  ) {}

  @Get()
  @ApiOkResponse({
    type: LoteriaDto,
    isArray: true,
    description: 'Definições das loterias registradas',
  })
  listar(): LoteriaDto[] {
    return this.loterias.listar();
  }

  @Get(':id/resultados')
  @UseInterceptors(GarantirAtualizadoInterceptor)
  @ApiParam({ name: 'id', example: 'megasena' })
  @ApiQuery({
    name: 'limite',
    required: false,
    example: 8,
    description: `1 a ${LIMITE_MAXIMO}`,
  })
  @ApiQuery({
    name: 'pagina',
    required: false,
    example: 1,
    description: 'Base 1',
  })
  @ApiOkResponse({ type: PaginaResultadosDto })
  @ApiNotFoundResponse({ description: 'Loteria desconhecida' })
  resultados(
    @Param('id') id: string,
    @Query('limite', new DefaultValuePipe(8), ParseIntPipe) limite: number,
    @Query('pagina', new DefaultValuePipe(1), ParseIntPipe) pagina: number,
  ): Promise<PaginaResultadosDto> {
    if (limite < 1 || limite > LIMITE_MAXIMO) {
      throw new BadRequestException(
        `limite deve estar entre 1 e ${LIMITE_MAXIMO}`,
      );
    }
    if (pagina < 1) {
      throw new BadRequestException('pagina deve ser maior ou igual a 1');
    }
    return this.loterias.resultados(id, limite, pagina);
  }

  @Get(':id/resultados/:numero')
  @UseInterceptors(GarantirAtualizadoInterceptor)
  @ApiParam({ name: 'id', example: 'megasena' })
  @ApiParam({ name: 'numero', example: 3070 })
  @ApiOkResponse({ type: ResultadoDto })
  @ApiNotFoundResponse({ description: 'Loteria ou concurso desconhecido' })
  resultado(
    @Param('id') id: string,
    @Param('numero', ParseIntPipe) numero: number,
  ): Promise<ResultadoDto> {
    return this.loterias.resultado(id, numero);
  }

  @Get(':id/estatisticas')
  @UseInterceptors(GarantirAtualizadoInterceptor)
  @ApiParam({ name: 'id', example: 'megasena' })
  @ApiQuery({
    name: 'periodo',
    required: false,
    example: PERIODO_PADRAO,
    description: 'ultimos:N, ano:AAAA ou tudo',
  })
  @ApiOkResponse({ type: EstatisticasDto })
  @ApiNotFoundResponse({ description: 'Loteria desconhecida' })
  estatisticasDaLoteria(
    @Param('id') id: string,
    @Query('periodo') periodo?: string,
  ): Promise<EstatisticasDto> {
    return this.estatisticas.calcular(id, periodo);
  }

  @Get(':id/historico')
  @UseInterceptors(GarantirAtualizadoInterceptor)
  @ApiParam({ name: 'id', example: 'megasena' })
  @ApiOkResponse({
    type: HistoricoDto,
    description: 'Cabeçalho ETag: "<ultimoNumero>-<total>"',
  })
  @ApiResponse({
    status: 304,
    description: 'If-None-Match coincide com a ETag atual',
  })
  @ApiNotFoundResponse({ description: 'Loteria desconhecida' })
  async historico(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) resposta: RespostaHttp,
  ): Promise<HistoricoDto | undefined> {
    const etag = await this.loterias.etagHistorico(id);
    resposta.setHeader('ETag', etag);
    resposta.setHeader('Cache-Control', 'no-cache');
    if (etagCoincide(ifNoneMatch, etag)) {
      resposta.status(304);
      return undefined;
    }
    return this.loterias.historico(id);
  }
}
