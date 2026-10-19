import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

/** Parte da requisição lida aqui (evita depender dos tipos do express). */
interface RequisicaoComCabecalhos {
  headers: Record<string, string | string[] | undefined>;
}

const resumo = (texto: string): Buffer =>
  createHash('sha256').update(texto).digest();

/**
 * Protege rotas administrativas: o header `X-Chave-Admin` precisa ser igual a `CHAVE_ADMIN`.
 * Sem a variável configurada a rota fica indisponível (503), nunca aberta.
 */
@Injectable()
export class ChaveAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(contexto: ExecutionContext): boolean {
    const esperada = this.config.get<string>('CHAVE_ADMIN');
    if (!esperada) {
      throw new ServiceUnavailableException(
        'chave de administrador não configurada',
      );
    }
    const requisicao = contexto
      .switchToHttp()
      .getRequest<RequisicaoComCabecalhos>();
    const recebida = requisicao.headers['x-chave-admin'];
    const valor = Array.isArray(recebida) ? recebida[0] : recebida;
    // Comparação em tempo constante (os resumos têm sempre o mesmo tamanho).
    if (!valor || !timingSafeEqual(resumo(valor), resumo(esperada))) {
      throw new UnauthorizedException('chave de administrador inválida');
    }
    return true;
  }
}
