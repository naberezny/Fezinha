/**
 * Configuração de produção (troca `ambiente.ts` via `fileReplacements`).
 * `urlApi` vazio: o app e a API são servidos pela mesma origem.
 */
export const ambiente = {
  producao: true,
  urlApi: '',
  estatico: false,
  rotasPorHash: false,
  serviceWorker: true,
};
