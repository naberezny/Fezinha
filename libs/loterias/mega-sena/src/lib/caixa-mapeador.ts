import { criarMapeadorCaixa } from '@sorteios/loterias/comum';
import { MEGA_SENA } from './definicao';

/**
 * Converte a resposta JSON da API da Caixa (`/portaldeloterias/api/megasena/[numero]`) em `Concurso`.
 * Lança erro descritivo se a resposta for inválida. Implementação genérica em `@sorteios/loterias/comum`.
 */
export const mapearRespostaCaixa = criarMapeadorCaixa(MEGA_SENA);
