/**
 * Configuração "artefato": build estática para visualização sem API (ex.: Artifact do Claude).
 * Os dados vêm de arquivos JSON publicados junto com a página (`loterias/lista.json`,
 * `loterias/<id>/historico.json`), as rotas usam `#/caminho` e não há service worker.
 * A sincronização com a Caixa não existe neste modo: os resultados são os do momento da publicação.
 */
export const ambiente = {
  producao: true,
  urlApi: '.',
  estatico: true,
  rotasPorHash: true,
  serviceWorker: false,
};
