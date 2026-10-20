import { Route } from '@angular/router';

/** Loteria dos redirecionamentos de compatibilidade (links antigos eram `/gerar`, `/resultados`, `/estatisticas`). */
const LOTERIA_COMPATIBILIDADE = 'megasena';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./inicio/inicio.page').then((m) => m.InicioPage),
  },
  // Compatibilidade com os links e o PWA antigos, de antes das rotas por jogo.
  { path: 'gerar', pathMatch: 'full', redirectTo: `${LOTERIA_COMPATIBILIDADE}/gerar` },
  { path: 'resultados', pathMatch: 'full', redirectTo: `${LOTERIA_COMPATIBILIDADE}/resultados` },
  { path: 'estatisticas', pathMatch: 'full', redirectTo: `${LOTERIA_COMPATIBILIDADE}/estatisticas` },
  {
    path: ':loteria',
    loadComponent: () => import('./jogo/jogo-shell.page').then((m) => m.JogoShellPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'gerar' },
      {
        path: 'gerar',
        loadComponent: () => import('./gerar/gerar.page').then((m) => m.GerarPage),
      },
      {
        path: 'resultados',
        loadComponent: () => import('./resultados/resultados.page').then((m) => m.ResultadosPage),
      },
      {
        path: 'estatisticas',
        loadComponent: () => import('./estatisticas/estatisticas.page').then((m) => m.EstatisticasPage),
      },
      {
        path: 'meus-jogos',
        loadComponent: () => import('./meus-jogos/meus-jogos.page').then((m) => m.MeusJogosPage),
      },
      {
        path: 'teste',
        loadComponent: () => import('./teste/teste.page').then((m) => m.TestePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
