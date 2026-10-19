import { criarMapeadorCaixa } from '@sorteios/loterias/comum';
import { LOTOMANIA } from './definicao';

/**
 * Converte a resposta JSON da API da Caixa (`/portaldeloterias/api/lotomania/[numero]`) em `Concurso`.
 * Aceita a dezena "00" e exige 20 dezenas em 0..99. Lança erro descritivo se a resposta for inválida.
 * Implementação genérica em `@sorteios/loterias/comum`.
 */
export const mapearRespostaCaixaLotomania = criarMapeadorCaixa(LOTOMANIA);
