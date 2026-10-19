import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { SincronizacaoService } from './sincronizacao.service';

/** Parte da requisição lida aqui (evita depender dos tipos do express). */
interface RequisicaoComParametros {
  params?: Record<string, string | undefined>;
}

/**
 * Antes de uma rota de leitura `/loterias/:id/...`, garante que o banco está atualizado (seção 5.3).
 * Falha da Caixa nunca chega ao cliente: só loteria desconhecida (404) interrompe a requisição.
 */
@Injectable()
export class GarantirAtualizadoInterceptor implements NestInterceptor {
  constructor(private readonly sincronizacao: SincronizacaoService) {}

  async intercept(
    contexto: ExecutionContext,
    proximo: CallHandler,
  ): Promise<Observable<unknown>> {
    const id = contexto.switchToHttp().getRequest<RequisicaoComParametros>()
      .params?.['id'];
    if (id) await this.sincronizacao.garantirAtualizado(id);
    return proximo.handle();
  }
}
