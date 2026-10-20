# Sorteios — Checklist de testes de aceite (rodar uma vez, ao final)

Preenchido durante o desenvolvimento; cada item vira ✅/❌ na rodada final. Correções são delegadas por item.
Comandos rodam na raiz `C:\Users\joao.naberezny\repositorios\Sorteios`.

## A. Workspace (Fase 0)

- [x] A1 `pnpm nx run-many -t lint test build` verde em todos os projetos.
- [x] A2 Lint de fronteiras: import de `@sorteios/contratos` dentro de `libs/core` falha no lint.
- [x] A3 `tools/fixtures/megasena-3070.json`: 3070 concursos, 18420 dezenas, 903 locais; primeiro = 1 (1996-03-11, 04 05 30 33 41 52), último = 3070 (2026-10-14, 19 27 29 43 54 60).
- [x] A4 `package.json` sem `^`/`~`; Prisma 7.10.1 com `@prisma/adapter-better-sqlite3`.

## B. Domínio `libs/core` (Fase 1)

- [x] B1 `nx test core` verde, cobertura ≥ 90 %.
- [x] B2 Paridade: frequência total 10→359, 53→350, 26→250, 21→261; atraso 34→43, 45→40, 32→39, 59→35; atraso máximo 42→108.
- [x] B3 Pares: 0:40, 1:271, 2:738, 3:944, 4:747, 5:292, 6:38. Soma das frequências = 3070 × 6.
- [x] B4 Período `ultimos:50`: 43→11×, 11→10×, 16→10×. `ano:2025`: 15→24×, 54→23×; menos: 26→9×, 41→9×.
- [x] B5 Volante: 01→Q1, 10→Q2, 51→Q3, 60→Q4; C(6,6)=1, C(7,6)=7, C(12,6)=924, C(20,6)=38760, C(60,6)=50063860.
- [x] B6 Pesos: atraso 30, esperado 10, intensidade 2 → 10; abaixo do mínimo → 1; aleatório → 1 para todas.
- [x] B7 Geração com semente fixa é reproduzível; honra fixas; sem jogos repetidos; todo jogo passa nos filtros ligados; k=20 desliga `colunas` sozinho; fixas 01..06 + `historico` → `incompleto=true`.
- [x] B8 Filtros: quadrantes, colunas (k ≤ 10), linhas (≤ 3 por linha), historico (k = 6), pares (⌊k/3⌋..k−⌊k/3⌋), consecutivas (≤ 3).
- [x] B9 `mapearRespostaCaixa` converte o fixture real da Caixa em `Concurso` (centavos exatos, dezenas crescentes, locais); campo ausente → erro descritivo.

## C. API (Fase 2)

- [x] C1 `nx test api` verde; `prisma migrate` aplica em banco vazio; unique (loteriaId, numero).
- [x] C2 `pnpm carga:megasena` → último 3070, 18420 dezenas, 903 locais; segunda execução → 3070 inalterados.
- [x] C3 `GET /loterias` lista megasena; `GET /loterias/megasena/resultados?limite=8` devolve 8 com 3070 primeiro; `GET .../resultados/3070` bate com o fixture.
- [x] C4 `GET /loterias/megasena/estatisticas?periodo=ultimos:50` bate com B4; `?periodo=tudo` bate com B2.
- [x] C5 `GET /loterias/megasena/historico` devolve ETag; repetição com `If-None-Match` → 304.
- [x] C6 Sincronização (Caixa mockada): não vencida → 0 chamadas; vencida sem concurso novo → 1 chamada e marca; vencida com 3 faltando → 4 chamadas, 3 novos; 20 requisições concorrentes → 1 chamada; Caixa fora → resposta do banco + `ultimoErro`.
- [x] C7 `POST /loterias/megasena/sincronizar` sem `X-Chave-Admin` → 401; com chave → `{novos, atualizados, inalterados, ultimoConcurso}`; `?de=3000&ate=3005` reimporta 6.
- [x] C8 `GET /loterias/megasena/sincronizacao` mostra última data, último concurso, erro.
- [x] C9 **Teste real** (uma vez, com rede): `POST /sincronizar` traz os concursos > 3070 da Caixa; resposta real salva como fixture em `libs/loterias/mega-sena/src/lib/fixtures/`.
- [x] C10 `/docs` (Swagger) abre; `pnpm gerar:cliente` regenera `libs/contratos` sem diff inesperado.
- [x] C11 BigInt nunca vaza no JSON (todas as rotas serializam número).

## D. App (Fase 3)

- [x] D1 `nx test app ui` verde; `nx build app` sem warnings de orçamento.
- [x] D2 Tema claro/escuro alterna pelos tokens; nenhuma cor literal fora de `tokens.scss` (lint).
- [x] D3 Gerar: modo padrão "Dezenas atrasadas" aberto; 5 jogos de 6 gerados; badge de atraso em cada bola; meta "sem sair há X concursos, em média"; legenda do atraso visível.
- [x] D4 Gerar: k=12 → combinações 924, `colunas` desabilitado; k=6 → legenda pares "2 a 4 pares em 6"; k=9 → "3 a 6 pares em 9".
- [x] D5 Volante: marcar 7 dezenas com k=6 é bloqueado; dezenas fixas aparecem com anel nos jogos; resumo "nenhuma · o sistema escolhe todas as 6".
- [x] D6 Intensidade: slider muda o texto vivo (20/30/40 concursos) e o valor "2 de 3".
- [x] D7 Modos frequentes/mista/aleatório geram; filtros impossíveis → estado vazio com orientação.
- [x] D8 Copiar escreve "Jogo 01: 03 06 32 42 46 51" por linha; Salvar guarda em "Meus jogos" (persiste após recarregar); Exportar usa Web Share ou cai no copiar.
- [x] D9 Resultados anteriores: KPIs (último concurso, acumulado atual com sequência, estimativa, ganhadores no ano); tabela com 3070 primeiro e pill "Acumulou"; "Ver todos" pagina; acumulados/ganhadores por ano desde 2016; UF (SP 234); maiores prêmios (2150 = R$ 289,4 mi).
- [x] D10 Estatísticas: período padrão últimos 50; KPIs; frequência com 5+/5− em destaque e ordenação por dezena/total; atraso com linha em 10; listas mais/menos; mapa de calor 12 × 60; pares; soma.
- [x] D11 Tooltips aparecem ao passar o mouse nos gráficos.
- [x] D12 Responsivo: 375 px sem scroll horizontal; abas no rodapé em celular; barra superior em desktop.
- [x] D13 Offline (Playwright `setOffline`): recarregar mostra resultados do cache e gera jogos.
- [ ] D14 Acessibilidade: foco visível, `aria-pressed` no volante, `aria-selected` nas abas verificados nos specs; Lighthouse NÃO rodado (sem ferramenta na máquina); PWA: manifesto + service worker ativos (verificado em D13).
- [x] D15 Aviso "cada sorteio é independente…" e "não afiliado à Caixa" visíveis.

## E. Ponta a ponta

- [x] E1 `pnpm dev` sobe api (3000) e app (4200); app lê resultados reais da API.
- [x] E2 Recarregar o app revalida o cache: `historico` responde 304 (300 bytes) e a tela abre do IndexedDB; alteração de concurso no banco não exercitada.
- [ ] E3 Comparação visual com `docs/prototipo-aprovado-v7.html`: capturas em `docs/capturas/` (desktop, 390 px, tema escuro, offline) conferidas por mim; aprovação do João pendente.

## F. Empacotamento (Fase 5, quando chegar)

- [ ] F1 `manifest.webmanifest` válido; ícones maskable; Lighthouse "installable".
- [ ] F2 `npx cap add android` + `npx cap sync` sem erro; APK de debug abre a tela Gerar.
- [ ] F3 Projeto iOS gerado (`npx cap add ios`); build só em macOS (registrar como pendente).
- [ ] F4 PWABuilder gera MSIX a partir da PWA hospedada (pendente de hospedagem).

## G. Pendências conhecidas (corrigir na rodada final)

- [x] G1 `gerarJogos`: quando `fixas.length === dezenasPorJogo`, só existe um jogo possível; sair cedo (`incompleto=true` após o 1º jogo) em vez de gastar 20.000 tentativas.
- [x] G2 `gerarJogos`: id de regra desconhecido em `config.regras` deve dar erro de validação claro (hoje vem de `obterFiltro`).
- [ ] G3 Mapeador da Caixa: capturar um concurso com ganhador da Sena para confirmar o formato de `listaMunicipioUFGanhadores` (fixture real).
  Parcial (19/10/2026): o formato foi confirmado com o concurso 3807 real da **Lotofácil** (3 locais, inclusive `CANAL ELETRONICO` com `uf: "--"`), que passa pelo mesmo mapeador genérico (`libs/loterias/comum`). Falta só um fixture da Mega-Sena com ganhador.
- [x] G4 Comandos de teste: usar Jest direto (`pnpm exec jest -c <lib>/jest.config.cts --rootDir <lib>`), `--testPathPatterns` (Jest 30); `nx test` trava no grafo com a máquina carregada.
- [x] G5 `libs/ui/graficos/estilos.ts` (`ESTILOS_SVG` compartilhado): confirmar que compila no build AOT do app (só validado no Jest).
- [x] G6 Mapa de calor: `data-v` limitado a 4 ("4 ou mais"); legenda do app deve dizer "4+".
- [x] G7 API: CORS com `Access-Control-Expose-Headers: ETag` (e `origin` configurável) para o app em origem diferente reaproveitar o cache; no dev o proxy resolve.
- [x] G8 App: instalar `@angular/service-worker@22.1.8`, ligar `provideServiceWorker` no `app.config.ts` e `serviceWorker: apps/app/ngsw-config.json` na build de produção (pré-requisito do D13).
- [x] G9 App: `tsconfig.spec.json` com target es2016/node10 impede `tsc` nos specs (Jest passa sem checar tipos); alinhar ao `tsconfig.base`.
- [x] G10 Estatísticas: `srt-lista-barras` aceitar input `maximo` para a lista "menos sorteadas" escalar pelo maior valor da lista "mais sorteadas" (como no protótipo).
- [x] G11 Estatísticas: KPI "Média por dezena" com vírgula decimal ("5,0×"), consistente com pt-BR.
- [ ] G12 App: os jogos salvos (`JogosSalvosStore`) ainda não têm onde ser vistos; adicionar seção "Meus jogos" (lista + remover) na tela Gerar ou rota própria. Não estava no protótipo: confirmar com o João.

## Resultado da rodada final (2026-10-17)

- Gate `nx run-many -t lint test build` em 8 projetos: verde (13 min). Testes: core 119, mega-sena 45, ui 79, contratos 5, api 152, app 163 = 563. Bundle inicial do app: 568 kB bruto / 149 kB transferido.
- Verificado no navegador real (Playwright) com API e dados reais: as 3 telas (desktop e 390 px), tema escuro persistido, salvar jogos no IndexedDB, revalidação por ETag (304), offline com service worker (API e servidor derrubados). Capturas em `docs/capturas/`.
- Pendentes: E3 (aprovação visual do João), D14 Lighthouse, G3, G12 (decisão do João), Fase 5 (lojas).

## H. Lotomania (2026-10-17)

- [x] H1 Planilha oficial `Lotomania.xlsx` baixada da Caixa (2.987 concursos, 1 a 2987, 20 bolas 00..99).
- [x] H2 Core com `primeiraDezena`: volante 00→Q1, 99→Q4; estatísticas e geração com dezena 0; paridade da Mega-Sena inalterada.
- [x] H3 Mapeador genérico `criarMapeadorCaixa(def)` em `libs/loterias/comum`; Mega-Sena (25 testes) e Lotomania (fixture real) verdes.
- [x] H4 `pnpm carga:lotomania` → 2987 novos, 59.740 dezenas; segunda execução inalterada; fixture `tools/fixtures/lotomania-2987.json`.
- [x] H5 `GET /loterias` devolve as duas definições completas (com `primeiraDezena`); `/loterias/lotomania/resultados`, `/historico`, `/estatisticas` (100 dezenas, 0 presente).
- [x] H6 Sincronização real `POST /loterias/lotomania/sincronizar` (último 2987 ou 2988).
- [x] H7 App: seletor dinâmico lista Mega-Sena e Lotomania; troca persiste; cache por loteria.
- [x] H8 App Gerar (Lotomania): volante 10×10 começando em 00, dezenas fixas em 50, combinações oculto, 3 regras, 50 dezenas geradas, chance 1 em 11.372.636 (arredondado; a Caixa publica 11.372.635 truncado).
- [x] H9 App Resultados/Estatísticas (Lotomania): rótulos "20 acertos", 20 bolas por linha sem estourar, frequência com 100 barras, mapa de calor 100 colunas, atraso esperado 5.
- [x] H10 Gate completo (lint, test, build) verde; bundle inicial < 600 kB.
- [x] H11 Verificação visual das 3 telas com Lotomania (desktop e celular).

## Resultado da rodada Lotomania (2026-10-17)

- Gate `lint test build` em 10 projetos: verde (core 164, comum 6, mega-sena 45, lotomania 16, ui 89, contratos 5, api 172, app 213 = 710 testes). Bundle inicial do app: 571 kB.
- Verificado no navegador com dados reais: Gerar (50 dezenas, 00..99, chance 1 em 11.372.636), Estatísticas (100 dezenas, seletor de loteria), Resultados (desktop e 390 px, tabela com 2 linhas de 10 bolas), troca de loteria persistida.
- Decisões: `chanceUmEm` arredonda (tabela oficial da Mega-Sena); na Lotomania a Caixa publica o valor truncado (11.372.635). Regra "máx. 3 por linha" inaplicável quando dezenas por jogo > 3 × linhas.

## I. Ajustes de navegação e tema (2026-10-17)

- [x] I1 Cor base por loteria na definição (`cor`); API expõe; app deriva todo o tema (`--cor-loteria` → accent, bolas, abas, KPIs; tinta clara/escura por luminância; tons clareados no escuro). Mega-Sena verde, Lotomania laranja.
- [x] I2 Filtros modulares: só aparecem os que a loteria oferece E que se aplicam à quantidade de dezenas; seção vazia some; resumo conta só os visíveis.
- [x] I3 Tela inicial `/` com cartão por loteria (Gerar jogos / Ver todos os resultados) e cartões "em breve"; rotas por jogo `/:loteria/gerar|resultados|estatisticas`; redirecionamentos dos caminhos antigos.
- [x] I4 Resultados = todos os resultados (50 por página, 62 páginas na Mega-Sena) com KPIs e gráficos.
- [x] I5 Gate (api, app, ui, contratos) verde: 556 testes; bundle 564 kB. Prints em `docs/capturas/v2-*.png`.
- [ ] I6 Tela inicial: só o cartão da loteria ativa mostra o último concurso (store carrega um histórico por vez); mostrar o resumo de todas exige um endpoint leve de resumo ou carregar os históricos em segundo plano.
- [x] I7 Artefato atualizado com o app real (build `artefato`: URLs relativas, rotas por hash, sem service worker, dados JSON embutidos: Mega-Sena 3070 e Lotomania 2988). Testado localmente como pasta estática; versão 8 do artefato.
- [x] I8 Jogos gerados no celular: bolas em várias por linha (6 de 34 px em 390 px; Lotomania 9 linhas de 6) e resumo abaixo das bolas; corrigido em `libs/ui/jogo` (bolas sem encolher, grade de 2 colunas até 640 px). Artefato versão 9.

## J. PostgreSQL e Lotofácil (2026-10-19)

- [x] J1 Banco da API migrado de SQLite para PostgreSQL 17 (`docker-compose.yml`, `docker compose up -d postgres`): provider `postgresql`, migration inicial regerada, `@prisma/adapter-pg` + `pg` no lugar de `better-sqlite3`.
- [x] J2 Testes da API no Postgres: cada suíte cria e derruba um database `teste_<uuid>`; nenhum database órfão depois da suíte. 181 testes verdes (14 suítes, ~1 min).
- [x] J3 Cargas no Postgres idempotentes: Mega-Sena 3070, Lotomania 2987, Lotofácil 3807.
- [x] J4 Planilha oficial `Lotofacil.xlsx` baixada da Caixa (3.807 concursos, 1 a 3807); fixture `tools/fixtures/lotofacil-3807.json`; o concurso 3807 da planilha é idêntico ao da API da Caixa.
- [x] J5 `libs/loterias/lotofacil`: definição (25/15, aposta 15..20, volante 5 × 5, 5 faixas, cor `#930089`), registro e mapeador com fixtures reais (`caixa-lotofacil-3807.json`, `caixa-lotofacil-ultimo.json`); 10 testes.
- [x] J6 API: `GET /loterias` lista a Lotofácil; carga histórica completa e sincronização (`POST /loterias/lotofacil/sincronizar`, com e sem `de`/`ate`) cobertas por testes.
- [x] J7 App sem alteração de tela: cartão roxo ativo na tela inicial, gerar (15 a 20 dezenas, chance 1 em 3.268.760), resultados (3.807 concursos) e estatísticas (25 dezenas). Prints em `docs/capturas/v3-lotofacil-*.jpg`.
- [x] J8 Defeito achado na Lotofácil e corrigido: atraso esperado fracionário (25/15) aparecia cru (`1.6666666666666667`); agora "1,7" (`formatarAtraso` no core) e atraso mínimo padrão 2.
- [x] J9 Corrigido também o teste de `libs/loterias/comum`, que não compilava desde a criação do campo `cor` (6 testes voltaram a rodar).
- Gate desta rodada (Jest direto): api 181, app 291, core 170, ui 90, mega-sena 45, lotomania 16, lotofacil 10, comum 6, contratos 5 = 814; lint sem erros; build de api e app ok.

## K. Ritmo das dezenas e teste das estratégias (2026-10-19)

- [x] K1 Análise nos resultados reais: o intervalo médio entre aparições por dezena fica dentro do acaso (Mega-Sena 8,6 a 12,1 para esperado 10; Lotomania 4,6 a 5,5 para 5; Lotofácil 1,60 a 1,75 para 1,67); a correlação entre um intervalo e o seguinte fica no nível do ruído (6/60, 8/100 e 1/25 dezenas além de 2σ, contra ~3, 5 e 1 esperadas).
- [x] K2 `libs/core`: `calcularRitmo` / `AcompanhamentoRitmo` (8 testes) e `executarTesteEstrategias` / `testarEstrategias` / `acasoDoJogo` (8 testes); `sortearDezenas` exportado de `geracao.ts` para o teste usar a mesma roleta.
- [x] K3 Estatísticas: tabela "Ritmo de cada dezena" (ordem "mais fora do ritmo" e "por dezena", 2 casas na Lotofácil, rolagem própria, colunas legíveis no celular) e nota com o acaso + link para o Teste; 3 testes novos contados à mão.
- [x] K4 Nova aba Teste (`/:loteria/teste`, barra superior e tab bar): janela 100/500/1.000/histórico, execução em fatias com progresso, KPIs, gráfico de intervalos e tabela; 8 testes; rotas e navegação atualizadas.
- [x] K5 Resultado no app, histórico completo, 10 jogos por concurso: nenhuma estratégia sai do acaso (Mega-Sena 2.971 concursos: aleatório 0,608, atrasadas 0,590, frequentes 0,605, mista 0,605, ritmo 0,611, acaso 0,600, margens ±0,010 a ±0,016).
- [x] K6 Defeito achado na verificação e corrigido: com margem de 95% o próprio "aleatório" aparecia "acima do acaso" (5 comparações ao mesmo tempo: ~23% de chance de alguma passar por sorte). Margem passou a 99% (Bonferroni) e a conclusão avisa quando até o aleatório passa.
- [x] K7 Desempenho (Node, histórico completo, 10 jogos por concurso): Mega-Sena 0,5 s, Lotofácil 0,7 s, Lotomania 4,3 s; no app roda em fatias de ~40 ms, sem travar a tela.
- [x] K8 Volante da Lotofácil (5 × 5): as divisórias dos quadrantes cortavam a 3ª coluna e a 3ª linha ao meio; agora ficam no vão depois delas, como em `quadrante()` do core (Q1 = 01..03, 06..08, 11..13). Grades pares continuam no centro; 2 testes novos.
- Gate desta rodada (Jest direto): api 181, app 303, core 186, ui 92, mega-sena 45, lotomania 16, lotofacil 10, comum 6, contratos 5 = 844; lint sem erros (avisos antigos); build de api e app ok.
