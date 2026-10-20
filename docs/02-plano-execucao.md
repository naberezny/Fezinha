# Sorteios — Plano de execução

> **Para agentes:** este é o plano mestre. Cada fase vira, no momento de executá-la, um plano de tarefas miúdas (teste → implementação → execução) usando `superpowers:writing-plans`, e é executada com `superpowers:subagent-driven-development` ou `superpowers:executing-plans`. Tudo local (D11): sem remoto, sem publicação.

**Objetivo:** construir o webapp Sorteios (Angular + Ionic + NestJS + Prisma/SQLite) reproduzindo o protótipo aprovado v7, com histórico atualizado pela API da Caixa e pronto para empacotar nas lojas.

**Arquitetura:** monorepo Nx; domínio puro em `libs/core` compartilhado por app e API; loteria como plugin (`libs/loterias/*`); API NestJS com cache de sincronização no servidor; app Angular/Ionic offline-first que gera jogos no cliente.

**Stack:** Nx, pnpm, Angular, Ionic, NestJS, Prisma (sqlite), Jest, Playwright, Capacitor, PWABuilder.

**Especificação:** `docs/01-especificacao.md` (decisões D1–D12, domínio, API, telas). Protótipo: `docs/prototipo-aprovado-v7.html`.

## Restrições globais

- Versões fixadas no `package.json` (sem `^`); Node LTS vigente.
- Código, identificadores, commits e docs em pt-BR.
- `libs/core` sem dependência de DOM, rede ou Prisma; validado pelo lint de fronteiras do Nx.
- Nenhum SQL de dialeto; dinheiro em centavos BigInt; datas ISO em texto; enums como texto (D5).
- Toda regra de negócio nasce com teste (TDD); paridade com `tools/fixtures/megasena-3070.json` é gate das fases 1 e 2.
- Nada sobe para repositório remoto; git local opcional, sem remoto.
- Os scripts Python existentes (`banco.py`, `gerar_jogos.py`, `importar_planilha.py`) não são alterados; viram referência de paridade.

---

## Fase 0 — Fundação do workspace

**Entrega:** workspace Nx criado em `C:\Users\joao.naberezny\repositorios\Sorteios\sorteios-app`, com app, api e libs vazias, lint de fronteiras, Jest e Prettier funcionando. `pnpm nx run-many -t lint test build` verde.

| Tarefa | Arquivos | Critério de aceite |
|---|---|---|
| 0.1 Criar workspace | `sorteios-app/` via `create-nx-workspace --preset=apps --pm=pnpm --skipGit` (git local depois, se quiser) | `nx report` lista as versões fixadas |
| 0.2 Gerar `apps/api` (NestJS) e `apps/app` (Angular standalone) + Ionic | `apps/api/src/main.ts`, `apps/app/src/main.ts`, `apps/app/src/app/app.component.ts` | `nx serve api` responde `/saude`; `nx serve app` abre uma página Ionic vazia |
| 0.3 Gerar libs | `libs/core`, `libs/contratos`, `libs/ui`, `libs/loterias/mega-sena` com tags `scope:core`, `scope:contratos`, `scope:ui`, `scope:loteria`, `scope:app`, `scope:api` | `eslint.config` com `@nx/enforce-module-boundaries` segundo a regra da seção 3 da especificação; um teste de lint que tenta importar `api` dentro de `core` falha |
| 0.4 Fixtures e ferramentas | `tools/fixtures/megasena-3070.json` gerado a partir de `megasena.db` (script Node de uma vez em `tools/fixtures/gerar.ts`); `tools/carga-historica/` vazio | arquivo com 3070 concursos, dezenas, premiações e locais; checksum registrado no README do fixture |
| 0.5 Scripts e docs | `package.json` scripts: `dev` (api + app em paralelo), `teste`, `lint`, `build`; `README.md` do workspace | `pnpm dev` sobe os dois |

---

## Fase 1 — Domínio (`libs/core`) e plugin Mega-Sena

**Entrega:** `calcularEstatisticas`, `gerarJogos`, filtros e definição da Mega-Sena com paridade total ao legado.

### 1.1 Tipos e definição

- Criar: `libs/core/src/lib/tipos.ts` (interfaces da seção 4 da especificação), `libs/core/src/lib/registro-loterias.ts` (`registrarLoteria(def)`, `obterLoteria(id)`, `listarLoterias()`).
- Criar: `libs/loterias/mega-sena/src/lib/definicao.ts` com a `LoteriaDefinicao` da Mega-Sena; `index.ts` registra ao importar.
- Testes: definição válida (universo 60, aposta 6..20, volante 10×6); registro rejeita id duplicado; `obterLoteria('x')` lança erro claro.

### 1.2 Geometria do volante

- Criar: `libs/core/src/lib/volante.ts`: `coluna(n, def)`, `linha(n, def)`, `quadrante(n, def)`, `combinacoes(k, sorteadas)`.
- Testes: 01→col 0/lin 0/Q1; 10→col 9/Q2; 51→Q3; 60→Q4; `combinacoes(6,6)=1`, `(7,6)=7`, `(20,6)=38760`.

### 1.3 Estatísticas

- Criar: `libs/core/src/lib/estatisticas.ts` (`calcularEstatisticas`, `frequenciaPorMes`, `distribuicaoPares`, `distribuicaoSoma`, `resumoPorAno`).
- Testes de paridade com o fixture: frequência total (10→359, 53→350, 26→250, 21→261); atraso (34→43, 45→40, 32→39, 59→35); atraso máximo (42→108); pares (0:40 … 6:38); período `ultimos:50` com 43→11×, 11→10×; `ano:2025` com 15→24×; `resumoPorAno(2026)` com concursos/acumulados batendo com o `vw_sorteios` legado.
- Teste de propriedade: soma das frequências = concursos × sorteadas.

### 1.4 Filtros

- Criar: `libs/core/src/lib/filtros/` um arquivo por filtro (`quadrantes.ts`, `colunas.ts`, `linhas.ts`, `historico.ts`, `pares.ts`, `consecutivas.ts`) + `index.ts` com `filtrosPadrao()`.
- Testes por filtro: um jogo que passa e um que falha; `colunas.aplicavelA` falso para k = 11; `historico.aplicavelA` falso para k ≠ 6; `pares` com k = 6 aceita 2..4 e com k = 9 aceita 3..6.

### 1.5 Pesos e geração

- Criar: `libs/core/src/lib/pesos.ts` (`calcularPesos(estatisticas, config, def)`), `libs/core/src/lib/geracao.ts` (`gerarJogos`), `libs/core/src/lib/rng.ts` (gerador determinístico por semente, p/ testes).
- Testes: pesos atrasadas com atraso 30, esperado 10, intensidade 2 → 10; abaixo do mínimo → 1; aleatório → todos 1; `gerarJogos` com semente fixa é reproduzível; respeita fixas; nunca repete jogo; cada jogo passa em todos os filtros ligados; `quantidadeJogos` honrada ou retorno parcial com aviso quando os filtros são impossíveis (fixas 01 02 03 04 05 06 + histórico); 20 dezenas por jogo funciona com `colunas` desligado automaticamente.

### 1.6 Adaptador da Caixa (só mapeamento, sem rede)

- Criar: `libs/loterias/mega-sena/src/lib/caixa-mapeador.ts`: `mapearRespostaCaixa(json: unknown): Concurso` validando com `zod`.
- Testes: fixture `caixa-megasena-exemplo.json` (capturado manualmente de uma chamada real no início da fase) → `Concurso` correto; campos ausentes → erro descritivo; valores monetários → centavos sem erro de ponto flutuante.

**Gate da fase:** `nx test core loterias-mega-sena` verde; cobertura ≥ 90% em `core`.

---

## Fase 2 — API (NestJS + Prisma/SQLite)

**Entrega:** API servindo histórico, resultados, estatísticas e sincronização com cache, carregada com o histórico real.

### 2.1 Prisma

- Criar: `apps/api/prisma/schema.prisma` (seção 5.1), `prisma/migrations/`, `apps/api/src/prisma/prisma.service.ts`.
- Banco de desenvolvimento: `apps/api/dados/sorteios.db`; testes: arquivo temporário por suíte (`DATABASE_URL=file:./tmp/teste-<id>.db`).
- Teste: migração aplica em banco vazio; `@@unique([loteriaId, numero])` impede duplicata.

### 2.2 Repositório de concursos

- Criar: `apps/api/src/loterias/concursos.repositorio.ts`: `upsertConcurso(loteriaId, concurso): Promise<'novo'|'atualizado'|'inalterado'>`, `listar(loteriaId, {limite, pagina})`, `obter(loteriaId, numero)`, `historico(loteriaId)`, `ultimoNumero(loteriaId)`.
- Testes: inserir, repetir (inalterado), alterar dezena (atualizado, filhos regravados), paginação.

### 2.3 Carga histórica

- Criar: `tools/carga-historica/src/main.ts` lendo `megasena-3070.json` (ou a planilha via `exceljs`) e chamando o upsert; comando `pnpm carga:megasena`.
- Teste: após a carga, `ultimoNumero = 3070`, 18.420 dezenas, 903 locais; rodar duas vezes → 3070 inalterados.

### 2.4 Módulo de loterias e leitura

- Criar: `apps/api/src/loterias/loterias.module.ts`, `loterias.controller.ts`, `loterias.service.ts`, DTOs em `libs/contratos` (`ResultadoDto`, `EstatisticasDto`, `HistoricoDto`, `SincronizacaoDto`), `bigint.interceptor.ts` (BigInt → number).
- Endpoints GET da seção 5.2; `estatisticas` reutiliza `core.calcularEstatisticas` sobre o histórico do banco (cache em memória invalidado a cada sincronização).
- Testes e2e (supertest): `GET /loterias/megasena/resultados?limite=8` devolve 8 itens com o 3070 primeiro; `GET /estatisticas?periodo=ultimos:50` bate com o fixture; `GET /historico` devolve ETag e 304 em repetição.

### 2.5 Sincronização com a Caixa

- Criar: `apps/api/src/sincronizacao/caixa.cliente.ts` (HTTP com timeout 10 s, 2 tentativas, `User-Agent` fixo), `sincronizacao.service.ts` (algoritmo 5.3 com lock em memória), `sincronizacao.controller.ts` (`POST /loterias/:id/sincronizar`, `GET /loterias/:id/sincronizacao`), `chave-admin.guard.ts` (header `X-Chave-Admin` vs variável `CHAVE_ADMIN`).
- Interceptor/guard `GarantirAtualizado` nas rotas de leitura chama `garantirAtualizado(loteriaId)` antes de responder, nunca propaga erro da Caixa.
- Testes (cliente da Caixa mockado com `nock`/`msw`): não vencida → zero chamadas; vencida com último igual → 1 chamada e só marca; vencida com 3 concursos faltando → 4 chamadas e 3 novos; 20 requisições concorrentes → 1 chamada; Caixa fora → resposta do banco + `ultimoErro` preenchido; `POST /sincronizar` sem chave → 401; com chave → `{novos, atualizados, inalterados, ultimoConcurso}`; `?de=3000&ate=3005` reimporta o intervalo.
- Teste manual registrado no README: primeira chamada real à Caixa, com a resposta salva como fixture (1.6).

### 2.6 OpenAPI e cliente

- `@nestjs/swagger` em `/docs`; script `pnpm gerar:cliente` que gera `libs/contratos/src/lib/cliente/` (openapi-typescript + fetch tipado).
- Teste: build do app falha se um DTO mudar sem regenerar (tipo quebrado), garantindo contrato único.

**Gate da fase:** `nx test api` verde; `pnpm carga:megasena` + `nx serve api` + `curl /loterias/megasena/resultados` devolvem o concurso 3070 e a sincronização real traz os concursos posteriores a 3070.

---

## Fase 3 — App (Angular + Ionic)

**Entrega:** as três telas do protótipo funcionando contra a API, com tema claro/escuro, offline e geração no cliente.

### 3.1 Casca e tema

- `apps/app/src/app/app.component.ts` com `ion-app`, barra superior (desktop) e `ion-tabs` (celular); rotas `/gerar`, `/resultados`, `/estatisticas`.
- `apps/app/src/styles/tokens.scss` com os tokens do protótipo (claro, escuro via `prefers-color-scheme` e `data-theme`); fontes via Google Fonts com fallback.
- Teste: snapshot das rotas; tema alterna sem cor literal fora dos tokens (lint de stylelint proibindo hex fora de `tokens.scss`).

### 3.2 Serviços de dados e cache

- `apps/app/src/app/dados/loterias.servico.ts` (cliente gerado), `cache.servico.ts` (IndexedDB via `idb`), `historico.store.ts` (signals): carrega do cache, revalida pela API, expõe `historico`, `estatisticas(periodo)`, `resultados`.
- Testes: abre com cache e sem rede; revalida quando a API responde; erro de rede não apaga o cache.

### 3.3 Componentes da lib `ui` (um por item da tabela 6.2 da especificação)

`BolaComponent`, `VolanteComponent`, `StepperComponent`, `AcordeaoComponent`, `SwitchComponent`, `JogoComponent`, `KpiComponent`, `GraficoBarrasComponent` (vertical e horizontal, com tooltip e linha de referência), `GraficoColunasComponent`, `MapaCalorComponent`, `ListaBarrasComponent`, `TabelaResultadosComponent`, `AvisoComponent`.

- Cada componente: teste de renderização com dados do fixture + teste de interação (clique no volante alterna `aria-pressed`; stepper respeita min/max; acordeão mostra resumo quando fechado).
- Gráficos em SVG próprio, cores por token, `role="img"` e `aria-label`.

### 3.4 Tela Gerar jogos

- `apps/app/src/app/gerar/gerar.page.ts` + `gerar.estado.ts` (signals da `ConfiguracaoGeracao`), `explicacao-intensidade.ts` (texto vivo 20/30/40 concursos).
- Regras de UI da especificação 6.2: atrasadas como padrão; `colunas` desabilita com k > 10; legenda de pares recalculada; limite de fixas = k; estado vazio; legenda do atraso; copiar; salvar em "Meus jogos" (IndexedDB); exportar (Web Share, com fallback copiar).
- Testes: gerar 5 jogos de 6 com semente fixa reproduz o `core`; trocar k para 12 desliga `colunas` e atualiza combinações para 924; marcar 7 dezenas com k = 6 é bloqueado; copiar escreve o texto esperado.

### 3.5 Aba Resultados anteriores

- `resultados.page.ts`: KPIs, tabela paginada ("Ver todos"), acumulados por ano, ganhadores por ano, por UF, maiores prêmios, conforme 6.3.
- Testes: KPIs do fixture (acumulado R$ 152,7 mi; estimativa R$ 170 mi; 8 acumulados seguidos); tabela mostra 3070 primeiro com pill "Acumulou".

### 3.6 Aba Estatísticas das dezenas

- `estatisticas.page.ts` com filtro de período e os seis blocos de 6.4; ordenação por dezena/total; destaque 5+/5−.
- Testes: período `ultimos:50` destaca 43 (11×); mapa de calor tem 12 linhas × 60 células; linha de referência do atraso em 10.

### 3.7 PWA e offline

- `ngsw-config.json` (app shell + `historico`/`resultados`/`estatisticas` com estratégia freshness), `manifest.webmanifest`, ícones maskable.
- Teste e2e (Playwright): abrir online, desligar rede (`context.setOffline(true)`), recarregar, gerar jogos e ver resultados do cache.

**Gate da fase:** Playwright cobrindo o fluxo do protótipo (gerar com cada modo, marcar dezenas, trocar abas e períodos) em desktop e mobile (375 px); comparação visual lado a lado com `prototipo-aprovado-v7.html` aprovada pelo João; Lighthouse PWA instalável, acessibilidade ≥ 90.

---

## Fase 4 — Qualidade e hardening

| Tarefa | Critério |
|---|---|
| 4.1 Acessibilidade | foco visível em tudo, `aria-pressed`/`aria-selected`, tabela com cabeçalhos, contraste dos tokens validado (claro e escuro) |
| 4.2 Performance | bundle inicial do app < 500 kB gzip; rotas com lazy loading; `historico` com ETag/304; geração de 50 jogos de 20 dezenas < 200 ms |
| 4.3 Resiliência da API | rate limit no `POST /sincronizar`; log estruturado sem dados pessoais; `GET /saude` com versão e último concurso |
| 4.4 Backup | script `pnpm backup:db` copia o `.db` com data; documentado no README |
| 4.5 Documentação | README do workspace: subir local, carga histórica, chave admin, rodar testes, gerar cliente, empacotar |

---

## Fase 5 — Empacotamento para lojas

| Tarefa | Entrega | Observação |
|---|---|---|
| 5.1 Identidade | ícone, splash, nome "Sorteios", id `br.com.<seu-dominio>.sorteios` | decidir domínio/id antes |
| 5.2 Capacitor | `apps/app/capacitor.config.ts`; `npx cap add android`, `npx cap add ios`; plugins Share, Haptics, StatusBar, Preferences | build Android local; iOS exige macOS (CI em nuvem quando houver remoto, o que foge de D11 por ora) |
| 5.3 Windows | PWABuilder → MSIX; URL pública da PWA necessária | depende de hospedar a PWA + API (decisão futura: OIL ou hospedagem própria) |
| 5.4 Conformidade | página de privacidade; aviso de não afiliação à Caixa e de que não há apostas; verificar políticas vigentes das lojas para apps de loteria | pré-requisito das contas de desenvolvedor |
| 5.5 Contas e envio | Google Play (taxa única), Apple Developer (anual), Microsoft Partner Center | valores a confirmar nos sites oficiais |

---

## Fase 6 — Segunda loteria (prova de plugabilidade)

- Criar `libs/loterias/lotofacil` (universo 25, sorteadas 15, aposta 15..20, volante 5×5, faixas 15..11 acertos, sorteios de segunda a sábado) + mapeador da Caixa + registro.
- Carga histórica da Lotofácil pela mesma ferramenta (planilha da Caixa).
- **Critério de sucesso:** nenhuma alteração em `apps/app` nem em `libs/ui`; a loteria aparece no seletor, o volante vira 5×5, `colunas` fica desabilitado (15 > 5), estatísticas e sincronização funcionam. Se precisar tocar tela, é defeito de arquitetura a corrigir nesta fase.
- **Feito em 19/10/2026.** A Lotofácil apareceu sem tocar telas, exceto por um defeito corrigido: o "atraso esperado"
  (`universo / sorteadas`) era exibido cru e era inteiro nas outras loterias; na Lotofácil é 25/15 = 1,666…
  Agora `formatarAtraso` (core) formata a exibição ("1,7") e o atraso mínimo começa no inteiro mais próximo (2).
  Sorteios: segunda a sexta e mais um no fim de semana (sábado ou domingo desde junho/2026), por isso `diasSorteio` = 0..6.
  Regras: `quadrantes`, `historico`, `pares`; fora `consecutivas` (só 13% dos 3.807 resultados reais passam) e `linhas` (2,8%). Revisto em 19/10/2026: nenhuma regra (ver checklist K9).

---

## Fase 7 — Migração para PostgreSQL (quando decidir)

Seguir a seção 9 da especificação; critério: suíte da API verde contra Postgres e `pnpm carga:megasena` idempotente nos dois bancos.
**Feito em 19/10/2026:** 181 testes da API verdes no PostgreSQL 17 (docker-compose); cargas das três loterias idempotentes.

---

## Ordem, dependências e marcos

```
Fase 0 ─► Fase 1 ─► Fase 2 ─► Fase 3 ─► Fase 4 ─► Fase 5
                        │                  └──────► Fase 6 (pode correr em paralelo à 5)
                        └──────────────────────────► Fase 7 (quando quiser)
```

Marcos de aprovação do João: fim da Fase 1 (paridade com o legado), fim da Fase 2 (sincronização real com a Caixa), fim da Fase 3 (comparação visual com o protótipo), antes da Fase 5 (identidade e contas).

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| API da Caixa muda formato ou bloqueia | mapeador isolado em um arquivo; fixture da resposta real; fallback de importação por planilha; `ultimoErro` visível em `/sincronizacao` |
| Ionic deixar o desktop com cara de celular | Ionic só na casca; layout responsivo próprio ≥ 860 px (como no protótipo) |
| BigInt no JSON | interceptor global converte para number; teste de serialização |
| Lojas recusarem app de loteria | aviso de não afiliação, sem apostas/pagamentos, política de privacidade; checar políticas antes de pagar as contas |
| Paridade quebrar silenciosamente | fixture congelado + testes numéricos exatos nas fases 1 e 2 |

## Autoavaliação do plano (feita em 2026-10-16)

- Cobertura da especificação: D1–D12 mapeadas (D4/D5 → 2.1 e Fase 7; D9/D10 → 2.5; D8 → Fase 5; D11 → restrições); cada elemento da tabela 6.2 e dos blocos 6.3/6.4 tem componente e teste em 3.3–3.6; seção 5.2 coberta em 2.4/2.5; 5.4 em 2.3.
- Nomes consistentes entre fases: `calcularEstatisticas`, `gerarJogos`, `upsertConcurso`, `garantirAtualizado`, `mapearRespostaCaixa`, `ConfiguracaoGeracao`, `LoteriaDefinicao`.
- Pendências que só a execução resolve: nomes reais dos campos da API da Caixa (1.6/2.5), id do app e domínio (5.1), hospedagem da PWA (5.3).
