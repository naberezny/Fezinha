# Fixtures da API da Caixa (Mega-Sena)

Respostas **reais** (não sintéticas) da API pública não documentada da Caixa, capturadas em **16/10/2026**:

| Arquivo | Requisição | Observação |
|---|---|---|
| `caixa-megasena-ultimo.json` | `GET https://servicebus3.caixa.gov.br/portaldeloterias/api/megasena/` | Último concurso na data da captura: 3070 (`ultimoConcurso: true`). |
| `caixa-megasena-3070.json` | `GET https://servicebus3.caixa.gov.br/portaldeloterias/api/megasena/3070` | Concurso específico. Idêntico ao anterior, porque o 3070 era o último. |

Comando usado (HTTP 200, 1779 bytes cada, sem necessidade de `-k`):

```bash
curl -sS -m 30 -A "Mozilla/5.0" "https://servicebus3.caixa.gov.br/portaldeloterias/api/megasena/[numero]"
```

Os arquivos são o corpo da resposta sem alteração. Quando houver um concurso mais novo, o "último" deixa de ser o 3070
(os testes que dependem do 3070 usam `caixa-megasena-3070.json`, que não muda).

## Campos reais encontrados

`acumulado`, `dataApuracao`, `dataProximoConcurso`, `dezenasSorteadasOrdemSorteio`, `exibirDetalhamentoPorCidade`, `id`,
`indicadorConcursoEspecial`, `listaDezenas`, `listaDezenasSegundoSorteio`, `listaMunicipioUFGanhadores`,
`listaRateioPremio[] { descricaoFaixa, faixa, numeroDeGanhadores, valorPremio }`, `listaResultadoEquipeEsportiva`,
`localSorteio`, `nomeMunicipioUFSorteio`, `nomeTimeCoracaoMesSorte`, `numero`, `numeroConcursoAnterior`,
`numeroConcursoFinal_0_5`, `numeroConcursoProximo`, `numeroJogo`, `observacao`, `premiacaoContingencia`, `tipoJogo`,
`tipoPublicacao`, `tituloConcursoEspecial`, `ultimoConcurso`, `valorArrecadado`, `valorAcumuladoConcurso_0_5`,
`valorAcumuladoConcursoEspecial`, `valorAcumuladoProximoConcurso`, `valorEstimadoProximoConcurso`,
`valorSaldoReservaGarantidora`, `valorTotalPremioFaixaUm`.

## Diferenças em relação à especificação 5.3

Todos os campos esperados existem com o nome previsto; nenhum ajuste de nome foi necessário. Observações:

- Valores monetários vêm como **número JSON em reais** (ex.: `52767.96`, `120502302.0`), não texto; o mapeador aceita também texto.
- `listaDezenas` vem em ordem crescente como strings `"19"`; `dezenasSorteadasOrdemSorteio` traz a ordem de sorteio (ignorada).
- `observacao` vem `""` quando não há observação (o mapeador converte em ausente).
- `nomeTimeCoracaoMesSorte` vem com caracteres `\u0000` (lixo; ignorado).
- `listaMunicipioUFGanhadores` veio **vazia** (concurso acumulado), portanto os campos `ganhadores`, `municipio` e `uf` desse
  item **não puderam ser confirmados** na resposta real; seguem a especificação 5.3 (e o legado: `municipio` pode ser
  "CANAL ELETRONICO" e `uf` ausente/`--`). Capturar um concurso com ganhador da Sena (ex.: o 3069, se tiver) e
  salvar como novo fixture para confirmar.
- Campos úteis não mapeados por não existirem em `Concurso`: `localSorteio`, `nomeMunicipioUFSorteio`,
  `numeroConcursoAnterior`, `valorTotalPremioFaixaUm`, `indicadorConcursoEspecial`, `tituloConcursoEspecial`.
