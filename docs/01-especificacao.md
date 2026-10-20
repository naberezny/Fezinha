# Sorteios — Especificação do webapp

Data: 2026-10-16 · Status: aprovado pelo João (protótipo visual v7)
Protótipo aprovado: `docs/prototipo-aprovado-v7.html` (também publicado em https://claude.ai/artifact/RxVZTVtRah4u8dypaeJ8nD)
Plano de execução: `docs/02-plano-execucao.md`

## 1. Objetivo

Webapp multiplataforma (web, Android, iOS, Windows) que:

1. Mantém o histórico de resultados de loterias da Caixa (Mega-Sena primeiro) atualizado a partir da API pública da Caixa, com cache no servidor.
2. Gera jogos a partir de modos configuráveis (dezenas atrasadas, frequentes, mista, aleatório), regras do volante e filtros estatísticos, com dezenas fixas opcionais.
3. Mostra resultados anteriores e estatísticas das dezenas por período, com os gráficos do protótipo.
4. Permite adicionar uma loteria nova sem alterar telas: tudo é dirigido por uma definição declarativa por jogo.

Aviso de produto (obrigatório em tela): cada sorteio é independente; os modos escolhem dezenas de forma sistemática pelo histórico, a chance real de cada jogo não muda. O app não é afiliado à Caixa e não realiza apostas.

## 2. Decisões técnicas (fechadas)

| # | Decisão | Escolha | Motivo |
|---|---------|---------|--------|
| D1 | App | **Angular + Ionic**, standalone components, PWA | Mesmo modelo mental do NestJS; Ionic só na casca (abas, modais, área segura); conteúdo com os componentes do protótipo |
| D2 | API | **NestJS** | TypeScript ponta a ponta; domínio compartilhado com o app; módulo por loteria |
| D3 | Domínio | **lib `core` pura** (sem DOM, sem rede, sem Prisma) | Uma única implementação de regras, testada uma vez, usada por app e API |
| D4 | Banco | **SQLite em arquivo via Prisma** agora; **PostgreSQL depois** — **migrado para PostgreSQL 17 em 19/10/2026** (seção 9) | Testes e apresentações sem infraestrutura. Migração = trocar provider + regenerar migrations |
| D5 | Portabilidade de banco | Nenhum SQL de dialeto; sem views; datas ISO em texto; dinheiro em **centavos (BigInt)**; enums como texto | Garante a migração D4 em horas |
| D6 | Monorepo | **Nx + pnpm** | Grafo de dependências, cache de build, geradores Angular/Nest nativos |
| D7 | Testes | **Jest** (libs, app, api) + **Playwright** (e2e do app) | Um runner só; paridade com os scripts Python via fixtures |
| D8 | Lojas | **Capacitor** (iOS, Android) + **PWA/MSIX via PWABuilder** (Microsoft Store) | Capacitor já vem com Ionic |
| D9 | Atualização de resultados | Cache no servidor; **1ª consulta do dia sincroniza**, demais leem o banco; lock em memória; endpoint manual protegido | Pedido explícito; a Caixa publica no máximo um resultado por dia por loteria |
| D10 | Sem job agendado por enquanto | Só sincronização sob demanda + endpoint manual | Pedido explícito; cron entra depois como rede de segurança |
| D11 | Versionamento | **Local apenas** (git local sem remoto é opcional); nada publicado | Pedido explícito |
| D12 | Idioma | pt-BR em UI, código e documentação; identificadores em português | Padrão do dono do projeto |

Versões: usar as versões estáveis de Angular, Ionic, Nx, NestJS, Prisma e Capacitor vigentes na data de criação do workspace e **fixá-las** no `package.json` (sem `^`). Node LTS vigente.

## 3. Estrutura do workspace

```
Sorteios/                          # Nx workspace (pnpm) na raiz da pasta existente
  apps/
    app/                           # Angular + Ionic (PWA + Capacitor)
    app-e2e/                       # Playwright
    api/                           # NestJS
  libs/
    core/                          # domínio puro: definições, estatísticas, geradores, filtros
    contratos/                     # DTOs e tipos compartilhados app <-> api
    ui/                            # componentes Angular do protótipo (volante, bola, acordeão, gráficos SVG)
    loterias/
      mega-sena/                   # definição + adaptador de ingestão da Caixa + mapeamento de campos
  tools/
    carga-historica/               # importa Mega-Sena.xlsx / megasena.db (legado Python) para o Prisma
    fixtures/                      # megasena-3070.json (histórico congelado para testes de paridade)
```

Regra de dependência (verificada por lint do Nx): `core` não depende de nada; `loterias/*` depende de `core`; `contratos` depende de `core`; `ui` depende de `core`; `app` depende de `core`, `ui`, `contratos`, `loterias/*`; `api` depende de `core`, `contratos`, `loterias/*`. Nada depende de `app` ou `api`.

## 4. Domínio (lib `core`)

### 4.1 Definição de loteria (uma por jogo)

```ts
export interface FaixaPremiacao { faixa: number; acertos: number; nome: string }          // 1 = Sena (6), 2 = Quina (5), 3 = Quadra (4)

export interface LoteriaDefinicao {
  id: string;                        // 'megasena'
  nome: string;                      // 'Mega-Sena'
  universo: number;                  // 60  (dezenas 1..universo)
  sorteadas: number;                 // 6
  aposta: { min: number; max: number };     // { min: 6, max: 20 }
  volante: { colunas: number; linhas: number }; // { colunas: 10, linhas: 6 }
  quadrantes: number;                // 4 (metade das linhas x metade das colunas)
  faixas: FaixaPremiacao[];
  diasSorteio: number[];             // 0=domingo … 6=sábado; Mega-Sena: [2, 4, 6]
  regrasDisponiveis: string[];       // ids dos filtros que fazem sentido neste jogo
}
```

Mega-Sena: universo 60, sorteadas 6, aposta 6..20, volante 10×6, quadrantes 4, faixas Sena/Quina/Quadra, sorteios terça/quinta/sábado.

### 4.2 Histórico e estatísticas

```ts
export interface Concurso {
  numero: number; data: string /* ISO yyyy-mm-dd */; dezenas: number[] /* crescente */;
  acumulou: boolean; premiacoes: { faixa: number; ganhadores: number; rateioCentavos: bigint }[];
  valorAcumuladoCentavos: bigint; estimativaProximoCentavos: bigint; arrecadacaoCentavos: bigint;
  acumuladoEspecialCentavos: bigint; proximoNumero?: number; dataProximoSorteio?: string;
  locaisGanhadores: { cidade?: string; uf?: string; descricao: string; quantidade: number }[];
}
export interface Historico { loteria: LoteriaDefinicao; concursos: Concurso[] /* ordenado por numero */ }

export type Periodo = { tipo: 'ultimos'; quantidade: number } | { tipo: 'ano'; ano: number } | { tipo: 'tudo' };

export interface EstatisticaDezena {
  dezena: number; frequencia: number; atraso: number; atrasoMaximo: number;
  ultimoConcurso?: number; ultimaData?: string; probAusencia: number /* 0,9^atraso p/ Mega */;
}
export function calcularEstatisticas(historico: Historico, periodo: Periodo): EstatisticaDezena[];
export function frequenciaPorMes(historico: Historico, meses: number): { anoMes: string; dezena: number; total: number }[];
export function distribuicaoPares(historico: Historico): { pares: number; total: number }[];
export function distribuicaoSoma(historico: Historico, faixa: number): { inicio: number; total: number }[];
export function resumoPorAno(historico: Historico): { ano: number; concursos: number; acumulados: number; ganhadores: number; maiorPremioCentavos: bigint }[];
```

Atraso = concursos desde a última aparição (0 = saiu no último). Atraso esperado = universo / sorteadas (10 na Mega-Sena). Probabilidade de ausência = (1 − sorteadas/universo)^atraso.

Ritmo de cada dezena (`ritmo.ts`, 19/10/2026): `calcularRitmo(historico)` devolve, por dezena, aparições, intervalo médio entre aparições (1 = saiu no seguinte) e desvio, maior ausência entre duas aparições, atraso e `passouDe` (fração das ausências já encerradas mais curtas que o atraso atual). `AcompanhamentoRitmo` faz o mesmo concurso a concurso. É descrição do passado: medido nos resultados reais, o intervalo médio por dezena fica dentro do que o acaso produz (Mega-Sena 8,6 a 12,1 para esperado 10; Lotomania 4,6 a 5,5 para 5; Lotofácil 1,60 a 1,75 para 1,67) e um intervalo não prevê o seguinte.

### 4.5 Teste das estratégias (`teste-estrategias.ts`)

`executarTesteEstrategias(historico, { concursos, dezenasPorJogo, jogosPorConcurso = 10, semente = 1, janelaFrequencia = 50 })` é um gerador: para cada um dos últimos `concursos`, gera jogos com cada estratégia (`aleatorio`, `atrasadas`, `frequentes`, `mista` e `ritmo`, esta só existe no teste) usando apenas os resultados anteriores e conta os acertos; devolve o progresso (0..1) a cada 25 concursos e o resultado no fim. `testarEstrategias` roda de uma vez. Pesos = os da tela Gerar com os padrões (atraso mínimo = atraso esperado arredondado, intensidade 2, frequência nos últimos 50); `ritmo` usa peso `1 + 4·passouDe²`; sem regras do volante. Todas as estratégias usam a mesma semente. Por estratégia: média de acertos por jogo, margem de 99% (`Z_MARGEM` = 2,576 erros padrão, medidos entre concursos; 99% por ser 5 comparações ao mesmo tempo, correção de Bonferroni), jogos premiados e distribuição. `acasoDoJogo` dá a referência exata (hipergeométrica): média `k·sorteadas/universo` e probabilidade de prêmio pelas faixas da definição (inclui a faixa de 0 acertos da Lotomania).

### 4.3 Geração de jogos

```ts
export type Estrategia = 'atrasadas' | 'frequentes' | 'mista' | 'aleatorio';

export interface ConfiguracaoGeracao {
  estrategia: Estrategia;
  quantidadeJogos: number;           // 1..50
  dezenasPorJogo: number;            // aposta.min..aposta.max
  fixas: number[];                   // dezenas escolhidas pelo usuário (opcional)
  atrasadas: { atrasoMinimo: number; intensidade: number }; // padrão 10 e 2 (1..3, passo 0,5)
  frequentes: { periodo: Periodo };  // padrão últimos 50
  regras: Record<string, boolean>;   // ids de filtros ligados
}

export interface Jogo { dezenas: number[]; atrasoMedio: number; pares: number; quadrantes: number }

export interface Filtro {
  id: string; nome: string;
  aplicavelA(def: LoteriaDefinicao, dezenasPorJogo: number): boolean;
  aceita(jogo: number[], ctx: { def: LoteriaDefinicao; historico: Set<string> }): boolean;
}
export function gerarJogos(historico: Historico, config: ConfiguracaoGeracao, rng: () => number): Jogo[];
```

Pesos (iguais ao protótipo e ao `gerar_jogos.py`):

- atrasadas: `peso = atraso >= atrasoMinimo ? 1 + (atraso / esperado) ^ intensidade : 1`
- frequentes: `peso = 1 + frequênciaNoPeríodo`
- mista: `peso = sqrt(a_norm × f_norm) + 0,05` (normalizados pelo máximo)
- aleatorio: `peso = 1`

Sorteio ponderado sem reposição começando pelas fixas; rejeição por filtros; até 20.000 tentativas; sem jogos duplicados na mesma geração.

Filtros padrão (ligados por padrão salvo indicação):

| id | Regra | Aplicável quando |
|----|-------|------------------|
| `quadrantes` | Pelo menos uma dezena em cada quadrante | sempre |
| `colunas` | Dezenas nunca na mesma coluna do volante | dezenasPorJogo ≤ colunas |
| `linhas` (desligado por padrão) | No máximo 3 dezenas na mesma linha | sempre |
| `historico` | Nunca repetir um resultado já sorteado | dezenasPorJogo = sorteadas |
| `pares` | Entre ⌊k/3⌋ e k−⌊k/3⌋ dezenas pares (2 a 4 em 6) | sempre |
| `consecutivas` | No máximo 3 dezenas consecutivas | sempre |

Coluna = (n−1) mod colunas; linha = ⌊(n−1)/colunas⌋; quadrante = (linha < linhas/2 ? 0 : 2) + (coluna < colunas/2 ? 0 : 1).

### 4.4 Paridade com o legado

`tools/fixtures/megasena-3070.json` congela o histórico atual (3.070 concursos). Testes do `core` precisam reproduzir exatamente: frequências totais (dezena 10 = 359, 26 = 250), atraso atual (34 = 43, 45 = 40, 32 = 39), distribuição de pares (0:40, 1:271, 2:738, 3:944, 4:747, 5:292, 6:38) e os KPIs do protótipo.

## 5. API (NestJS)

### 5.1 Modelo de dados (Prisma, provider postgresql; sqlite até 19/10/2026)

```prisma
model Loteria       { id String @id; nome String; concursos Concurso[]; sincronizacao Sincronizacao? }
model Concurso {
  id Int @id @default(autoincrement()); loteriaId String; numero Int; dataSorteio String
  acumulou Boolean; valorAcumuladoCentavos BigInt @default(0); estimativaProximoCentavos BigInt @default(0)
  arrecadacaoCentavos BigInt @default(0); acumuladoEspecialCentavos BigInt @default(0)
  proximoNumero Int?; dataProximoSorteio String?; observacao String?
  origem String; atualizadoEm String
  dezenas Dezena[]; premiacoes Premiacao[]; locais LocalGanhador[]
  loteria Loteria @relation(fields: [loteriaId], references: [id])
  @@unique([loteriaId, numero]) @@index([loteriaId, dataSorteio])
}
model Dezena        { concursoId Int; ordem Int; dezena Int; @@id([concursoId, ordem]); @@index([dezena]) }
model Premiacao     { concursoId Int; faixa Int; descricao String; ganhadores Int; rateioCentavos BigInt; @@id([concursoId, faixa]) }
model LocalGanhador { id Int @id @default(autoincrement()); concursoId Int; cidade String?; uf String?; descricao String; quantidade Int @default(1) }
model Sincronizacao { loteriaId String @id; ultimaEm String?; ultimoConcurso Int?; proximoSorteioEm String?; ultimoErro String?; emAndamento Boolean @default(false) }
```

Origem: `'planilha' | 'caixa' | 'manual'`. Sem enums Prisma (portabilidade). BigInt é serializado como `number` nos DTOs (centavos cabem em 2^53).

### 5.2 Endpoints

| Método | Rota | Função | Auth |
|--------|------|--------|------|
| GET | `/loterias` | lista definições registradas | pública |
| GET | `/loterias/:id/resultados?limite=8&pagina=1` | últimos concursos (dispara sincronização se vencida, ver 5.3) | pública |
| GET | `/loterias/:id/resultados/:numero` | um concurso | pública |
| GET | `/loterias/:id/estatisticas?periodo=ultimos:50` | estatísticas por dezena + distribuições + resumo por ano (dispara sincronização se vencida) | pública |
| GET | `/loterias/:id/historico` | todos os concursos (dezenas + data) para a geração no cliente; ETag por último concurso | pública |
| GET | `/loterias/:id/sincronizacao` | última sincronização, último concurso, último erro | pública |
| POST | `/loterias/:id/sincronizar?de=&ate=` | força busca na Caixa; intervalo opcional | header `X-Chave-Admin` |
| GET | `/saude` | ping + versão | pública |

OpenAPI gerado pelo Nest (`@nestjs/swagger`); cliente TypeScript do app gerado a partir dele (lib `contratos`).

### 5.3 Sincronização com a Caixa (D9)

Fonte: `https://servicebus3.caixa.gov.br/portaldeloterias/api/{loteria}/` (último concurso) e `/{loteria}/{numero}` (concurso específico). API pública **não documentada**: os nomes de campo abaixo são os esperados e serão confirmados no primeiro teste real; o adaptador isola o mapeamento num único arquivo por loteria.

Campos esperados: `numero`, `dataApuracao` (dd/mm/aaaa), `listaDezenas` (strings "04"), `acumulado`, `valorAcumuladoProximoConcurso`, `valorEstimadoProximoConcurso`, `dataProximoConcurso`, `numeroConcursoProximo`, `valorArrecadado`, `valorAcumuladoConcursoEspecial`, `listaRateioPremio[] { faixa, descricaoFaixa, numeroDeGanhadores, valorPremio }`, `listaMunicipioUFGanhadores[] { ganhadores, municipio, uf }`.

Algoritmo (`SincronizacaoService.garantirAtualizado(loteriaId)`):

1. Ler `Sincronizacao` da loteria. Está **vencida** se `ultimaEm` é nulo, ou há mais de 24 h, ou `proximoSorteioEm` já passou (data do próximo sorteio informada pela Caixa, às 20h de Brasília).
2. Não vencida → retornar sem chamar a Caixa.
3. Vencida → adquirir lock em memória por loteria (um `Map<string, Promise>`): se já há sincronização em voo, aguardar a mesma promessa.
4. Buscar o último concurso na Caixa. Se `numero` ≤ último gravado, só atualizar `ultimaEm`/`proximoSorteioEm`.
5. Senão, buscar cada concurso faltante de `ultimoGravado + 1` até `numero` (sequencial, com pequena pausa) e gravar por upsert (concurso + dezenas + premiações + locais) em transação por concurso.
6. Gravar `ultimaEm`, `ultimoConcurso`, `proximoSorteioEm`, limpar `ultimoErro`.
7. Qualquer falha de rede ou de formato: gravar `ultimoErro`, **não lançar**: a consulta responde com o que há no banco. Timeout de 10 s por chamada; 2 tentativas.

`POST /sincronizar` chama o mesmo serviço com `forcar = true` (ignora o passo 2) e devolve `{ novos, atualizados, inalterados, ultimoConcurso }`.

### 5.4 Carga histórica

`tools/carga-historica` lê `Mega-Sena.xlsx` (ou o `megasena.db` legado) e grava pelo mesmo upsert, com `origem = 'planilha'`. Roda uma vez por banco; idempotente.

## 6. App (Angular + Ionic)

### 6.1 Navegação

Barra superior: marca "Sorteios" + links Gerar jogos / Resultados anteriores / Estatísticas / Teste. Em celular, as mesmas quatro entradas em `ion-tabs` no rodapé (mais Início e Tema). Tema claro e escuro pelos tokens do protótipo (`--bg`, `--surface`, `--fg`, `--muted`, `--line`, `--accent`, `--ball`, série `--s1`, rampa sequencial `--seq-*`, status `--good/--warn/--crit`). Fontes: Bricolage Grotesque (títulos), Source Sans 3 (texto), JetBrains Mono (números).

### 6.2 Tela Gerar jogos (mapa do protótipo → componentes)

| Elemento do protótipo | Componente | Comportamento |
|----|----|----|
| Tipo de jogo (select) | `SeletorLoteriaComponent` | lista `GET /loterias`; loterias não registradas aparecem desabilitadas "em breve" |
| Quantidade de jogos / Dezenas por jogo (steppers) | `StepperComponent` | limites vindos da definição; combinações `C(k, sorteadas)` e chance "1 em N" recalculadas |
| Acordeão de configurações | `AcordeaoComponent` (4 seções) | seção fechada mostra resumo do valor atual; "Modo de geração" aberta por padrão |
| Modo de geração (acordeão interno) | `ModosGeracaoComponent` | só o modo selecionado expandido; **Dezenas atrasadas é o padrão**; parâmetros: atraso mínimo (número) e "Quanto priorizar as atrasadas" (slider 1..3 passo 0,5, escala suave/equilibrado/só as mais atrasadas, explicação viva com 20/30/40 concursos); frequentes: janela (últimos 50/100, ano atual, ano anterior, tudo) |
| Suas dezenas (opcional) | `VolanteComponent` | grade colunas×linhas da definição com divisórias de quadrante; aviso "Você não precisa marcar nada…"; limite = dezenas por jogo; resumo "nenhuma · o sistema escolhe todas as k" |
| Regras do volante (switches) | `RegrasComponent` | quadrantes (on), colunas (on; desabilita quando k > colunas), linhas (off) |
| Filtros estatísticos (switches) | `FiltrosComponent` | histórico (on), pares (on, legenda recalculada por k), consecutivas (on) |
| Gerar jogos / Limpar | `GeradorPage` | chama `gerarJogos` do `core` no cliente com o histórico em cache |
| Lista de jogos | `JogoComponent` | bolas com badge de atraso; dezenas fixas com anel; meta "sem sair há X concursos, em média", pares/ímpares, quadrantes; legenda fixa explicando atraso; estado vazio quando nenhum jogo passa nos filtros |
| Copiar / Salvar / Exportar | `AcoesJogosComponent` | copiar para a área de transferência (funciona); salvar em "Meus jogos" local (IndexedDB); exportar texto via Web Share/Capacitor Share |
| Aviso de independência | `AvisoComponent` | texto fixo (seção 1) |

### 6.3 Aba Resultados anteriores

KPIs: último concurso (data e situação), acumulado atual (com sequência de acumulados), estimativa do próximo, ganhadores da sena no ano. Blocos: tabela de últimos resultados (concurso, data, dezenas em bolas, situação em pill, ganhadores, prêmio/acumulado, estimativa seguinte) com "Ver todos" (paginação); acumulados por ano (colunas, desde 2016); ganhadores da sena por ano (colunas); ganhadores da sena por UF (barras, 10 maiores); maiores prêmios pagos (barras, 8 maiores).

### 6.4 Aba Estatísticas das dezenas

Filtro de período (últimos 50 / últimos 100 / ano atual / ano anterior / histórico). KPIs: concursos no período, média por dezena (com esperado), mais sorteada (e menos), mais atrasada. Blocos: frequência por dezena (60 barras, ordenar por dezena/total, 5 mais e 5 menos em destaque, demais esmaecidas); atraso atual (15 maiores, linha de referência no esperado); mais e menos sorteadas (listas com barra); mapa de calor dezena × mês (12 meses, rampa sequencial 0..4+); pares × ímpares por sorteio; soma das dezenas por faixa de 20. Tooltips em todos os marcadores; gráficos em SVG próprio (sem biblioteca), cores por token de tema.

Ritmo de cada dezena (19/10/2026; histórico completo, independe do período): tabela com dezena, atraso atual, "fora há mais tempo que" (barra com `passouDe`), "sai a cada" (intervalo médio; 2 casas quando o esperado é menor que 5, como na Lotofácil) e maior ausência; ordem "mais fora do ritmo" (padrão) ou "por dezena"; rolagem própria com cabeçalho fixo. Nota abaixo compara com o acaso (esperado, faixa observada, chance igual para todas no próximo concurso) e leva à aba Teste.

### 6.6 Aba Teste das estratégias (`/:loteria/teste`)

Janela (últimos 100 / 500 / 1.000 / histórico; os 100 primeiros concursos nunca são testados) e botão "Rodar teste" ("Rodar de novo" troca a semente). Roda `executarTesteEstrategias` em fatias de ~40 ms com barra de progresso; trocar de loteria ou sair da tela interrompe. KPIs: concursos testados, jogos por estratégia, acaso (acertos por jogo e chance de prêmio), conclusão ("Empate" ou quais passaram da margem; se até o aleatório passou, avisa que é sorte da rodada). Gráfico de intervalos (ponto = média, traço = margem de 99%, linha = acaso) e tabela por estratégia (acertos por jogo, diferença do acaso, margem, jogos premiados, resultado).

### 6.5 Offline e cache no cliente

Service worker do Angular; último `historico`, `resultados` e `estatisticas` guardados em IndexedDB; a tela abre com o cache e revalida em segundo plano (`stale-while-revalidate`). Geração de jogos nunca depende de rede.

## 7. Empacotamento e lojas (D8)

- PWA: manifesto, ícones maskable, splash, `display: standalone`.
- Android: projeto Capacitor; assinatura; conta Google Play.
- iOS: projeto Capacitor; build em macOS (CI em nuvem quando houver repositório remoto); conta Apple Developer; incluir recursos nativos (compartilhar, notificação local do resultado, salvar jogos) para não ser classificado como "site embrulhado".
- Windows: PWABuilder → MSIX → Microsoft Store.
- Página de política de privacidade (sem coleta de dados pessoais) e aviso de não afiliação à Caixa. Verificar as políticas vigentes das três lojas para apps de loteria antes de abrir contas.

## 8. Fora de escopo (por enquanto)

Login/contas, apostas ou pagamento, job agendado (D10), notificações push por servidor. (PostgreSQL, D4, e a Lotofácil, prova de plugabilidade, já foram feitos.)

## 9. Migração para PostgreSQL (procedimento; executado em 19/10/2026)

1. Provisionar Postgres (via OIL se for infra PJUS); `DATABASE_URL` nova. Local: `docker compose up -d postgres` (`docker-compose.yml`, PostgreSQL 17).
2. `schema.prisma`: `provider = "postgresql"`; apagar a pasta `prisma/migrations`; gerar a migration inicial
   (feito com `prisma migrate diff --from-empty --to-schema apps/api/prisma/schema.prisma --script`, sem precisar de banco).
3. Driver: `@prisma/adapter-better-sqlite3` → `@prisma/adapter-pg` (+ `pg`) em `PrismaService`; saem os `PRAGMA` do SQLite.
4. Dados: não houve exportação. O banco da API é derivado (fixtures + Caixa), então bastou `pnpm prisma:migrar` e as cargas
   (`carga:megasena`, `carga:lotomania`, `carga:lotofacil`); a sincronização lazy completa o que faltar.
5. Testes: **todos** rodam no Postgres. O cliente Prisma 7 é gerado para um único provider, então a ideia original de manter
   testes em SQLite não se aplica. Cada suíte cria um database `teste_<uuid>` (`apps/api/src/testes/banco-temporario.ts`),
   aplica as migrations e o derruba no fim.
