# API (NestJS + Prisma 7 / SQLite)

## Primeira execução

```bash
cp .env.exemplo .env          # opcional; sem .env valem os padrões
pnpm prisma:gerar             # gera o cliente Prisma em apps/api/src/prisma/gerado (também roda no pnpm install)
pnpm prisma:migrar            # aplica as migrations em apps/api/dados/sorteios.db
pnpm carga:megasena           # 3.070 concursos do fixture (ou: pnpm carga:megasena -- --planilha Mega-Sena.xlsx)
pnpm carga:lotomania          # 2.987 concursos do fixture (ou: pnpm carga:lotomania -- --planilha Lotomania.xlsx)
pnpm nx serve api             # http://localhost:3000  ·  documentação em /docs
```

## Prisma 7 (como está configurado)

- Sem engine Rust: o `PrismaClient` recebe um driver adapter (`@prisma/adapter-better-sqlite3`), ver `src/prisma/prisma.service.ts`.
- A URL do banco **não** fica no `schema.prisma`: `prisma.config.ts` (raiz) informa o `datasource.url` ao `migrate`; em runtime vem de `DATABASE_URL` (padrão `file:./apps/api/dados/sorteios.db`, relativo à raiz).
- Gerador `prisma-client` com `output = ../src/prisma/gerado` e `moduleFormat = "cjs"` (o diretório gerado não é versionado).
- Nova migration: edite o schema e rode `pnpm prisma:nova-migracao`.
- Para PostgreSQL: seção 9 de `docs/01-especificacao.md`.

## Rotas

`GET /loterias` (definição completa de cada loteria: Mega-Sena e Lotomania, com `primeiraDezena`), `/loterias/:id/resultados`, `/loterias/:id/resultados/:numero`, `/loterias/:id/estatisticas?periodo=`,
`/loterias/:id/historico` (ETag, 304), `/loterias/:id/sincronizacao`, `POST /loterias/:id/sincronizar?de=&ate=` (protegida), `/saude`.
Sem prefixo global. Valores monetários saem em centavos (`number`).

## Sincronização com a Caixa

Código em `src/sincronizacao/`; algoritmo na seção 5.3 de `docs/01-especificacao.md`.

- **Lazy**: as rotas de leitura (`resultados`, `resultados/:numero`, `estatisticas`, `historico`) passam pelo `GarantirAtualizadoInterceptor`, que chama `SincronizacaoService.garantirAtualizado`. Se a `Sincronizacao` da loteria está *vencida* (nunca sincronizou, passou de 24 h ou o `proximoSorteioEm`, 20h de Brasília = 23:00Z, já passou) busca na Caixa o último concurso e os que faltam, grava com `origem = 'caixa'` e invalida o cache do histórico. Não vencida: nenhuma chamada.
- **Falha da Caixa nunca derruba a leitura**: o erro vai para `ultimoErro` e a resposta usa o banco. Depois de uma falha, as leituras só voltam a tentar após 60 s (`esperaAposErroMs`), para uma queda da Caixa não atrasar cada requisição. Entre o horário do sorteio e a publicação do resultado, a reconsulta é no máximo a cada 10 min.
- **Lock em memória por loteria**: chamadas concorrentes aguardam a mesma sincronização (1 chamada HTTP). É por processo: com várias instâncias da API, cada uma consulta a Caixa por conta própria.
- **Banco vazio**: grava só o último concurso. O histórico vem de `pnpm carga:megasena` / `pnpm carga:lotomania`.
- **Loterias**: `src/loterias/loterias-suportadas.ts` é a fonte única (definição + registro); cada uma precisa de um mapeador em `src/sincronizacao/mapeadores.ts`.
- `GET /loterias/:id/sincronizacao`: `ultimaEm`, `ultimoConcurso`, `proximoSorteioEm`, `ultimoErro`, `emAndamento` (informativo).
- `POST /loterias/:id/sincronizar`: força a busca. Exige o header `X-Chave-Admin` igual a `CHAVE_ADMIN` (401 se errada; 503 se a variável não existe). `?de=&ate=` reimporta o intervalo (máx. 500 concursos; sem consultar o "último"). Responde `{ novos, atualizados, inalterados, ultimoConcurso }`; falha da Caixa = 502. Limite de 5 por minuto por IP.

```bash
curl -X POST -H "X-Chave-Admin: $CHAVE_ADMIN" http://localhost:3000/loterias/megasena/sincronizar
curl http://localhost:3000/loterias/megasena/sincronizacao
```

Variáveis: `CAIXA_API_URL` (padrão `https://servicebus3.caixa.gov.br/portaldeloterias/api`; os testes apontam para um servidor local) e `CHAVE_ADMIN`.

## Carga histórica (`tools/carga-historica`)

`--loteria <id>` (padrão `megasena`), `--planilha <xlsx>` (export oficial da Caixa) e `--exportar-fixture <json>` (só grava o fixture, sem tocar o banco). O leitor de planilha (`src/carga/leitor-planilha.ts`) é dirigido pela `LoteriaDefinicao`: lê `Bola1..Bola{sorteadas}` e casa "Ganhadores/Rateio N acertos" (e "Nenhum Número" = 0 acertos) com `faixas[].acertos`; `-` ou vazio = 0.

## Contrato (OpenAPI e cliente)

`pnpm gerar:cliente` sobe a app em modo de pré-visualização (sem banco nem porta), grava `libs/contratos/openapi.json` e
gera `libs/contratos/src/lib/cliente/tipos-api.ts`. O teste `verificacao-contrato.spec.ts` falha se um DTO mudar sem regenerar.

## Testes

`pnpm nx test api` (ou `pnpm exec jest -c apps/api/jest.config.cts --rootDir apps/api`). Cada suíte que usa banco cria `apps/api/tmp/teste-<uuid>.db`, aplica as migrations e apaga o arquivo no fim.
Os testes da sincronização usam `src/testes/caixa-simulada.ts`, um servidor HTTP local que responde com o fixture real da Caixa (o `nock` 15 é ESM puro e não carrega neste Jest CommonJS); `criarAppDeTeste` marca as loterias como recém-sincronizadas, então as outras suítes nunca consultam a Caixa.
`carga-historica.spec.ts` grava os 3.070 concursos (lento: ~1 min em máquina modesta).
