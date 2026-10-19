/**
 * Configuração de desenvolvimento. `urlApi` vazio: as chamadas vão à mesma origem
 * e o proxy do `nx serve` (apps/app/proxy.conf.json) as encaminha para a API local.
 */
export const ambiente = {
  producao: false,
  urlApi: '',
  /** Dados servidos como arquivos JSON estáticos (sem API): muda os caminhos para `.../lista.json`, `.../historico.json`. */
  estatico: false,
  /** Rotas por `#/caminho` (hospedagem estática sem reescrita de URL, ex.: artefato). */
  rotasPorHash: false,
  /** Registra o service worker em produção. */
  serviceWorker: true,
};
