# Fixtures da API da Caixa (Lotofácil)

Respostas **reais** (não sintéticas) da API pública não documentada da Caixa, capturadas em **19/10/2026**:

| Arquivo | Requisição | Observação |
|---|---|---|
| `caixa-lotofacil-ultimo.json` | `GET https://servicebus3.caixa.gov.br/portaldeloterias/api/lotofacil/` | Último concurso na data da captura: 3807 (18/10/2026, `ultimoConcurso: true`). Muda quando houver concurso mais novo; os testes só checam a estrutura. |
| `caixa-lotofacil-3807.json` | `GET https://servicebus3.caixa.gov.br/portaldeloterias/api/lotofacil/3807` | Concurso de 18/10/2026 (3 ganhadores de 15 acertos, arrecadação R$ 20.337.170,00). Base dos testes com valores exatos. |

Comando usado (HTTP 200, ~2,7 KB cada):

```bash
curl -sS -m 30 -A "Mozilla/5.0" "https://servicebus3.caixa.gov.br/portaldeloterias/api/lotofacil/[numero]"
```

Os arquivos são o corpo da resposta sem alteração.

## Diferenças em relação à Mega-Sena e à Lotomania

- `listaDezenas` vem com **15** dezenas (strings de 2 dígitos, ordem crescente) entre `"01"` e `"25"`.
- `listaRateioPremio` traz **5** faixas: `faixa` 1..5 = 15, 14, 13, 12 e 11 acertos; coincide com `LOTOFACIL.faixas`.
- `valorAcumuladoConcursoEspecial` é o acumulado da **Lotofácil da Independência** (R$ 12.324.605,61 no 3807).
- `listaMunicipioUFGanhadores` vem **preenchida** no 3807 (primeiro fixture real com ganhadores do prêmio principal):
  `{ ganhadores, municipio, uf, posicao, serie, nomeFatansiaUL }`. Aposta pela internet vem como
  `municipio: "CANAL ELETRONICO"` e `uf: "--"`.
