# Fixtures

## megasena-3070.json

Histórico congelado da Mega-Sena (concursos 1 a 3070), exportado de `megasena.db` (legado Python)
pelo script `gerar.mjs` (Node 24, módulo nativo `node:sqlite`, banco aberto somente leitura).
Usado pelos testes de paridade das Fases 1 e 2.

Contagens obtidas:

| Item | Valor |
|------|-------|
| Concursos | 3070 |
| Dezenas | 18420 (6 por concurso) |
| Locais de ganhadores | 903 (um registro por linha de `ganhadores_sena_local`, agrupados por cidade/uf/descrição com `quantidade`) |

Checksum SHA-256 do array `concursos` (estável entre regerações do mesmo banco):

```
34e9562df91d2e452364ecf5e96ba80b453e46c2826495adcb0a11dfc172f5e2
```

O campo `geradoEm` muda a cada execução, por isso o checksum do arquivo inteiro não é estável.
Valores monetários em centavos inteiros (`Math.round(valor * 100)`); concursos em ordem crescente de `numero`.

Verificações rápidas já conferidas: frequência da dezena 10 = 359 e da dezena 26 = 250.

### Regerar

```bash
pnpm fixtures:gerar
# equivalente a: node tools/fixtures/gerar.mjs
```

O script imprime as contagens e os checksums; confira com a tabela acima. Se `megasena.db` mudar
(novos concursos), o nome do arquivo e este README precisam ser atualizados.

## lotomania-2987.json

Histórico congelado da Lotomania (concursos 1 a 2987, de 02/10/1999 a 14/10/2026), gerado a partir da planilha
oficial `Lotomania.xlsx` (export da Caixa, na raiz do repositório) pelo mesmo leitor da carga histórica
(`apps/api/src/carga/leitor-planilha.ts`, dirigido pela definição `LOTOMANIA`). Mesmo formato do fixture da
Mega-Sena (`{ loteria, geradoEm, concursos }`, valores em centavos inteiros, concursos em ordem crescente),
com 7 premiações por concurso (faixas 1 a 6 = 20 a 15 acertos; faixa 7 = "Nenhum acerto").

Contagens obtidas:

| Item | Valor |
|------|-------|
| Concursos | 2987 |
| Dezenas | 59740 (20 por concurso; dezenas 00..99) |
| Premiações | 20909 (7 por concurso) |
| Concursos com a dezena 00 | 597 |
| Locais de ganhadores | 1245 (1122 grupos cidade/uf/descrição) |

Checksum SHA-256 do array `concursos` (estável entre regerações da mesma planilha):

```
177a21cb297d8e6f0754d9e92a415170411b8fd26716ae87a933750505e8eaa9
```

Observações da planilha: nos primeiros anos as colunas "Ganhadores/Rateio 15 acertos" e "Rateio Nenhum Número"
vêm como `-` (lido como 0). A planilha não tem coluna de acumulado especial (`acumuladoEspecialCentavos` = 0).

### Regerar

```bash
pnpm fixtures:lotomania
# equivalente a: node tools/carga-historica/executar-ts.cjs tools/carga-historica/src/main.ts \
#   --loteria lotomania --planilha Lotomania.xlsx --exportar-fixture tools/fixtures/lotomania-2987.json
```

Com `--exportar-fixture` a carga só grava o JSON e não toca o banco. Se a planilha mudar (novos concursos),
o nome do arquivo, a tabela acima e o `ARQUIVOS_FIXTURE` de `apps/api/src/carga/leitor-fixture.ts` precisam ser atualizados.
