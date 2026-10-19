# Fixtures da API da Caixa (Lotomania)

Respostas **reais** (não sintéticas) da API pública não documentada da Caixa, capturadas em **16/10/2026**:

| Arquivo | Requisição | Observação |
|---|---|---|
| `caixa-lotomania-ultimo.json` | `GET https://servicebus3.caixa.gov.br/portaldeloterias/api/lotomania/` | Último concurso na data da captura: 2988 (16/10/2026, `ultimoConcurso: true`). Muda quando houver concurso mais novo; os testes só checam a estrutura. |
| `caixa-lotomania-2987.json` | `GET https://servicebus3.caixa.gov.br/portaldeloterias/api/lotomania/2987` | Concurso de 14/10/2026 (acumulado, arrecadação R$ 8.068.611,00). Base dos testes com valores exatos. |

Comando usado (HTTP 200, ~2,6 KB cada, sem necessidade de `-k`):

```bash
curl -sS -m 30 -A "Mozilla/5.0" "https://servicebus3.caixa.gov.br/portaldeloterias/api/lotomania/[numero]"
```

Os arquivos são o corpo da resposta sem alteração.

## Diferenças em relação à Mega-Sena

- `listaDezenas` vem com **20** dezenas (strings de 2 dígitos, ordem crescente); a dezena zero aparece como `"00"`.
- `listaRateioPremio` traz **7** faixas: `faixa` 1..6 = 20, 19, 18, 17, 16 e 15 acertos; `faixa` 7 = "0 acertos"
  (premia quem errou todas as 50 dezenas). O mapeador usa o número da `faixa`, que coincide com `LOTOMANIA.faixas`.
- `valorAcumuladoConcursoEspecial` vem `0.0` e `indicadorConcursoEspecial` vem `1` (sem concurso especial no momento).
- `listaMunicipioUFGanhadores` veio **vazia** nos dois (concursos acumulados); o formato dos itens segue o da Mega-Sena.
- Nenhum dos dois concursos tem a dezena 00: o teste dessa dezena usa o **concurso 1 (02/10/1999)**, montado à mão sobre
  o molde da resposta real (dezenas `00 06 11 14 16 21 22 25 32 33 34 46 61 70 73 78 88 89 90 95`).
