# loterias-comum

Código compartilhado pelos plugins de loteria (`libs/loterias/*`).

- `criarMapeadorCaixa(def)`: mapeador genérico da API pública da Caixa (`/portaldeloterias/api/<loteria>/[numero]`) para `Concurso`.
  Dirigido pela `LoteriaDefinicao`: quantidade de dezenas = `def.sorteadas`, dezenas válidas por `dezenaValida` (aceita "00"
  quando `primeiraDezena` é 0), premiações de `listaRateioPremio` pela `faixa` numérica. Tolerante a campos extras.

Usa `zod`: **não** importe esta lib no bundle do navegador (o app usa só as entradas `.../definicao` de cada loteria).
