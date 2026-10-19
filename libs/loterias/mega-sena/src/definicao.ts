/**
 * Entrada enxuta da Mega-Sena para o app: só a definição e o registro.
 * Evita arrastar o mapeador da Caixa (e o `zod`), que só a API usa, para o bundle do navegador.
 */
export { MEGA_SENA } from './lib/definicao';
export { registrarMegaSena } from './lib/registrar';
