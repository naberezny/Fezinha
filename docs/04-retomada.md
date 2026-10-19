# Ponto de retomada — 2026-10-17

## Estado
- Webapp Sorteios completo e verificado: `apps/api` (NestJS 11 + Prisma 7.10.1/SQLite em `apps/api/dados/sorteios.db`), `apps/app` (Angular 22 + Ionic 9, PWA), libs `core`, `ui`, `contratos`, `loterias/{comum,mega-sena,lotomania}`.
- Loterias: Mega-Sena (3.070 concursos) e Lotomania (2.988; planilha oficial `Lotomania.xlsx` na raiz). Sincronização real com a Caixa funciona (`POST /loterias/:id/sincronizar`, header `X-Chave-Admin`).
- Navegação: `/` (cartões por jogo) → `/:loteria/gerar|resultados|estatisticas`; cor por jogo (`cor` na definição); filtros ocultos quando não aplicáveis.
- Artefato https://claude.ai/artifact/RxVZTVtRah4u8dypaeJ8nD = app real em build estática (`pnpm nx build app --configuration=artefato` + `tools/artefato/montar.py`), versão 8.
- Último gate: lint/test/build verdes (710 testes no gate completo; app 290, api 172, ui 89, core 164).

## Decisões fechadas
Ver `docs/01-especificacao.md` (D1–D12) e `docs/03-checklist-testes.md` (seções G, H, I). Chance "1 em N" arredondada (Lotomania 11.372.636; Caixa publica 11.372.635 truncado). Regra "máx. 3 por linha" inaplicável quando dezenas > 3 × linhas.

## Pendências (dono: João decide)
- I6: tela inicial só mostra o último concurso da loteria ativa; proposta: endpoint `GET /loterias/resumo`.
- G12: tela "Meus jogos" (jogos salvos existem no IndexedDB, sem tela).
- G3: fixture real de concurso com ganhador da Sena (confirmar formato dos locais na API da Caixa).
- D14: Lighthouse não rodado.
- Fase 5 (lojas): Capacitor Android/iOS, PWABuilder/MSIX, política de privacidade, contas.

## Como retomar
- Rodar: `pnpm dev` na pasta Sorteios (API 3000 + app 4200). API rápida: `node tools/carga-historica/executar-ts.cjs apps/api/src/main.ts`.
- Testes: Jest direto (`pnpm exec jest -c <proj>/jest.config.cts --rootDir <proj>`); `nx test` trava com a máquina carregada. Gate completo: `NX_DAEMON=false pnpm nx run-many -t lint test build --parallel=1 --skip-nx-cache` (~25 min).
- Nunca `curl` via rtk (usar PowerShell `Invoke-WebRequest`). Heredoc longo no Bash falha (usar Write/Edit).
- Tudo local, sem git (decisão do João).
