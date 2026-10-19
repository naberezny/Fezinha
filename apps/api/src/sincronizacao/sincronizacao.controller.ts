import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ResultadoSincronizacaoDto,
  SincronizacaoDto,
} from '@sorteios/contratos';
import { ChaveAdminGuard } from './chave-admin.guard';
import { SincronizacaoService } from './sincronizacao.service';

/** Limite do `POST /sincronizar`: bem abaixo do global, pois cada chamada pode consultar a Caixa várias vezes. */
export const LIMITE_SINCRONIZAR = { limit: 5, ttl: 60_000 };

@ApiTags('sincronizacao')
@Controller('loterias')
export class SincronizacaoController {
  constructor(private readonly sincronizacao: SincronizacaoService) {}

  @Get(':id/sincronizacao')
  @ApiParam({ name: 'id', example: 'megasena' })
  @ApiOkResponse({
    type: SincronizacaoDto,
    description: 'Última sincronização, último concurso e último erro',
  })
  @ApiNotFoundResponse({ description: 'Loteria desconhecida' })
  estado(@Param('id') id: string): Promise<SincronizacaoDto> {
    return this.sincronizacao.estado(id);
  }

  @Post(':id/sincronizar')
  @Throttle({ default: LIMITE_SINCRONIZAR })
  @UseGuards(ChaveAdminGuard)
  @ApiSecurity('chave-admin')
  @ApiHeader({
    name: 'X-Chave-Admin',
    required: true,
    description: 'Igual à variável de ambiente CHAVE_ADMIN',
  })
  @ApiParam({ name: 'id', example: 'megasena' })
  @ApiQuery({
    name: 'de',
    required: false,
    example: 3000,
    description: 'Primeiro concurso do intervalo a reimportar',
  })
  @ApiQuery({
    name: 'ate',
    required: false,
    example: 3070,
    description: 'Último concurso do intervalo (máximo de 500 concursos)',
  })
  @ApiOkResponse({
    type: ResultadoSincronizacaoDto,
    description: 'Força a busca na Caixa e informa o que mudou',
  })
  @ApiBadRequestResponse({ description: 'Intervalo inválido' })
  @ApiResponse({ status: 401, description: 'Chave de administrador inválida' })
  @ApiNotFoundResponse({ description: 'Loteria desconhecida' })
  @ApiResponse({
    status: 429,
    description: 'Limite de 5 requisições por minuto',
  })
  @ApiBadGatewayResponse({ description: 'Falha ao consultar a Caixa' })
  @ApiResponse({
    status: 503,
    description: 'Chave de administrador não configurada',
  })
  sincronizar(
    @Param('id') id: string,
    @Query('de', new ParseIntPipe({ optional: true })) de?: number,
    @Query('ate', new ParseIntPipe({ optional: true })) ate?: number,
  ): Promise<ResultadoSincronizacaoDto> {
    return this.sincronizacao.sincronizar(id, { forcar: true, de, ate });
  }
}
