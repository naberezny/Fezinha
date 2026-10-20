# Ponto de retomada — 2026-10-20

## Estado
- Webapp Sorteios completo e verificado: `apps/api` (NestJS 11 + Prisma 7.10.1/**PostgreSQL 17** via `docker-compose.yml`), `apps/app` (Angular 22 + Ionic 9, PWA), libs `core`, `ui`, `contratos`, `loterias/{comum,mega-sena,lotomania,lotofacil}`.
- Loterias: Mega-Sena (3.070 concursos), Lotomania (2.987) e Lotofácil (3.807); planilhas oficiais `Lotomania.xlsx` e `Lotofacil.xlsx` na raiz. Sincronização real com a Caixa funciona (`POST /loterias/:id/sincronizar`, header `X-Chave-Admin`).
- Banco: até 19/10/2026 era SQLite (`apps/api/dados/sorteios.db`, arquivo antigo ainda na pasta, ignorado pelo git e sem uso). Detalhes da migração: seção 9 de `docs/01-especificacao.md`.
- Navegação: `/` (cartões por jogo) → `/:loteria/gerar|resultados|estatisticas|teste`; cor por jogo (`cor` na definição); filtros ocultos quando não aplicáveis.
- Artefato https://claude.ai/artifact/RxVZTVtRah4u8dypaeJ8nD = app real em build estática (`pnpm nx build app --configuration=artefato` + `tools/artefato/montar.py`), versão 9 (ainda sem a Lotofácil).
- Ritmo das dezenas (tabela em Estatísticas) e aba Teste das estratégias (19/10): nos resultados reais nenhuma estratégia, incluindo o "ritmo" de cada dezena, sai do acaso. Detalhes: `docs/03-checklist-testes.md` seção K e seções 4.2, 4.5 e 6.6 da especificação.
- Composição dos concursos (painel em Estatísticas) e Mista com barra "mais ou menos frequentes" (20/10): ver seção L do checklist.
- Produção (20/10): docker compose em `deploy/` (ver `deploy/README.md`), na VPS Contabo `37.60.236.219` (aaPanel; acesso `ssh fezinha-vps`), código em `/opt/fezinha/src`, segredos em `/opt/fezinha/src/deploy/.env`. Aberto em http://37.60.236.219:8095 (`ENDERECO_WEB=0.0.0.0`, sem HTTPS). A VPS fica na França e a Caixa devolve 403 para ela: os concursos novos não entram até `CAIXA_PROXY` apontar para um proxy no Brasil.
- Último gate (20/10, Jest direto): 871 testes verdes (api 185, app 309, core 200, ui 95, mega-sena 45, lotomania 16, lotofacil 10, comum 6, contratos 5); lint sem erros; build de api e app ok.

## Decisões fechadas
Ver `docs/01-especificacao.md` (D1–D12) e `docs/03-checklist-testes.md` (seções G, H, I, J, K). Chance "1 em N" arredondada (Lotomania 11.372.636; Caixa publica 11.372.635 truncado). Regra "máx. 3 por linha" inaplicável quando dezenas > 3 × linhas. Lotofácil: nenhuma regra nem filtro (desde 19/10: `quadrantes`, `historico` e `pares` juntos descartavam só 3,5% dos jogos de 15 dezenas e <1% dos de 17+; `consecutivas` e `linhas` reprovam 87% e 97% dos resultados reais); sem regra `quadrantes`, o volante não mostra divisórias e o jogo não mostra a contagem de quadrantes.

## Pendências (dono: João decide)
- Proxy no Brasil para a Caixa: VM gratuita na Oracle Cloud São Paulo com tinyproxy (só o IP da VPS, com senha, só `caixa.gov.br`), depois `CAIXA_PROXY` no `.env` da VPS e redeploy.
- Domínio com HTTPS no aaPanel (proxy reverso para `127.0.0.1:8095`) e então voltar `ENDERECO_WEB` para `127.0.0.1`.
- I6: tela inicial só mostra o último concurso da loteria ativa; proposta: endpoint `GET /loterias/resumo`.
- G12: tela "Meus jogos" (jogos salvos existem no IndexedDB, sem tela).
- G3: fixture real de concurso **da Mega-Sena** com ganhador da Sena (o formato dos locais já foi confirmado com a Lotofácil 3807).
- D14: Lighthouse não rodado.
- Artefato: republicar com a Lotofácil, o ritmo e a aba Teste.
- Docker (imagem da API/app) ficou para depois; hoje o `docker-compose.yml` só sobe o PostgreSQL.
- Fase 5 (lojas): Capacitor Android/iOS, PWABuilder/MSIX, política de privacidade, contas.

## Como retomar
- Banco: `docker compose up -d postgres` antes de tudo (API e testes da API dependem dele).
- Rodar: `pnpm dev` (API 3000 + app 4200). API rápida: `node tools/carga-historica/executar-ts.cjs apps/api/src/main.ts`.
- Testes: Jest direto (`pnpm exec jest -c <proj>/jest.config.cts --rootDir <proj>`); `nx test` trava com a máquina carregada. Gate completo: `NX_DAEMON=false pnpm nx run-many -t lint test build --parallel=1 --skip-nx-cache` (~25 min).
- Docker Desktop nesta máquina (Windows build 26300): se travar ao abrir com "remove …\dockerInference" ou "…\engine.sock: Não é possível o acesso ao arquivo", são sockets Unix órfãos que o Windows não apaga (erro 1920). Feche o Docker Desktop, renomeie `%LOCALAPPDATA%\Docker\run` e `%LOCALAPPDATA%\docker-secrets-engine` (ex.: `run.antigo-<data>`) e abra de novo.
- Nunca `curl` via rtk (usar `command curl` ou PowerShell `Invoke-WebRequest`). Heredoc longo no Bash falha (usar Write/Edit). Saída de `jest`/`grep` via rtk pode vir resumida: use `rtk proxy` quando precisar do texto exato.
