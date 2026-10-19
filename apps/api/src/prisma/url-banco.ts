import { isAbsolute, resolve } from 'node:path';

/** URL padrão do banco de desenvolvimento (relativa à raiz do workspace). */
export const URL_BANCO_PADRAO = 'file:./apps/api/dados/sorteios.db';

/** Transforma `file:./x.db` (relativo ao diretório de execução, a raiz do workspace) em caminho absoluto. */
export function resolverUrlBanco(url: string): string {
  if (!url.startsWith('file:')) return url;
  const caminho = url.slice('file:'.length);
  return `file:${isAbsolute(caminho) ? caminho : resolve(process.cwd(), caminho)}`;
}
