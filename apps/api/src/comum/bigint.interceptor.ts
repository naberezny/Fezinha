import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

/** Converte BigInt em number, recursivamente, em objetos simples e arrays. Centavos cabem em 2^53. */
export function converterBigInt<T>(valor: T): T {
  if (typeof valor === 'bigint') {
    return Number(valor) as unknown as T;
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => converterBigInt(item)) as unknown as T;
  }
  if (valor !== null && typeof valor === 'object') {
    const prototipo = Object.getPrototypeOf(valor);
    if (prototipo !== Object.prototype && prototipo !== null) {
      // Instâncias de classe (Date, Buffer, StreamableFile…) seguem o caminho normal de serialização.
      return valor;
    }
    const resultado: Record<string, unknown> = {};
    for (const [chave, item] of Object.entries(valor)) {
      resultado[chave] = converterBigInt(item);
    }
    return resultado as T;
  }
  return valor;
}

/** Interceptor global: `JSON.stringify` não aceita BigInt, então toda resposta passa por aqui antes de serializar. */
@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(
    _contexto: ExecutionContext,
    proximo: CallHandler,
  ): Observable<unknown> {
    return proximo.handle().pipe(map((corpo) => converterBigInt(corpo)));
  }
}
