import { criarMapeadorCaixa } from '@sorteios/loterias/comum';
import { LOTOFACIL } from './definicao';

/**
 * Converte a resposta JSON da API da Caixa (`/portaldeloterias/api/lotofacil/[numero]`) em `Concurso`.
 * Exige 15 dezenas em 1..25. Lança erro descritivo se a resposta for inválida.
 * Implementação genérica em `@sorteios/loterias/comum`.
 */
export const mapearRespostaCaixaLotofacil = criarMapeadorCaixa(LOTOFACIL);
