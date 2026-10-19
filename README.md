# Sorteios — Mega-Sena

Ferramentas em Python (só biblioteca padrão, nada para instalar) para:

1. **Importar** o export oficial da Caixa (`Mega-Sena.xlsx`) para um banco SQLite estruturado (`megasena.db`).
2. **Gerar jogos** de 6 dezenas a partir do histórico (dezenas atrasadas, frequentes ou mistas).
3. **Consultar** o banco para gráficos (mais/menos sorteadas por período, atraso, acumulados etc.).

> **Aviso honesto:** cada sorteio é independente. Nenhuma estratégia baseada no passado muda a chance real de acertar a sena (1 em 50.063.860 por jogo). Os scripts escolhem números de forma sistemática e reproduzível segundo o histórico, que é o que foi pedido. É critério de escolha, não vantagem.

## Arquivos

| Arquivo | Papel |
|---|---|
| `Mega-Sena.xlsx` | Export da Caixa (20 colunas). Origem de carga, **não** é a fonte da verdade. |
| `megasena.db` | Banco SQLite. Fonte da verdade; será alimentado também pela API no futuro. |
| `banco.py` | Schema, leitura da planilha, `upsert_concursos()` idempotente, views. |
| `importar_planilha.py` | CLI: planilha → banco. |
| `gerar_jogos.py` | CLI: gera jogos lendo o banco (sincroniza a planilha sozinho se ela mudou). |
| `gerar_jogos.cmd` | Atalho de duplo clique no Windows. |

## Fluxo do dia a dia

```bash
# baixou a planilha nova da Caixa por cima da antiga? basta gerar: ele detecta e re-importa
python gerar_jogos.py

# ou importe explicitamente e veja o resumo
python importar_planilha.py --resumo
```

### Opções do gerador

```
python gerar_jogos.py -n 10                 # 10 jogos
python gerar_jogos.py -e atrasados          # padrão: peso cresce com o atraso (1 + (atraso/10)^2)
python gerar_jogos.py -e frequentes         # peso = 1 + vezes que saiu nos últimos N sorteios (-j, padrão 50)
python gerar_jogos.py -e mista              # média geométrica das duas
python gerar_jogos.py -f 10 53              # fixa dezenas em todo jogo
python gerar_jogos.py --relatorio           # tabela completa das 60 dezenas
python gerar_jogos.py --seed 42             # reproduzível
python gerar_jogos.py --salvar              # grava jogos_<data>_<estrategia>.txt
python gerar_jogos.py --sem-sincronizar     # ignora a planilha, usa só o banco
```

Filtros aplicados a todo jogo gerado: nunca repete um resultado já sorteado, 2 a 4 dezenas pares, no máximo 3 dezenas consecutivas.

## Modelo de dados (`megasena.db`)

```
concursos              1 linha por concurso
  concurso PK, data_sorteio (ISO), ganhadores_sena/quina/quadra, rateio_sena/quina/quadra (R$),
  acumulou (0/1), valor_acumulado_sena, arrecadacao_total, estimativa_premio,
  acumulado_mega_virada, observacao, origem ('planilha' | 'api'), atualizado_em
dezenas                6 linhas por concurso
  (concurso, ordem 1..6) PK, dezena 1..60  — índice em dezena
ganhadores_sena_local  0..N linhas por concurso (cidade/UF de cada ganhador da sena)
  concurso, cidade, uf, descricao (texto original)
metadados              chave/valor (ultima_importacao, planilha_mtime, ...)
```

Views prontas para gráfico:

| View | Conteúdo |
|---|---|
| `vw_sorteios` | 1 linha por concurso com `d1..d6` pivotadas, `ano`, `ano_mes`, acumulado, prêmio |
| `vw_frequencia_dezenas` | total histórico, primeiro/último concurso e data por dezena |
| `vw_atraso_dezenas` | atraso atual (concursos desde a última aparição) por dezena |
| `vw_frequencia_dezenas_ano` | total por `(ano, dezena)` |
| `vw_frequencia_dezenas_mes` | total por `(ano_mes, dezena)` |

### Consultas de exemplo

```sql
-- mais sorteadas em 2025
SELECT dezena, total FROM vw_frequencia_dezenas_ano WHERE ano = 2025 ORDER BY total DESC LIMIT 10;

-- menos sorteadas em um período livre
SELECT d.dezena, COUNT(*) AS total
FROM dezenas d JOIN concursos c USING (concurso)
WHERE c.data_sorteio BETWEEN '2026-01-01' AND '2026-06-30'
GROUP BY d.dezena ORDER BY total ASC LIMIT 10;

-- dezenas que nunca saíram nos últimos 50 concursos
SELECT dezena FROM vw_atraso_dezenas WHERE atraso >= 50;

-- evolução mensal de uma dezena
SELECT ano_mes, total FROM vw_frequencia_dezenas_mes WHERE dezena = 10 ORDER BY ano_mes;

-- UFs com mais ganhadores da sena
SELECT uf, COUNT(*) AS ganhadores FROM ganhadores_sena_local WHERE uf IS NOT NULL GROUP BY uf ORDER BY 2 DESC;

-- sequência de acumulados e prêmio estimado
SELECT concurso, data_sorteio, acumulou, valor_acumulado_sena, estimativa_premio FROM concursos ORDER BY concurso DESC LIMIT 20;
```

## Alimentando pela API (futuro)

`banco.upsert_concursos(conn, registros, origem="api")` aceita a mesma estrutura que a planilha produz:

```python
import banco
conn = banco.conectar()
banco.criar_schema(conn)
banco.upsert_concursos(conn, [{
    "concurso": 3071, "data_sorteio": "2026-10-18",
    "dezenas": [3, 12, 27, 34, 45, 59],
    "ganhadores_sena": 0, "rateio_sena": 0.0,
    "ganhadores_quina": 90, "rateio_quina": 50000.0,
    "ganhadores_quadra": 7000, "rateio_quadra": 1000.0,
    "acumulou": 1, "valor_acumulado_sena": 160_000_000.0,
    "arrecadacao_total": 120_000_000.0, "estimativa_premio": 175_000_000.0,
    "acumulado_mega_virada": 98_000_000.0, "observacao": None,
    "locais_sena": [],   # ou [{"cidade": "DOURADOS", "uf": "MS", "descricao": "DOURADOS/MS"}]
}], origem="api")
```

O upsert é idempotente: registros idênticos não são regravados; registros diferentes são substituídos (dezenas e locais junto). Depois disso `gerar_jogos.py --sem-sincronizar` usa só o banco; sem a flag ele ainda re-importa a planilha se o arquivo dela mudar (a planilha só sobrescreve concursos que ela contém).

## Planejamento do webapp (2026-10-16)

- `docs/01-especificacao.md`: decisoes tecnicas (Angular + Ionic, NestJS, Prisma/SQLite, Capacitor), dominio, API, telas do prototipo aprovado.
- `docs/02-plano-execucao.md`: plano mestre por fases (0 a 7), gates e riscos.
- `docs/prototipo-aprovado-v7.html`: copia do prototipo visual aprovado.

## Workspace (Nx)

Workspace Nx + pnpm criado na raiz desta pasta (Fase 0 do webapp "Sorteios"; ver `docs/01-especificacao.md` e `docs/02-plano-execucao.md`). Convive com os scripts Python legados, que não foram alterados.

### Versões (fixadas no `package.json`, sem `^`/`~`)

| Item | Versão |
|------|--------|
| Node | 24.20.0 |
| pnpm | 10.33.1 |
| Nx (`@nx/*`) | 23.3.0 |
| TypeScript | 6.0.3 (exigido pelo Angular 22) |
| Angular | 22.1.8 (CLI/build 22.1.9), zoneless |
| Ionic (`@ionic/angular`) | 9.0.8 (ionicons 8.1.0) |
| NestJS | 11.2.7 (`@nestjs/swagger` 11.4.7, `config` 4.0.4, `throttler` 6.7.1) |
| Prisma (`prisma`, `@prisma/client`, `@prisma/adapter-better-sqlite3`) | 7.10.1 (estável; `latest` do npm é RC) |
| better-sqlite3 | 12.11.1 |
| Jest | 30.5.2 |
| Playwright | 1.64.1 |

### Estrutura

```
apps/
  api/          NestJS (scope:api), prefixo global /api, porta 3000
  api-e2e/      e2e da API (jest)
  app/          Angular + Ionic standalone (scope:app), prefixo srt
  app-e2e/      Playwright
libs/
  core/                  @sorteios/core                  (scope:core)
  contratos/             @sorteios/contratos             (scope:contratos)
  ui/                    @sorteios/ui                    (scope:ui, Angular)
  loterias/mega-sena/    @sorteios/loterias/mega-sena    (scope:loteria)
tools/
  fixtures/              gerar.mjs + megasena-3070.json (histórico congelado)
  carga-historica/       (vazio; Fase 2)
```

Fronteiras de dependência (`@nx/enforce-module-boundaries` em `eslint.config.mjs`): `core` só depende de `core`; `loteria`, `contratos` e `ui` dependem de `core` e de si mesmos; `app` depende de `core`, `ui`, `contratos`, `loteria`; `api` depende de `core`, `contratos`, `loteria`.

### Scripts (`pnpm <script>`)

| Script | Ação |
|--------|------|
| `dev` | `nx run-many -t serve -p api app` (API e app em paralelo) |
| `teste` | `nx run-many -t test` |
| `lint` | `nx run-many -t lint` |
| `build` | `nx run-many -t build` |
| `fixtures:gerar` | regera `tools/fixtures/megasena-3070.json` a partir de `megasena.db` |

Observações: o `package.json` autoriza scripts de instalação (`pnpm.onlyBuiltDependencies`) para `better-sqlite3`, `esbuild`, Prisma e binários nativos do Nx. Prisma schema e `prisma.config.ts` ficam para a Fase 2.

### Como rodar o webapp

1. `pnpm install` (uma vez; roda `prisma generate`).
2. `pnpm prisma:migrar` e depois `pnpm carga:megasena` (carrega os 3.070 concursos do fixture; idempotente).
3. Copie `.env.exemplo` para `.env` e defina `CHAVE_ADMIN` (protege o `POST /loterias/megasena/sincronizar`).
4. `pnpm dev` sobe a API em http://localhost:3000 (Swagger em `/docs`) e o app em http://localhost:4200 (proxy para a API).
   - API sozinha, sem webpack: `node tools/carga-historica/executar-ts.cjs apps/api/src/main.ts`.
5. Atualizar resultados: a primeira consulta do dia sincroniza com a Caixa; manual: `POST /loterias/megasena/sincronizar` com header `X-Chave-Admin`.
6. Build de produção do app (PWA com service worker): `pnpm nx build app --configuration=production` → `dist/apps/app/browser`.

Checklist de aceite e capturas: `docs/03-checklist-testes.md`, `docs/capturas/`. Nesta máquina, prefira Jest direto a `nx test` (ver G4 da checklist).

### Publicar como artefato (build estática, sem API)

1. `pnpm nx build app --configuration=artefato` (URLs relativas, rotas por `#/`, sem service worker; `ambiente.artefato.ts`).
2. Com a API rodando, exporte os dados para `tools/artefato/saida/`: `GET /loterias` → `loterias/lista.json`, `GET /loterias/<id>/historico` → `loterias/<id>/historico.json`, `GET /saude` → `saude.json`.
3. `python tools/artefato/montar.py` monta `tools/artefato/saida/index.html` (fragmento da página) e copia os chunks; publique a pasta inteira como arquivos do artefato.

Nesse modo os resultados são os do momento da publicação (não há sincronização com a Caixa).
